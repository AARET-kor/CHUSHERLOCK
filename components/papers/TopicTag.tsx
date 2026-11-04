// components/papers/TopicTag.tsx
import { majorOf } from "../../lib/records/taxonomy";
import { TOPICS } from "../../lib/papers/topics";
import type { TopicKey } from "../../lib/papers/types";

/** Same colour family as the Records category tags. */
export function TopicTag({ topic }: { topic: TopicKey }) {
  const def = TOPICS[topic];
  const { color } = majorOf(def.major);
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[12px] leading-tight" style={{ background: color.bg, borderColor: color.border, color: color.text }}>
      <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full" style={{ background: color.dot }} />
      <span className="font-semibold">{def.en}</span>
      <span>{def.ko}</span>
    </span>
  );
}
