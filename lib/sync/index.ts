import {
  appendLog,
  loadFunctions,
  markReady,
  saveFunctions,
  saveTechniques,
  updateStatus,
} from "../db";
import type { ApiFunction, Technique } from "../types";
import { fetchMalapiFunctions, malapiSourceCached } from "./malapi";
import { fetchSyscalls, syscallsSourceCached } from "./syscalls";
import { fetchMitreTechniques, mitreSourceCached } from "./mitre";
import { getCatalogEntries, mergeCatalogFunctions } from "./catalog";

let running = false;
let runningCatalog = false;

export function isRunning() {
  return running;
}

export function isCatalogRunning() {
  return runningCatalog;
}

function dedupeTechniques(fns: ApiFunction[]): void {
  for (const f of fns) {
    const seen = new Set<string>();
    f.techniques = (f.techniques ?? []).filter((t) => {
      if (seen.has(t.id)) return false;
      seen.add(t.id);
      return true;
    });
  }
}

/**
 * Fast sync: malapi.io (attack-flagged Win32 APIs) + native NT syscall tables
 * + MITRE ATT&CK enterprise techniques. Everything is cached to disk.
 */
export async function runFastSync(force = false): Promise<void> {
  if (running) return;
  running = true;
  try {
    updateStatus({
      syncing: true,
      ready: false,
      error: undefined,
      progress: 0,
      startedAt: new Date().toISOString(),
      stage: "init",
      cachedRun: undefined,
    });
    appendLog("SYNC START — building local Windows API intelligence database");
    const allCached = mitreSourceCached() && malapiSourceCached() && syscallsSourceCached();
    appendLog(allCached ? "ALL SOURCES LOCAL — running fully offline" : force ? "FORCED refresh — downloading updates" : "download mode");

    appendLog(allCached ? "MITRE ATT&CK: reading local STIX bundle" : "Fetching MITRE ATT&CK enterprise techniques (STIX ~48MB)");
    const techniques = await fetchMitreTechniques(force);
    saveTechniques(techniques);
    appendLog(`mitre: ${techniques.length} techniques`);
    updateStatus({ progress: 0.15, stage: "malapi" });
    appendLog(allCached ? "malapi.io: reading local data" : "Fetching malapi.io attack mappings");

    const malapi = await fetchMalapiFunctions(
      (done, total) => {
        updateStatus({ progress: 0.15 + 0.35 * (done / Math.max(1, total)) });
      },
      force
    );
    const syscalls = await fetchSyscalls((fraction, label) => {
      updateStatus({ progress: 0.5 + 0.1 * fraction, stage: "syscalls" });
      if (label) appendLog(label);
    });
    updateStatus({ progress: 0.6, stage: "merge" });

    // Start from malapi (attack-flagged functions) + catalog index
    let functions: ApiFunction[] = [...malapi];
    const catalogEntries = getCatalogEntries();
    if (catalogEntries.length > 0) {
      functions = mergeCatalogFunctions(catalogEntries, functions);
    }

    // Merge syscall table data into existing entries instead of adding separate rows.
    const funcMap = new Map(functions.map((f) => [f.id, f]));
    let syscallMerged = 0;
    for (const sc of syscalls.functions) {
      const existing = funcMap.get(sc.id);
      if (existing) {
        existing.syscalls = { ...(existing.syscalls ?? {}), ...sc.syscalls };
        existing.sources = [...new Set([...existing.sources, sc.sources[0]])];
        if (existing.aliases.length === 0 && sc.aliases.length > 0) existing.aliases = sc.aliases;
        // Ensure docs reference the syscall table
        const j00ruLink = sc.docs.find((d) => d.url.includes("windows-syscalls"));
        if (j00ruLink && !existing.docs.some((d) => d.url.includes("windows-syscalls"))) {
          existing.docs.push(j00ruLink);
        }
        if (existing.dll === "Unknown" || existing.dll === "Ntdll.dll") {
          // Prefer lowercase naming to match convention
          if (sc.dll) existing.dll = existing.dll === "Ntdll.dll" ? "ntdll.dll" : existing.dll;
        }
        syscallMerged++;
      } else {
        // pure syscall function (no malapi entry)
        funcMap.set(sc.id, sc);
        functions.push(sc);
      }
    }
    appendLog(`merged syscall data into ${syscallMerged} existing entries`);
    functions = [...funcMap.values()];

    // Fill technique tactic/name details from resolved MITRE data where possible
    const byId = new Map(techniques.map((t) => [t.id, t]));
    for (const f of functions) {
      f.techniques = (f.techniques ?? []).map((t) => {
        const resolved = byId.get(t.id);
        return resolved
          ? { id: resolved.id, name: resolved.name, tactic: resolved.tactic }
          : t;
      });
      // Truthful attack labels: only data we actually hold (category + MITRE technique name).
      f.attacks = [...new Set([...f.categories, ...(f.techniques ?? []).map((t) => t.name)])];
    }
    dedupeTechniques(functions);

    functions.sort((a, b) => a.name.localeCompare(b.name));
    saveFunctions(functions);
    updateStatus({ progress: 1, stage: "done", cachedRun: allCached });
    markReady();
    appendLog(`SYNC COMPLETE — ${functions.length} functions indexed`);
  } catch (e) {
    const msg = (e as Error).message || String(e);
    appendLog(`SYNC FAILED — ${msg}`);
    updateStatus({ error: msg, syncing: false });
  } finally {
    running = false;
  }
}

/** Optional heavyweight step: download full Win32 API reference index + content. */
export async function runCatalogSync(materialize: boolean): Promise<void> {
  if (runningCatalog) return;
  runningCatalog = true;
  try {
    const { indexCatalog, materializeCatalog } = await import("./catalog");
    let entries;
    if (materialize) {
      entries = await materializeCatalog();
    } else {
      entries = await indexCatalog();
    }

    if (running) {
      appendLog("catalog: fast sync already in progress — catalog will merge after it completes");
      return;
    }
    const functions = mergeCatalogFunctions(entries, loadFunctions());
    saveFunctions(functions);
    markReady();
  } finally {
    runningCatalog = false;
  }
}