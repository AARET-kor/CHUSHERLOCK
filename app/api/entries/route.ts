import { NextResponse } from "next/server";
import { createEntrySchema } from "../../../lib/schemas/entrySchemas";
import * as entryService from "../../../lib/services/entryService";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const entries = await entryService.listEntries({
    categoryKey: searchParams.get("categoryKey") ?? undefined,
    tier: searchParams.get("tier") ?? undefined,
    status: searchParams.get("status") ?? undefined,
  });
  return NextResponse.json({ entries });
}

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = createEntrySchema.safeParse(body);

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (typeof key === "string" && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return NextResponse.json(
      { error: "입력값을 확인해 주세요.", fieldErrors },
      { status: 400 }
    );
  }

  const result = await entryService.createEntry(parsed.data);
  return NextResponse.json(result, { status: 201 });
}
