import { NextResponse } from "next/server";
import { loadFunctions } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const key = id.toLowerCase();
  const fn = loadFunctions().find((f) => f.id === key || f.name.toLowerCase() === key);
  if (!fn) return NextResponse.json({ ok: false, error: "function not found" }, { status: 404 });
  return NextResponse.json({ ok: true, data: fn });
}