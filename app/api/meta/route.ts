import { NextResponse } from "next/server";
import { loadFunctions, loadTechniques, getStatus } from "@/lib/db";
import { getCatalogEntries } from "@/lib/sync/catalog";

export const dynamic = "force-dynamic";

export async function GET() {
  const fns = loadFunctions();
  const techs = loadTechniques();
  const status = getStatus();

  const categories: Record<string, number> = {};
  const dlls: Record<string, number> = {};
  const tacticMap: Record<string, number> = {};
  const srcMap: Record<string, number> = {};

  for (const f of fns) {
    for (const c of f.categories) categories[c] = (categories[c] ?? 0) + 1;
    dlls[f.dll] = (dlls[f.dll] ?? 0) + 1;
    for (const t of f.techniques) if (t.tactic) tacticMap[t.tactic] = (tacticMap[t.tactic] ?? 0) + 1;
    for (const s of f.sources) srcMap[s] = (srcMap[s] ?? 0) + 1;
  }

  return NextResponse.json({
    categories: Object.entries(categories)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count })),
    dlls: Object.entries(dlls)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count })),
    tactics: Object.entries(tacticMap)
      .sort((a, b) => b[1] - a[1])
      .map(([id, count]) => ({ id, count })),
    sources: Object.entries(srcMap)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count })),
    totals: { functions: fns.length, techniques: techs.length, catalog: getCatalogEntries().length },
    status,
  });
}