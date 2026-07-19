import { NextResponse } from "next/server";
import { listEntries } from "../../../lib/services/entryService";
import { retrieve } from "../../../lib/ai/retrieval";
import {
  buildAskSystemPrompt,
  buildAskUserPrompt,
  buildAskSources,
  fakeAskAnswer,
} from "../../../lib/ai/ask";
import { getAnthropicClient, isFakeMode, MODEL } from "../../../lib/ai/client";

export const dynamic = "force-dynamic";

const RETRIEVE_LIMIT = 16;

/** POST /api/ask { question } → streamed answer grounded in the user's notes.
 * The retrieved source notes travel in the X-Ask-Sources header (base64 JSON)
 * so the client can render numbered, clickable citations. */
export async function POST(request: Request) {
  let question = "";
  try {
    const body = await request.json();
    question = String(body.question ?? "").trim();
  } catch {
    /* fall through to validation */
  }
  if (question.length < 2) {
    return NextResponse.json({ error: "질문을 입력해 주세요." }, { status: 400 });
  }

  const entries = await listEntries();
  const retrieved = retrieve(question, entries, RETRIEVE_LIMIT);
  const sources = buildAskSources(retrieved);
  const sourceHeader = Buffer.from(JSON.stringify(sources), "utf-8").toString("base64");

  const encoder = new TextEncoder();

  if (isFakeMode()) {
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(fakeAskAnswer(question, sources)));
        controller.close();
      },
    });
    return streamResponse(stream, sourceHeader);
  }

  const client = getAnthropicClient();
  const modelStream = client.messages.stream({
    model: MODEL,
    max_tokens: 4096,
    thinking: { type: "adaptive" },
    system: [
      { type: "text", text: buildAskSystemPrompt(), cache_control: { type: "ephemeral" } },
    ],
    messages: [{ role: "user", content: buildAskUserPrompt(question, retrieved) }],
  });

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of modelStream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
        const final = await modelStream.finalMessage();
        if (final.stop_reason === "refusal") {
          controller.enqueue(encoder.encode("\n\n(이 질문에 대한 답변이 거부되었습니다.)"));
        }
      } catch (error) {
        controller.enqueue(
          encoder.encode(
            `\n\n[오류] 답변 생성 중 문제가 발생했습니다: ${
              error instanceof Error ? error.message : "알 수 없는 오류"
            }`
          )
        );
      } finally {
        controller.close();
      }
    },
  });

  return streamResponse(stream, sourceHeader);
}

function streamResponse(stream: ReadableStream, sourceHeader: string): Response {
  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Ask-Sources": sourceHeader,
    },
  });
}
