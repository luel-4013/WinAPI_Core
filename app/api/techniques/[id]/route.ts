import { NextResponse } from "next/server";
import { loadTechniques, loadFunctions } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const key = id.toUpperCase().trim();
  const tech = loadTechniques().find((t) => t.id === key);
  if (!tech) return NextResponse.json({ ok: false, error: "technique not found" }, { status: 404 });

  const funcs = loadFunctions().filter((f) => f.techniques.some((t) => t.id === key));
  return NextResponse.json({ ok: true, data: { ...tech, functions: funcs } });
}