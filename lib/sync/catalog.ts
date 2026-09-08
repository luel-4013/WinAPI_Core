import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { CATALOG_DIR, CATALOG_INDEX_FILE, appendLog, updateStatus } from "../db";
import type { ApiFunction } from "../types";

const exec = promisify(execFile);

const SDK_API_REPO = "https://github.com/MicrosoftDocs/sdk-api.git";
const SDK_DIR = path.join(CATALOG_DIR, "sdk-api");

export interface CatalogEntry {
  name: string; // function name (from filename, e.g. CreateFileA)
  ns: string; // api namespace (e.g. fileapi)
  path: string; // repo-relative markdown path
  url: string; // learn.microsoft.com URL
  github: string; // raw github URL
  localDoc: string; // absolute local path after materialize ('' if not downloaded)
}

function git(...args: string[]): Promise<string> {
  return exec("git", args, { maxBuffer: 64 * 1024 * 1024 }).then((r) => r.stdout);
}

export function getCatalogEntries(): CatalogEntry[] {
  if (!fs.existsSync(CATALOG_INDEX_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(CATALOG_INDEX_FILE, "utf8"));
  } catch {
    return [];
  }
}

function learnUrl(ns: string, file: string): string {
  return `https://learn.microsoft.com/en-us/windows/win32/api/${ns}/${file.replace(/\.md$/i, "")}`;
}

/** Index all documented Win32 functions by name (no content download). */
export async function indexCatalog(): Promise<CatalogEntry[]> {
  updateStatus({ catalogStage: "indexing", syncing: true, stage: "catalog:index", progress: 0.6 });
  const start = Date.now();
  try {
    fs.mkdirSync(CATALOG_DIR, { recursive: true });
    if (!fs.existsSync(path.join(SDK_DIR, ".git"))) {
      appendLog("catalog: cloning MicrosoftDocs/sdk-api (tree index only, no content blobs)");
      await git("clone", "--depth", "1", "--filter=blob:none", "--no-checkout", "--single-branch", "--branch", "docs", SDK_API_REPO, SDK_DIR);
    }
    appendLog("catalog: enumerating function index (git ls-tree)");
    const output = await git("-C", SDK_DIR, "ls-tree", "-r", "--name-only", "HEAD");
    const files = output.split("\n").filter((f) => /content\/[^/]+\/nf-[^/]+\.md$/.test(f));

    const entries: CatalogEntry[] = files.map((f) => {
      const m = f.match(/content\/([^/]+)\/(nf-[^/]+\.md)$/);
      const ns = m![1];
      const file = m![2];
      const name = file.replace(/^nf-[^-]+-/, "").replace(/\.md$/, "");
      return {
        name,
        ns,
        path: f,
        url: learnUrl(ns, file),
        github: `https://github.com/MicrosoftDocs/sdk-api/blob/docs/sdk-api-src/${f}`,
        localDoc: "",
      };
    });

    fs.writeFileSync(CATALOG_INDEX_FILE, JSON.stringify(entries));
    appendLog(`catalog: indexed ${entries.length} functions (${Math.round((Date.now() - start) / 1000)}s)`);
    updateStatus({ catalogStage: "done", progress: 1 });
    return entries;
  } catch (e) {
    appendLog(`catalog: index failed: ${(e as Error).message}`);
    updateStatus({ catalogStage: "error", error: (e as Error).message });
    throw e;
  } finally {
    updateStatus({ syncing: false });
  }
}

/** Download the actual markdown content (very large) so descriptions are local + offline. */
export async function materializeCatalog(): Promise<CatalogEntry[]> {
  updateStatus({ catalogStage: "materializing", syncing: true, stage: "catalog:content" });
  try {
    if (!fs.existsSync(path.join(SDK_DIR, ".git"))) {
      await indexCatalog();
    }
    appendLog("catalog: downloading full API reference content — can take a while (several hundred MB)");
    await git("-C", SDK_DIR, "checkout", "HEAD");

    const entries = getCatalogEntries();
    for (const e of entries) {
      const local = path.join(SDK_DIR, e.path);
      if (fs.existsSync(local)) e.localDoc = local;
    }
    fs.writeFileSync(CATALOG_INDEX_FILE, JSON.stringify(entries));
    appendLog("catalog: full content downloaded — descriptions now available offline");
    updateStatus({ catalogStage: "done", progress: 1 });
    return entries;
  } catch (e) {
    appendLog(`catalog: materialize failed: ${(e as Error).message}`);
    updateStatus({ catalogStage: "error", error: (e as Error).message });
    throw e;
  } finally {
    updateStatus({ syncing: false });
  }
}

/** Read frontmatter (YAML) + first paragraph from a catalog markdown doc. */
export function readCatalogDoc(localPath: string): { description: string; dll: string; apiName: string; title?: string } | null {
  try {
    const md = fs.readFileSync(localPath, "utf8").replace(/\r\n/g, "\n");
    const fmMatch = md.match(/^---\n([\s\S]*?)\n---\n?/);
    const fm: Record<string, string> = {};
    if (fmMatch) {
      for (const line of fmMatch[1].split("\n")) {
        const m = line.match(/^([a-zA-Z.\-_]+):\s*(.*)$/);
        if (m) fm[m[1].trim()] = m[2].trim();
      }
    }
    const body = md.replace(/^---\n[\s\S]*?\n---\n?/, "");
    const para = body
      .replace(/```[\s\S]*?```/g, "")
      .replace(/[<#>*`]/g, "")
      .split(/\n{2,}/)
      .map((s) => s.replace(/\s+/g, " ").trim())
      .find((s) => s.length > 40);
    return {
      description: (fm.description || para?.slice(0, 400) || "").replace(/\\_/g, "_"),
      dll: (fm.api_location ?? fm.dll ?? "").split(",")[0] || "",
      apiName: fm.api_name || "",
      title: fm.title || "",
    };
  } catch {
    return null;
  }
}

/** Merge catalog entries into the master function list. */
export function mergeCatalogFunctions(entries: CatalogEntry[], existing: ApiFunction[]): ApiFunction[] {
  const byKey = new Map(existing.map((f) => [f.id.toLowerCase(), f]));
  const seen = new Set(byKey.keys());
  let added = 0;
  let enriched = 0;

  for (const e of entries) {
    const key = e.name.toLowerCase();
    const doc = e.localDoc ? readCatalogDoc(e.localDoc) : null;
    const existingFn = byKey.get(key);
    if (existingFn) {
      existingFn.sources = [...new Set([...existingFn.sources, "catalog"])] as import("../types").ApiSource[];
      existingFn.aliases = [...new Set([...existingFn.aliases, e.name])];
      existingFn.localDoc = e.localDoc || existingFn.localDoc;
      if (doc && !existingFn.description) existingFn.description = doc.description;
      if (doc && doc.dll && existingFn.dll === "Unknown") existingFn.dll = doc.dll;
      const docUrl = e.url.replace(/\.md$/i, "");
    if (docUrl && !existingFn.docs.some((d) => d.url === docUrl)) {
      existingFn.docs.push({ label: "Microsoft Learn", url: docUrl });
    }
      enriched++;
      continue;
    }
    if (seen.has(key)) continue;
    seen.add(key);
    byKey.set(key, {
      id: key,
      name: e.name,
      aliases: [],
      dll: doc?.dll || "Unknown",
      categories: [],
      description:
        doc?.description ||
        `Documented Win32 API (${e.ns}). Content not downloaded — enable the full catalog download for local descriptions.`,
      docs: [{ label: "Microsoft Learn", url: e.url.replace(/\.md$/i, "") }, { label: "GitHub (source)", url: e.github }],
      sources: ["catalog"],
      techniques: [],
      localDoc: e.localDoc,
    });
    added++;
  }

  appendLog(`catalog: merged ${added} new functions, enriched ${enriched}`);
  return [...byKey.values()];
}

// keep type import of ApiFunction honest w/ localDoc being optional in practice
export type { ApiFunction };