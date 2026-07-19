import { listEntries } from "../../lib/services/entryService";
import { AskClient } from "../../components/AskClient";

// Reads note count live — never statically prerendered.
export const dynamic = "force-dynamic";

export default async function AskPage() {
  const entries = await listEntries();
  return (
    <div>
      <AskClient noteCount={entries.length} />
    </div>
  );
}
