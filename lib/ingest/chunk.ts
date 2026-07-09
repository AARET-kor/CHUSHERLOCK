// Sequential, boundary-respecting chunking for long documents.
//
// The classification pipeline reads a document front-to-back, carrying a
// rolling context summary between chunks — so chunks must preserve document
// order and should break at natural boundaries (headings first, then blank
// lines, then sentence ends) rather than mid-thought.

export const DEFAULT_MAX_CHUNK_CHARS = 24_000;

const HEADING_PATTERN = /^(#{1,6}\s|\d+(\.\d+)*\s+\S|CHAPTER\s+\d+|Chapter\s+\d+|제\s*\d+\s*[장절편]|[IVXLC]+\.\s)/;

function isHeadingLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length > 120) return false;
  return HEADING_PATTERN.test(trimmed);
}

/** Split into paragraph-ish blocks, tagging blocks that look like headings. */
function splitBlocks(text: string): Array<{ text: string; isHeading: boolean }> {
  return text
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => ({
      text: block,
      isHeading: isHeadingLine(block.split("\n")[0] ?? "") && block.length < 200,
    }));
}

/** Hard-split an oversized single block at sentence/newline boundaries. */
function splitOversizedBlock(block: string, maxChars: number): string[] {
  const pieces: string[] = [];
  let rest = block;
  while (rest.length > maxChars) {
    const window = rest.slice(0, maxChars);
    const breakAt = Math.max(
      window.lastIndexOf("\n"),
      window.lastIndexOf(". "),
      window.lastIndexOf("다. "),
      window.lastIndexOf("。")
    );
    const cut = breakAt > maxChars * 0.3 ? breakAt + 1 : maxChars;
    pieces.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut);
  }
  if (rest.trim()) pieces.push(rest.trim());
  return pieces;
}

/**
 * Split `text` into ordered chunks of at most `maxChars`, preferring to start
 * new chunks at heading boundaries so each chunk maps roughly onto the
 * document's own 목차 structure.
 */
export function chunkDocument(text: string, maxChars = DEFAULT_MAX_CHUNK_CHARS): string[] {
  const blocks = splitBlocks(text);
  const chunks: string[] = [];
  let current: string[] = [];
  let currentLength = 0;

  const flush = () => {
    if (current.length > 0) {
      chunks.push(current.join("\n\n"));
      current = [];
      currentLength = 0;
    }
  };

  for (const block of blocks) {
    const pieces = block.text.length > maxChars ? splitOversizedBlock(block.text, maxChars) : [block.text];

    for (const piece of pieces) {
      const wouldOverflow = currentLength + piece.length + 2 > maxChars;
      // Prefer breaking before a heading once the chunk is reasonably full,
      // so section starts line up with chunk starts.
      const headingBreak = block.isHeading && currentLength > maxChars * 0.5;
      if ((wouldOverflow || headingBreak) && current.length > 0) flush();
      current.push(piece);
      currentLength += piece.length + 2;
    }
  }
  flush();

  return chunks;
}
