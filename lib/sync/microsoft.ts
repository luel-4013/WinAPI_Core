import fs from "node:fs";
import path from "node:path";
import { load as loadCheerio } from "cheerio";
import { RAW_DIR, appendLog, loadFunctions, saveFunctions, updateStatus } from "../db";
import { OFFLINE_MODE, fetchText, sleep, withConcurrency } from "../http";
import type { ApiFunction, MsRequirements } from "../types";

const MS_RAW_DIR = path.join(RAW_DIR, "microsoft");
const LEARN_RE = /learn\.microsoft\.com\/(?:en-us\/)?windows\/win32\/api\/([^/?#]+)\/([^/?#]+)/i;

let running = false;

export function isMsRunning() {
  return running;
}

function cacheFile(ns: string, file: string): string {
  return path.join(MS_RAW_DIR, `${ns}#${file.replace(/[/\\]/g, "-")}.html`);
}

function cachedHtml(ns: string, file: string): string | null {
  const p = cacheFile(ns, file);
  return fs.existsSync(p) ? fs.readFileSync(p, "utf8") : null;
}

/** The canonical learn.microsoft.com URL for a function, if any. */
function learnUrlFor(fn: ApiFunction): string | null {
  const candidates = [fn.docsUrl, ...(fn.docs ?? []).map((d) => d.url)];
  for (const url of candidates) {
    if (!url) continue;
    const m = url.replace("//docs.microsoft.com/", "//learn.microsoft.com/").match(LEARN_RE);
    if (m) return `https://learn.microsoft.com/en-us/windows/win32/api/${m[1]}/${m[2].replace(/\.md$/i, "")}`;
  }
  return null;
}

/**
 * Parse a learn.microsoft.com API page: Requirements table (platform/header/library/
 * DLL/min OS) + remarks section. Everything read from HTML only — no inference.
 */
export function parseMsPage(html: string): MsRequirements {
  const $ = loadCheerio(html);
  const out: MsRequirements = {};

  // Requirements rows where the left cell is a known field name (Target Platform,
  // Minimum supported client/server, Header, Library, DLL).
  // Note: MS docs puts the field name in <td><strong> not <th>, so we try both.
  $("table tr").each((_, tr) => {
    const cells = $(tr).find("td, th");
    if (cells.length < 2) return;
    const rawKey = $(cells[0]).text().replace(/\s+/g, " ").trim().toLowerCase();
    const val = $(cells[1]).text().replace(/\s+/g, " ").trim();
    if (!rawKey || !val) return;
    if (rawKey.includes("target platform")) out.platform = val;
    else if (rawKey.includes("minimum supported client")) out.minClient = val;
    else if (rawKey.includes("minimum supported server")) out.minServer = val;
    else if (rawKey.includes("header")) out.header = val;
    else if (rawKey.includes("library")) out.library = val;
    else if (rawKey.includes("dll")) out.dll = val;
  });

  const remarksHead = $("h2:contains('Remarks'), h3:contains('Remarks')").first();
  if (remarksHead.length) {
    const parts: string[] = [];
    remarksHead.nextUntil("h2, h3").each((_, el) => {
      const t = $(el).text().replace(/\s+/g, " ").trim();
      if (t && t.length > 2) parts.push(t);
    });
    const remarks = parts.join(" ").replace(/\s{2,}/g, " ").trim().replace(/\\_/g, "_");
    if (remarks.length > 30) out.remarks = remarks.slice(0, 1200);
  }

  return out;
}

/** Enrich already-loaded functions with parsed requirements. No network mutations. */
export function enrichFromMsCache(functions: ApiFunction[]): number {
  let hits = 0;
  for (const fn of functions) {
    const url = learnUrlFor(fn);
    if (!url) continue;
    const m = url.match(LEARN_RE);
    if (!m) continue;
    const html = cachedHtml(m[1], m[2]);
    if (!html) continue;
    const req = parseMsPage(html);
    if (Object.keys(req).length === 0) continue;
    fn.ms = { ...(fn.ms ?? {}), ...req };
    if (req.dll && (fn.dll === "Unknown" || !fn.dll)) fn.dll = req.dll;
    hits++;
  }
  return hits;
}

/**
 * Crawl learn.microsoft.com for every indexed function (cache-first, resumable,
 * offline-capable). Merges Requirements + Remarks into each function record.
 */
export async function runMsSync(force = false, limit?: number): Promise<void> {
  if (running) return;
  running = true;
  try {
    updateStatus({
      syncing: true,
      microsoftStage: "running",
      stage: "microsoft",
      ready: false,
      progress: 0,
      startedAt: new Date().toISOString(),
    });
    appendLog("SYNC START — fetch live Microsoft Learn metadata (Requirements/Remarks)");

    const functions = loadFunctions();
    const targets: { fn: ApiFunction; ns: string; file: string; url: string }[] = [];
    for (const fn of functions) {
      const url = learnUrlFor(fn);
      if (!url) continue;
      const m = url.match(LEARN_RE);
      if (!m) continue;
      targets.push({ fn, ns: m[1], file: m[2], url });
    }
    // Attack-relevant functions first (malapi + mapped techniques), then the rest.
    targets.sort((a, b) => Number(Boolean(b.fn.techniques?.length)) - Number(Boolean(a.fn.techniques?.length)));

    fs.mkdirSync(MS_RAW_DIR, { recursive: true });
    const toFetch = targets.filter((t) => force || !fs.existsSync(cacheFile(t.ns, t.file)));
    const subset = limit ? toFetch.slice(0, limit) : toFetch;
    appendLog(
      `${targets.length} functions have a learn.microsoft.com page; ${subset.length} to fetch (${limits(limit)}), ${
        toFetch.length - subset.length
      } skipped this run`
    );
    if (OFFLINE_MODE) appendLog("OFFLINE MODE — skipping downloads, applying local cache only");

    let done = 0;
    let merged = 0;
    const total = subset.length;

    await withConcurrency(subset, 4, async (t) => {
      try {
        let html = cachedHtml(t.ns, t.file);
        if (!html && !OFFLINE_MODE) {
          html = await fetchText(t.url, 25_000, 1);
          fs.mkdirSync(MS_RAW_DIR, { recursive: true });
          fs.writeFileSync(cacheFile(t.ns, t.file), html);
        }
        if (html) {
          const req = parseMsPage(html);
          if (Object.keys(req).length > 0) {
            t.fn.ms = { ...(t.fn.ms ?? {}), ...req };
            if (req.dll && (t.fn.dll === "Unknown" || !t.fn.dll)) t.fn.dll = req.dll;
            merged++;
          }
        }
      } catch (e) {
        appendLog(`microsoft: skip ${t.file} (${(e as Error).message})`);
      }
      done++;
      updateStatus({ progress: total ? done / Math.max(1, total) : 1 });
      if (done % 100 === 0) {
        saveFunctions(functions);
        appendLog(`microsoft: ${done}/${total} pages · ${merged} enriched`);
      }
      await sleep(80);
    });

    saveFunctions(functions);
    updateStatus({ progress: 1, stage: "microsoft", microsoftStage: "done" });
    markMsReady(merged);
    appendLog(`SYNC COMPLETE — microsoft metadata merged into ${merged} functions`);
  } catch (e) {
    const msg = (e as Error).message || String(e);
    appendLog(`microsoft: FAILED — ${msg}`);
    updateStatus({ microsoftStage: "error", error: msg, syncing: false });
  } finally {
    running = false;
  }
}

function markMsReady(merged: number) {
  updateStatus({ ready: true, syncing: false, microsoftStage: "done", completedAt: new Date().toISOString(), error: undefined });
}

function limits(l?: number): string {
  return l ? `limit=${l}` : "all";
}