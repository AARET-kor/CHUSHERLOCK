// Dependency-free lexical retrieval over the note corpus (BM25-lite).
//
// This is the first stage of "Ask Cognitio": given a clinical question, rank
// the doctor's own notes by relevance so only the most relevant handful are
// sent to the model for synthesis. No embedding service, no vector DB — a
// personal knowledge base of hundreds-to-thousands of notes ranks well with
// field-weighted, IDF-scaled token overlap, and it runs instantly offline.
//
// The mixed KO/EN note style is handled by tokenizing on non-letter/number
// boundaries (so "혈관", "폐색", "hyaluronidase", "24-72" all become tokens)
// plus CJK bigrams (so "혈관폐색" written without a space still matches
// "혈관" + "관폐" + "폐색"). Latin single characters are dropped as noise;
// CJK single characters are kept because one Hangul syllable carries meaning.

export interface RetrievableNote {
  id: string;
  title: string;
  tags: string[];
  content: string;
  categoryKey: string;
}

export interface RetrievedNote<T extends RetrievableNote = RetrievableNote> {
  note: T;
  score: number;
}

const CJK = /[ㄱ-힝一-鿿]/;

/** Tokenize into scoring terms. For CJK, use bigrams as the unit (standard
 * CJK indexing) so space-less compounds overlap the spaced form — single
 * syllables are too noisy (one syllable like "관" appears in unrelated words
 * "무관한"/"혈관"), so a bare syllable is emitted only for a length-1 word.
 * Latin/number runs of length ≥ 2 are kept as-is. */
export function tokenize(text: string): string[] {
  const lowered = text.toLowerCase();
  const words = lowered.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  const tokens: string[] = [];
  for (const word of words) {
    if (CJK.test(word)) {
      const chars = Array.from(word);
      const cjk = chars.filter((c) => CJK.test(c));
      if (cjk.length === 1) {
        tokens.push(cjk[0]!);
      } else {
        for (let i = 0; i + 1 < chars.length; i++) {
          if (CJK.test(chars[i]!) && CJK.test(chars[i + 1]!)) {
            tokens.push(chars[i]! + chars[i + 1]!);
          }
        }
      }
      // keep any latin/number run embedded in a mixed word
      for (const latin of word.match(/[a-z0-9]{2,}/g) ?? []) tokens.push(latin);
    } else if (word.length >= 2) {
      tokens.push(word);
    }
  }
  return tokens;
}

interface IndexedDoc<T> {
  note: T;
  tf: Map<string, number>;
  length: number;
}

const FIELD_WEIGHTS = { title: 3, tags: 2, content: 1 } as const;
const BM25_K1 = 1.4;
const BM25_B = 0.72;

function buildDoc<T extends RetrievableNote>(note: T): IndexedDoc<T> {
  const tf = new Map<string, number>();
  const add = (text: string, weight: number) => {
    for (const tok of tokenize(text)) tf.set(tok, (tf.get(tok) ?? 0) + weight);
  };
  add(note.title, FIELD_WEIGHTS.title);
  add(note.tags.join(" "), FIELD_WEIGHTS.tags);
  add(note.content, FIELD_WEIGHTS.content);
  let length = 0;
  for (const v of tf.values()) length += v;
  return { note, tf, length };
}

/** Rank notes against a question with a BM25-lite score, returning the top
 * `limit` above a small floor. Pure and deterministic — unit tested. */
export function retrieve<T extends RetrievableNote>(
  question: string,
  notes: T[],
  limit = 16
): Array<RetrievedNote<T>> {
  if (notes.length === 0) return [];
  const docs = notes.map(buildDoc);
  const N = docs.length;
  const avgLen = docs.reduce((s, d) => s + d.length, 0) / N || 1;

  const df = new Map<string, number>();
  for (const doc of docs) {
    for (const tok of doc.tf.keys()) df.set(tok, (df.get(tok) ?? 0) + 1);
  }

  const qTokens = Array.from(new Set(tokenize(question)));
  if (qTokens.length === 0) return [];

  const idf = (tok: string) => {
    const n = df.get(tok) ?? 0;
    return Math.log(1 + (N - n + 0.5) / (n + 0.5));
  };

  const scored = docs.map((doc) => {
    let score = 0;
    for (const tok of qTokens) {
      const f = doc.tf.get(tok);
      if (!f) continue;
      const denom = f + BM25_K1 * (1 - BM25_B + BM25_B * (doc.length / avgLen));
      score += idf(tok) * ((f * (BM25_K1 + 1)) / denom);
    }
    return { note: doc.note, score };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
