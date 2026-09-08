import { NextResponse } from "next/server";
import { runCatalogSync, isCatalogRunning } from "@/lib/sync";
import { getStatus } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (isCatalogRunning()) return NextResponse.json({ ok: false, error: "catalog sync already in progress" }, { status: 409 });
  const body = await req.json().catch(() => ({}));
  const materialize = Boolean(body.materialize);
  runCatalogSync(materialize).catch((e) => console.error("catalog sync error", e));
  return NextResponse.json({ ok: true, materialize, status: getStatus() });
}