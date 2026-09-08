import { NextResponse } from "next/server";
import { loadTechniques, loadFunctions } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.toLowerCase().trim() ?? "";
  const tactic = url.searchParams.get("tactic")?.trim()?.toLowerCase();
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10) || 1);
  const perPage = Math.min(500, Math.max(1, parseInt(url.searchParams.get("perPage") ?? "100", 10) || 100));

  let techs = loadTechniques();
  const funcCountByTechnique = new Map<string, number>();
  for (const f of loadFunctions()) {
    for (const t of f.techniques) {
      funcCountByTechnique.set(t.id, (funcCountByTechnique.get(t.id) ?? 0) + 1);
    }
  }

  if (q) {
    techs = techs.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.id.toLowerCase().includes(q) ||
        t.tactic.toLowerCase().includes(q)
    );
  }
  if (tactic) techs = techs.filter((t) => t.tactics.some((tac) => tac.toLowerCase().includes(tactic)));

  // Get unique tactics
  const tacticSet = new Set<string>();
  for (const t of techs) for (const tac of t.tactics) tacticSet.add(tac);

  const total = techs.length;
  const start = (page - 1) * perPage;
  const items = techs.slice(start, start + perPage).map((t) => ({
    ...t,
    functionCount: funcCountByTechnique.get(t.id) ?? 0,
  }));

  return NextResponse.json({
    items,
    total,
    page,
    perPage,
    totalPages: Math.ceil(total / perPage),
    tactics: [...tacticSet].sort().map((id) => ({ id })),
  });
}