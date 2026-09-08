import fs from "node:fs";
import path from "node:path";
import { load as loadCheerio } from "cheerio";
import { CATEGORIES, type ApiFunction, type Category } from "../types";
import { RAW_DIR, appendLog } from "../db";
import { fetchText, sleep, stripHtml, withConcurrency } from "../http";
import { categoryTechniques, normalizeKey, overrideTechniques } from "./category-map";

const MALAPI_BASE = "https://malapi.io";
const MALAPI_RAW_DIR = path.join(RAW_DIR, "malapi");
const MALAPI_HOME_FILE = path.join(MALAPI_RAW_DIR, "homepage.html");

export function malapiSourceCached(): boolean {
  return fs.existsSync(MALAPI_HOME_FILE);
}

function cachePage(name: string, html: string) {
  fs.mkdirSync(MALAPI_RAW_DIR, { recursive: true });
  fs.writeFileSync(path.join(MALAPI_RAW_DIR, `${normalizeKey(name)}.html`), html);
}

function cachedPage(name: string): string | null {
  const p = path.join(MALAPI_RAW_DIR, `${normalizeKey(name)}.html`);
  return fs.existsSync(p) ? fs.readFileSync(p, "utf8") : null;
}

/** Load the category index, cache-first. Returns null only if we are offline with no cache. */
async function fetchHomepage(force = false): Promise<{ html: string; cached: boolean } | null> {
  const cacheHit = !force && fs.existsSync(MALAPI_HOME_FILE) ? fs.readFileSync(MALAPI_HOME_FILE, "utf8") : null;
  if (cacheHit) return { html: cacheHit, cached: true };
  try {
    const html = await fetchText(MALAPI_BASE, 40_000);
    fs.mkdirSync(MALAPI_RAW_DIR, { recursive: true });
    fs.writeFileSync(MALAPI_HOME_FILE, html);
    return { html, cached: false };
  } catch (e) {
    appendLog(`malapi.io: homepage fetch failed (${(e as Error).message})`);
    return null;
  }
}

/** Offline fallback: rebuild name→category index from the cached function pages. */
function byNameFromPageCache(): Map<string, { categories: Set<Category> }> {
  const m = new Map<string, { categories: Set<Category> }>();
  let files: string[];
  try {
    files = fs.readdirSync(MALAPI_RAW_DIR).filter((f) => /^[^.]+\.html$/.test(f));
  } catch {
    return m;
  }
  for (const file of files) {
    const key = file.replace(/\.html$/, "");
    const p = parsePage(fs.readFileSync(path.join(MALAPI_RAW_DIR, file), "utf8"), key);
    if (!m.has(key)) m.set(key, { categories: new Set<Category>(p.attacks) });
    else for (const c of p.attacks) m.get(key)!.categories.add(c);
  }
  return m;
}

interface CategoryListing {
  category: Category;
  functions: string[];
}

/** Parse the homepage: category columns -> function lists. */
export function parseHomepage(html: string): CategoryListing[] {
  const $ = loadCheerio(html);
  const trs = $("#scrollable-table-body").find("tr");
  let cats: Category[] = [];
  let columns: string[][] = [];

  for (let i = 0; i < trs.length; i++) {
    const ths = trs.eq(i).children("th");
    if (ths.length) {
      cats = ths
        .map((_, el) => $(el).text().trim() as Category)
        .get()
        .filter((c) => CATEGORIES.includes(c));
      continue;
    }
    const tds = trs.eq(i).children("td");
    if (!tds.length || columns.length) continue;
    const col: string[][] = [];
    tds.each((j, td) => {
      col[j] = $(td)
        .find('a[href^="/winapi/"]')
        .map((_, a) => $(a).attr("href")!.replace("/winapi/", "").trim())
        .get();
    });
    columns = col;
    break;
  }

  const out: CategoryListing[] = [];
  for (let j = 0; j < cats.length; j++) {
    const funcs = columns[j] || [];
    if (funcs.length) out.push({ category: cats[j], functions: funcs });
  }
  return out;
}

/**
 * A few malapi.io pages are occasionally blocked by their bot protection (HTTP 406).
 * Keep a tiny offline fallback so those functions stay fully populated.
 */
const FALLBACK_PAGES: Record<string, Omit<ParsedPage, "name">> = {
  readfile: {
    description:
      "Reads data from the specified file or input/output (I/O) device. Reads occur at the position specified by the file pointer.",
    dll: "Kernel32.dll",
    attacks: ["Enumeration"],
    docsUrl: "https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-readfile",
    credits: "msdn",
  },
  findnextfilew: {
    description:
      "Continues a file search from a previous FindFirstFile/FindFirstFileEx call. Commonly used during directory enumeration.",
    dll: "Kernel32.dll",
    attacks: ["Enumeration"],
    docsUrl: "https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-findnextfilew",
    credits: "msdn",
  },
};

async function fetchPage(name: string, force = false): Promise<string> {
  const cached = !force ? cachedPage(name) : null;
  if (cached) return cached;
  const html = await fetchText(`${MALAPI_BASE}/winapi/${encodeURIComponent(name)}`, 25_000);
  cachePage(name, html);
  return html;
}

function pageWithFallback(name: string, parsed: ParsedPage): ParsedPage {
  const fallback = FALLBACK_PAGES[normalizeKey(name)];
  if (!fallback) return parsed;
  return {
    name: parsed.name || name,
    description: parsed.description || fallback.description,
    dll: parsed.dll || fallback.dll,
    attacks: parsed.attacks.length ? parsed.attacks : fallback.attacks,
    docsUrl: parsed.docsUrl || fallback.docsUrl,
    credits: parsed.credits || fallback.credits,
  };
}

interface ParsedPage {
  name: string;
  description: string;
  dll: string;
  attacks: Category[];
  docsUrl?: string;
  credits: string;
}

export function parsePage(html: string, fallbackName: string): ParsedPage {
  const $ = loadCheerio(html);
  const out: ParsedPage = { name: fallbackName, description: "", dll: "", attacks: [], credits: "" };

  $(".detail-container").each((_, el) => {
    const heading = $(".heading", el).text().trim();
    switch (heading) {
      case "Function Name":
        out.name = $(".content", el).text().trim() || fallbackName;
        break;
      case "Description": {
        const t = $(".content", el).text().trim();
        out.description = stripHtml(t);
        break;
      }
      case "Library":
        out.dll = $(".content", el).text().trim();
        break;
      case "Associated Attacks":
        $(".attack-container", el).each((_, a) => {
          const c = $(a).text().trim() as Category;
          if (CATEGORIES.includes(c)) out.attacks.push(c);
        });
        break;
      case "Documentation":
        out.docsUrl = $("a.link", el).attr("href")?.trim();
        break;
      default:
        break;
    }
  });

  const meta = $(".square-box").text().trim();
  out.credits = meta.replace(/\s+/g, " ").slice(0, 500);
  return out;
}

function msToGithubUrl(docsUrl: string): { github?: string; learn?: string } {
  // docs.microsoft.com/en-us/windows/win32/api/<ns>/nf-<ns>-<name> -> sdk-api path
  const m = docsUrl.match(/\/windows\/win32\/api\/([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)/);
  if (!m) return {};
  const ns = m[1];
  const file = m[2];
  const github = `https://github.com/MicrosoftDocs/sdk-api/blob/main/sdk-api-src/content/${ns}/${file}.md`;
  const learn = docsUrl.replace("docs.microsoft.com", "learn.microsoft.com");
  return { github, learn };
}

export async function fetchMalapiFunctions(
  onProgress?: (done: number, total: number) => void,
  force = false
): Promise<ApiFunction[]> {
  const home = await fetchHomepage(force);
  let byName: Map<string, { categories: Set<Category> }>;
  if (home) {
    appendLog(
      home.cached ? "malapi.io: index loaded from local cache (offline-capable)" : "malapi.io: index downloaded"
    );
    const listings = parseHomepage(home.html);
    byName = new Map<string, { categories: Set<Category> }>();
    for (const l of listings) {
      for (const fn of l.functions) {
        const k = normalizeKey(fn);
        if (!byName.has(k)) byName.set(k, { categories: new Set<Category>() });
        byName.get(k)!.categories.add(l.category);
      }
    }
  } else {
    appendLog("malapi.io: offline — rebuilding index from local page cache");
    byName = byNameFromPageCache();
  }

  const names = [...byName.keys()];
  appendLog(`malapi.io: ${names.length} unique functions indexed`);

  const funcs: ApiFunction[] = [];
  let done = 0;

  await withConcurrency(names, 6, async (key) => {
    const name = names.find((n) => normalizeKey(n) === key)!;
    let page: ParsedPage;
    try {
      const raw = await fetchPage(name, force);
      page = pageWithFallback(name, parsePage(raw, name));
      cachePage(key, raw);
    } catch (e) {
      appendLog(`malapi.io: skip ${name} (${(e as Error).message})`);
      page = pageWithFallback(name, { name, description: "", dll: "", attacks: [], credits: "" });
    }
    const cats = new Set<Category>([...(byName.get(key)?.categories ?? []), ...page.attacks]);
    const docsUrl = page.docsUrl || `https://malapi.io/winapi/${encodeURIComponent(name)}`;
    const { github, learn } = msToGithubUrl(docsUrl);
    const techniques = overrideTechniques(name) ?? categoryTechniques([...cats]);

    funcs.push({
      id: key,
      name: page.name || name,
      aliases: page.name && page.name !== name ? [name] : [],
      dll: page.dll || "Unknown",
      categories: [...cats],
      description:
        page.description ||
        `Windows API function referenced by malapi.io — categorized under: ${[...cats].join(", ")}.`,
      docsUrl,
      docs: [
        ...(learn ? [{ label: "Microsoft Learn", url: learn }] : []),
        ...(github ? [{ label: "GitHub (source)", url: github }] : []),
        { label: "MalAPI.io", url: `https://malapi.io/winapi/${encodeURIComponent(name)}` },
      ],
      sources: ["malapi"],
      techniques,
      credit: page.credits,
    });

    done++;
    onProgress?.(done, names.length);
    await sleep(40);
  });

  appendLog(`malapi.io: imported ${funcs.length} functions`);
  return funcs;
}

/** Offline reindex: reconstruct malapi functions from cached pages + homepage. */
export function reindexMalapiFromCache(homeHtml: string): ApiFunction[] {
  const listings = parseHomepage(homeHtml);
  const byName = new Map<string, Set<Category>>();
  for (const l of listings) {
    for (const fn of l.functions) {
      const k = normalizeKey(fn);
      if (!byName.has(k)) byName.set(k, new Set());
      byName.get(k)!.add(l.category);
    }
  }
  const funcs: ApiFunction[] = [];
  for (const [key, cats] of byName) {
    const cached = cachedPage(key);
    const base = cached
      ? parsePage(cached, key)
      : ({ name: key, description: "", dll: "", attacks: [] as Category[], credits: "" } as ParsedPage);
    const page = pageWithFallback(key, base);
    const allCats = [...new Set<Category>([...cats, ...page.attacks])];
    const docsUrl = page.docsUrl || `https://malapi.io/winapi/${encodeURIComponent(page.name)}`;
    const { github, learn } = msToGithubUrl(docsUrl);
    funcs.push({
      id: key,
      name: page.name || key,
      aliases: [],
      dll: page.dll || "Unknown",
      categories: allCats,
      description: page.description || "",
      docsUrl,
      docs: [
        ...(learn ? [{ label: "Microsoft Learn", url: learn }] : []),
        ...(github ? [{ label: "GitHub (source)", url: github }] : []),
      ],
      sources: ["malapi"],
      techniques: overrideTechniques(key) ?? categoryTechniques(allCats),
      credit: page.credits,
    });
  }
  return funcs;
}