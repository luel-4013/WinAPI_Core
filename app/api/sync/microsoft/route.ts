import { NextResponse } from "next/server";
import { runMsSync, isMsRunning } from "@/lib/sync/microsoft";
import { getStatus } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (isMsRunning()) return NextResponse.json({ ok: false, error: "microsoft sync already in progress" }, { status: 409 });
  const url = new URL(req.url);
  const force = url.searchParams.get("force") === "1";
  const limit = url.searchParams.get("limit") ? Number(url.searchParams.get("limit")) : undefined;
  runMsSync(force, limit).catch((e) => console.error("microsoft sync error", e));
  return NextResponse.json({ ok: true, status: getStatus() });
}

export async function DELETE() {
  const { resetStatus } = await import("@/lib/db");
  resetStatus();
  return NextResponse.json({ ok: true });
}