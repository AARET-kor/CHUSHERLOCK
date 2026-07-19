"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { MarkdownContent } from "./MarkdownContent";

interface AskSource {
  n: number;
  id: string;
  title: string;
  categoryLabel: string;
}

const EXAMPLES = [
  "필러 시술 후 혈관 폐색(VO) 초기 징후와 응급 대응은?",
  "보톡스 확산을 줄이려면 희석 농도를 어떻게 조절해?",
  "울쎄라와 써마지의 적응증 차이 정리해줘",
  "리쥬란 시술 전 환자에게 설명할 멘트",
];

export function AskClient({ noteCount }: { noteCount: number }) {
  const [question, setQuestion] = useState("");
  const [asked, setAsked] = useState<string | null>(null);
  const [answer, setAnswer] = useState("");
  const [sources, setSources] = useState<AskSource[]>([]);
  const [state, setState] = useState<"idle" | "thinking" | "streaming" | "error">("idle");
  const abortRef = useRef<AbortController | null>(null);

  async function ask(q: string) {
    const query = q.trim();
    if (query.length < 2 || state === "thinking" || state === "streaming") return;

    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setAsked(query);
    setQuestion("");
    setAnswer("");
    setSources([]);
    setState("thinking");

    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: query }),
        signal: ctrl.signal,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setAnswer(data.error ?? "답변 생성에 실패했습니다.");
        setState("error");
        return;
      }

      // Sources travel in a header so we can render citations immediately.
      const header = res.headers.get("X-Ask-Sources");
      if (header) {
        try {
          const bytes = Uint8Array.from(atob(header), (c) => c.charCodeAt(0));
          setSources(JSON.parse(new TextDecoder().decode(bytes)));
        } catch {
          /* non-fatal */
        }
      }

      const reader = res.body?.getReader();
      if (!reader) {
        setState("error");
        return;
      }
      const decoder = new TextDecoder();
      let acc = "";
      setState("streaming");
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setAnswer(acc);
      }
      setState("idle");
    } catch (error) {
      if ((error as Error).name === "AbortError") return;
      setAnswer("네트워크 오류로 답변을 받지 못했습니다.");
      setState("error");
    }
  }

  const busy = state === "thinking" || state === "streaming";

  return (
    <div>
      <div className="mb-2 flex items-center gap-3 font-mono text-[10px] tracking-[0.2em] md:text-[11px]">
        <span className="text-ink/45">[ ASK ]</span>
        <span className="font-bold uppercase text-ink">물어보기 — 내 노트에게 질문</span>
      </div>
      <h1 className="mb-2 font-serifa text-2xl font-bold tracking-tight text-inkdeep md:text-3xl">
        무엇이든 물어보세요
      </h1>
      <p className="mb-6 max-w-2xl text-sm text-ink/60">
        정리된 노트 {noteCount}개를 근거로 답합니다. 진료 중 궁금한 것을 물으면, 관련 노트를 찾아
        종합하고 <strong className="text-ink/80">출처 노트를 인용</strong>합니다. 노트에 없는 내용은
        지어내지 않고 &quot;없다&quot;고 답합니다.
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void ask(question);
        }}
        className="relative"
      >
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void ask(question);
            }
          }}
          rows={2}
          autoFocus
          placeholder="예: 필러 후 실명 위험 징후와 hyaluronidase 응급 용량은?"
          className="field resize-none pr-28 text-base leading-relaxed"
        />
        <button
          type="submit"
          disabled={busy || question.trim().length < 2}
          className="btn-primary absolute bottom-3 right-3 !px-5 !py-2"
        >
          {busy ? "생각 중…" : "물어보기"}
        </button>
      </form>

      {!asked && (
        <div className="mt-4 flex flex-wrap gap-2">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => void ask(ex)}
              className="rounded-full border border-ink/15 bg-white px-3 py-1.5 text-xs text-ink/60 transition hover:border-ink/40 hover:text-ink"
            >
              {ex}
            </button>
          ))}
        </div>
      )}

      {asked && (
        <div className="animate-fade-in-up mt-8">
          <p className="mb-4 border-l-2 border-ink/20 pl-3 text-sm font-medium text-ink/70">
            {asked}
          </p>

          {state === "thinking" && (
            <div className="dot-pulse flex items-center gap-1.5 text-sm text-ink/40">
              노트를 찾아 종합하는 중 <span /> <span /> <span />
            </div>
          )}

          {answer && (
            <article className="card p-6">
              <MarkdownContent content={answer} />
            </article>
          )}

          {sources.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-ink/40">
                근거 노트 {sources.length}개
              </p>
              <div className="flex flex-wrap gap-2">
                {sources.map((s) => (
                  <Link
                    key={s.id}
                    href={`/entries/${s.id}`}
                    className="group inline-flex items-center gap-1.5 rounded-full border border-ink/15 bg-white px-3 py-1.5 text-xs text-ink/70 transition hover:border-ink/40 hover:text-ink"
                  >
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-ink text-[9px] font-bold text-white">
                      {s.n}
                    </span>
                    <span className="max-w-[220px] truncate group-hover:underline">{s.title}</span>
                    <span className="text-ink/35">· {s.categoryLabel}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {state === "streaming" && answer && (
            <p className="mt-3 text-xs text-ink/35">답변 생성 중…</p>
          )}
        </div>
      )}
    </div>
  );
}
