import { NextResponse } from "next/server";
import { loadFunctions } from "@/lib/db";
import { readCatalogDoc } from "@/lib/sync/catalog";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const key = id.toLowerCase();
  const fn = loadFunctions().find((f) => f.id === key || f.name.toLowerCase() === key);
  if (!fn?.localDoc) return NextResponse.json({ ok: false, error: "no local doc available" }, { status: 404 });
  const doc = readCatalogDoc(fn.localDoc);
  if (!doc) return NextResponse.json({ ok: false, error: "could not read doc" }, { status: 500 });
  return NextResponse.json({ ok: true, data: doc });
}