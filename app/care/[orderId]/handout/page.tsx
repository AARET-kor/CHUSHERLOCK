// app/care/[orderId]/handout/page.tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { HandoutActions } from "../../../../components/bbip/care/HandoutActions";
import { HANDOUT_FOOTER, handoutSections, handoutText, seoulDay } from "../../../../lib/bbip/care/format";
import { caseText } from "../../../../lib/bbip/care/interactions";
import { orderReady } from "../../../../lib/bbip/care/lint";
import { getSession } from "../../../../lib/services/bbipService";
import { getCareOrderById } from "../../../../lib/services/careService";

// Reads live from SQLite — never prerender.
export const dynamic = "force-dynamic";

/** Printable patient handout — confirmed rows only, no patient name. */
export default async function HandoutPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const order = getCareOrderById(orderId);
  if (!order) notFound();
  const session = getSession(order.sessionId);
  const ready = session ? orderReady(order.items, caseText(session.chips, session.flags)) : false;

  if (!ready) {
    return (
      <div className="mx-auto max-w-[680px] py-16">
        <p className="text-[16px] text-ink/70">모든 행을 확인한 뒤에 안내문을 볼 수 있습니다.</p>
        <Link
          href={`/?s=${order.sessionId}`}
          className="mt-4 inline-block font-semibold text-ink underline decoration-ink/30 underline-offset-4"
        >
          케이스로 돌아가기
        </Link>
      </div>
    );
  }

  const sections = handoutSections(order.items, seoulDay(order.createdAt));
  return (
    <article className="mx-auto max-w-[680px] py-10 print:max-w-none print:py-0">
      <h1 className="font-serifa text-[30px] font-bold text-inkdeep">시술 후 안내</h1>
      {sections.map((section) => (
        <section key={section.title} className="mt-8">
          <h2 className="border-b border-ink/15 pb-1 text-[18px] font-bold text-inkdeep">{section.title}</h2>
          <ul className="mt-3 space-y-2">
            {section.lines.map((line) => (
              <li key={line} className="text-[16.5px] leading-relaxed text-ink">
                {line}
              </li>
            ))}
          </ul>
        </section>
      ))}
      <p className="mt-10 text-[15px] text-ink/70">{HANDOUT_FOOTER}</p>
      <HandoutActions text={handoutText(sections)} />
    </article>
  );
}
