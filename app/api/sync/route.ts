import { NextResponse } from "next/server";
import { runFastSync, isRunning } from "@/lib/sync";
import { resetStatus, getStatus } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (isRunning()) return NextResponse.json({ ok: false, error: "sync already in progress" }, { status: 409 });
  const force = new URL(req.url).searchParams.get("force") === "1";
  // kick off sync in background; the status endpoint polls progress
  runFastSync(force).catch((e) => console.error("background sync error", e));
  return NextResponse.json({ ok: true, status: getStatus() });
}

export async function DELETE() {
  resetStatus();
  return NextResponse.json({ ok: true });
}