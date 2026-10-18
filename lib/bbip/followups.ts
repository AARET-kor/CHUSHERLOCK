// The brief ends with <followups>["…","…"]</followups>. The extractor lets
// the visible part stream through immediately while withholding the tag —
// including a partial "<follo" at a chunk boundary — so it never flashes on
// screen.

const OPEN = "<followups>";
const CLOSE = "</followups>";
const MAX_ITEMS = 4;
const MAX_CHARS = 80;

function tryJsonArray(text: string): string[] | null {
  try {
    const parsed: unknown = JSON.parse(text);
    if (Array.isArray(parsed)) return parsed.filter((x): x is string => typeof x === "string");
  } catch {
    // fall through
  }
  return null;
}

export function parseFollowups(rawBody: string): string[] {
  const body = rawBody.replace(/^\s*```[a-z]*\s*/i, "").replace(/\s*```\s*$/, "").trim();
  let items = tryJsonArray(body);
  if (!items) {
    // Truncated output: grab from the first "[" and close the array.
    const match = /\[[\s\S]*/.exec(body);
    if (match) {
      const text = match[0].trimEnd();
      items = tryJsonArray(text.endsWith("]") ? text : `${text.replace(/,$/, "")}]`);
    }
  }
  if (!items) {
    items = body
      .split("\n")
      .filter((line) => !/^\s*[[\]`]*\s*$/.test(line))
      .map((line) =>
        line
          .replace(/^\s*(?:[-*]|\d+[.)])\s*/, "")
          .replace(/,\s*$/, "")
          .replace(/^["'](.*)["']$/, "$1")
      );
  }
  return items
    .map((item) => item.trim().slice(0, MAX_CHARS))
    .filter(Boolean)
    .slice(0, MAX_ITEMS);
}

// Instances are single-use; any text after </followups> is discarded.
export class FollowupExtractor {
  private pending = "";
  private captured: string | null = null;

  /** Feed a model chunk; returns the text that is safe to show now. */
  push(chunk: string): string {
    if (this.captured !== null) {
      this.captured += chunk;
      return "";
    }
    this.pending += chunk;
    const index = this.pending.indexOf(OPEN);
    if (index >= 0) {
      const visible = this.pending.slice(0, index);
      this.captured = this.pending.slice(index + OPEN.length);
      this.pending = "";
      return visible;
    }
    let hold = 0;
    for (let k = Math.min(OPEN.length - 1, this.pending.length); k > 0; k--) {
      if (OPEN.startsWith(this.pending.slice(-k))) {
        hold = k;
        break;
      }
    }
    const visible = this.pending.slice(0, this.pending.length - hold);
    this.pending = this.pending.slice(this.pending.length - hold);
    return visible;
  }

  finish(): { tail: string; followups: string[] } {
    if (this.captured === null) {
      const tail = this.pending;
      this.pending = "";
      return { tail, followups: [] };
    }
    const body = this.captured.split(CLOSE)[0] ?? "";
    return { tail: "", followups: parseFollowups(body.trim()) };
  }
}
