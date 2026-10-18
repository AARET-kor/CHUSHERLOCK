import { redirect } from "next/navigation";

// The intake dock now lives on the knowledge-base dashboard (/kb) — keep
// old links working.
export default function IngestPage() {
  redirect("/kb#ingest-dock");
}
