import { NextResponse } from "next/server";
import { loadFunctions } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.toLowerCase().trim() ?? "";
  const category = url.searchParams.get("category")?.trim();
  const dll = url.searchParams.get("dll")?.trim();
  const technique = url.searchParams.get("technique")?.trim();
  const tactic = url.searchParams.get("tactic")?.trim();
  const source = url.searchParams.get("source")?.trim();
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10) || 1);
  const perPage = Math.min(200, Math.max(1, parseInt(url.searchParams.get("perPage") ?? "60", 10) || 60));
  const idsParam = url.searchParams.get("ids");

  let fns = loadFunctions();

  if (idsParam) {
    const idSet = new Set(idsParam.split(",").map((s) => s.toLowerCase()));
    fns = fns.filter((f) => idSet.has(f.id));
  }

  if (q) {
    fns = fns.filter((f) => {
      const hay = (f.name + " " + f.dll + " " + f.description + " " + f.categories.join(" ")).toLowerCase();
      const terms = q.split(/\s+/);
      return terms.every((t) => hay.includes(t));
    });
  }

  if (category) {
    const cats = new Set(category.split(",").map((c) => c.toLowerCase()));
    fns = fns.filter((f) => f.categories.some((c) => cats.has(c.toLowerCase())));
  }

  if (dll) {
    const d = dll.toLowerCase();
    fns = fns.filter((f) => f.dll.toLowerCase().includes(d));
  }

  if (technique) {
    const techs = new Set(technique.split(",").map((t) => t.trim().toLowerCase()));
    fns = fns.filter((f) => f.techniques.some((t) => techs.has(t.id.toLowerCase())));
  }

  if (tactic) {
    const tact = tactic.toLowerCase();
    fns = fns.filter((f) => f.techniques.some((t) => (t.tactic ?? "").toLowerCase().includes(tact)));
  }

  if (source) {
    const srcs = new Set(source.split(",").map((s) => s.trim()));
    fns = fns.filter((f) => f.sources.some((s) => srcs.has(s)));
  }

  // Facet counts (before pagination)
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

  const total = fns.length;
  const start = (page - 1) * perPage;
  const items = fns.slice(start, start + perPage);

  return NextResponse.json({
    items,
    total,
    page,
    perPage,
    totalPages: Math.ceil(total / perPage),
    facets: {
      categories: Object.entries(categories)
        .sort((a, b) => b[1] - a[1])
        .map(([name, count]) => ({ name, count })),
      dlls: Object.entries(dlls)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 50)
        .map(([name, count]) => ({ name, count })),
      tactics: Object.entries(tacticMap)
        .sort((a, b) => b[1] - a[1])
        .map(([id, count]) => ({ id, count })),
      sources: Object.entries(srcMap)
        .sort((a, b) => b[1] - a[1])
        .map(([name, count]) => ({ name, count })),
    },
  });
}