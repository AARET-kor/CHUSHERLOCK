import { redirect } from "next/navigation";

// The intake dock now lives on the dashboard — keep old links working.
export default function IngestPage() {
  redirect("/");
}
