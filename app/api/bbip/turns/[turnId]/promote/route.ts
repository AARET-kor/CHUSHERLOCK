import { noteRefsFor, selectPromptNotes } from "../../../../../../lib/bbip/context";
import { buildPromoteInput, promoteDefaults } from "../../../../../../lib/bbip/promote";
import { promoteSchema } from "../../../../../../lib/bbip/schemas";
import { getSession, getTurn, markPromoted } from "../../../../../../lib/services/bbipService";
import { createEntry, deleteEntry, listEntries } from "../../../../../../lib/services/entryService";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ turnId: string }> };

async function load(turnId: string) {
  const turn = getTurn(turnId);
  const session = turn ? getSession(turn.sessionId) : null;
  if (!turn || !session) return null;
  const notes = selectPromptNotes(session, await listEntries());
  return { turn, session, notes };
}

/** GET → PromoteDefaults for the dialog. */
export async function GET(_request: Request, { params }: Params) {
  const { turnId } = await params;
  const loaded = await load(turnId);
  if (!loaded) return Response.json({ error: "카드를 찾을 수 없습니다." }, { status: 404 });
  return Response.json(promoteDefaults(loaded.session, loaded.turn, loaded.notes));
}

/** POST { title, categoryKey, tier, selection? } → { entryId } */
export async function POST(request: Request, { params }: Params) {
  const { turnId } = await params;
  const body = await request.json().catch(() => null);
  const parsed = promoteSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "입력값을 확인해 주세요." },
      { status: 400 }
    );
  }
  const loaded = await load(turnId);
  if (!loaded) return Response.json({ error: "카드를 찾을 수 없습니다." }, { status: 404 });
  if (loaded.turn.status !== "done") {
    return Response.json({ error: "완성된 카드만 저장할 수 있습니다." }, { status: 409 });
  }
  if (loaded.turn.promotedEntryId) {
    return Response.json(
      { error: "이미 노트로 저장된 카드입니다.", entryId: loaded.turn.promotedEntryId },
      { status: 409 }
    );
  }
  try {
    const input = buildPromoteInput({
      session: loaded.session,
      turn: loaded.turn,
      notes: noteRefsFor(loaded.notes),
      ...parsed.data,
    });
    const { entry } = await createEntry(input);
    // markPromoted only claims an unclaimed turn; a concurrent double-submit
    // loses here and its freshly created duplicate note is rolled back.
    if (!markPromoted(turnId, entry.id)) {
      await deleteEntry(entry.id);
      const winner = getTurn(turnId)?.promotedEntryId;
      return Response.json(
        { error: "이미 노트로 저장된 카드입니다.", entryId: winner },
        { status: 409 }
      );
    }
    return Response.json({ entryId: entry.id });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "노트 저장에 실패했습니다." },
      { status: 400 }
    );
  }
}
