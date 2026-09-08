import fs from "node:fs";
import path from "node:path";
import { EMPTY_STATUS, type ApiFunction, type SyncStatus, type Technique } from "./types";

export const DATA_DIR = path.join(process.cwd(), "data");
export const RAW_DIR = path.join(DATA_DIR, "raw");
export const CATALOG_DIR = path.join(DATA_DIR, "catalog");

export const FUNCTIONS_FILE = path.join(DATA_DIR, "functions.json");
export const TECHNIQUES_FILE = path.join(DATA_DIR, "techniques.json");
export const CATALOG_INDEX_FILE = path.join(DATA_DIR, "catalog-index.json");
export const STATUS_FILE = path.join(DATA_DIR, "status.json");

/** Total size on disk of the downloaded database (data/ dir), in bytes. */
export function getDatabaseSize(): number {
  const total = { n: 0 };
  const walk = (dir: string) => {
    let s: fs.Stats;
    try {
      s = fs.statSync(dir);
    } catch {
      return;
    }
    if (s.isFile()) total.n += s.size;
    else if (s.isDirectory()) {
      for (const e of fs.readdirSync(dir)) walk(path.join(dir, e));
    }
  };
  walk(DATA_DIR);
  return total.n;
}

function ensureDir(p: string) {
  fs.mkdirSync(p, { recursive: true });
}

export function readJson<T>(file: string, fallback: T): T {
  try {
    if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, "utf8")) as T;
  } catch {
    // ignore corrupt cache, fall back
  }
  return fallback;
}

export function writeJson(file: string, value: unknown) {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, JSON.stringify(value, null, 2));
}

// --- status ---

let statusInMem: SyncStatus | null = null;

export function getStatus(): SyncStatus {
  if (!statusInMem) {
    statusInMem = readJson<SyncStatus>(STATUS_FILE, EMPTY_STATUS);
    if (statusInMem.dataDir !== DATA_DIR || statusInMem.dataSize == null) {
      statusInMem = { ...statusInMem, dataDir: DATA_DIR, dataSize: statusInMem.dataSize ?? getDatabaseSize() };
      writeJson(STATUS_FILE, statusInMem);
    }
    // If the file never existed, derive readiness from the data files on disk.
    if (!fs.existsSync(STATUS_FILE)) {
      const fn = readJson<ApiFunction[]>(FUNCTIONS_FILE, []);
      const tech = readJson<Technique[]>(TECHNIQUES_FILE, []);
      statusInMem.ready = fn.length > 0 && tech.length > 0;
      statusInMem.completedAt = fs.existsSync(FUNCTIONS_FILE) ? new Date().toISOString() : undefined;
      updateStatus(statusInMem);
    }
  }
  return statusInMem;
}

export function updateStatus(patch: Partial<SyncStatus>) {
  const cur = getStatus();
  statusInMem = { ...cur, ...patch, dataDir: DATA_DIR, dataSize: getDatabaseSize() };
  writeJson(STATUS_FILE, statusInMem);
}

export function setSyncing(syncing: boolean, stage?: string) {
  updateStatus({ syncing, stage, error: undefined, startedAt: syncing ? new Date().toISOString() : undefined });
}

export function appendLog(msg: string) {
  const cur = getStatus();
  const log = [...cur.log, { t: new Date().toISOString(), msg }].slice(-200);
  updateStatus({ log });
}

export function resetStatus() {
  statusInMem = { ...EMPTY_STATUS, dataDir: DATA_DIR };
  writeJson(STATUS_FILE, statusInMem);
}

// --- data access ---

let funcsCache: ApiFunction[] | null = null;
let techCache: Technique[] | null = null;

export function loadFunctions(): ApiFunction[] {
  if (!funcsCache) funcsCache = readJson<ApiFunction[]>(FUNCTIONS_FILE, []);
  return funcsCache;
}

export function loadTechniques(): Technique[] {
  if (!techCache) techCache = readJson<Technique[]>(TECHNIQUES_FILE, []);
  return techCache;
}

export function saveFunctions(fns: ApiFunction[]) {
  funcsCache = fns;
  writeJson(FUNCTIONS_FILE, fns);
  updateStatus({ counts: { ...getStatus().counts, ...countSource(fns) } });
}

export function saveTechniques(techs: Technique[]) {
  techCache = techs;
  writeJson(TECHNIQUES_FILE, techs);
  updateStatus({ counts: { ...getStatus().counts, techniques: techs.length } });
}

function countSource(fns: ApiFunction[]) {
  return {
    malapi: fns.filter((f) => f.sources.includes("malapi")).length,
    natives: fns.filter((f) => f.sources.includes("nt-native")).length,
    syscalls: fns.filter((f) => f.sources.includes("nt-native") || f.sources.includes("win32k")).length,
    win32k: fns.filter((f) => f.sources.includes("win32k")).length,
    catalog: fns.filter((f) => f.sources.includes("catalog")).length,
    microsoft: fns.filter((f) => f.ms && Object.keys(f.ms).length > 0).length,
  };
}

export function markReady() {
  updateStatus({ ready: true, syncing: false, completedAt: new Date().toISOString(), error: undefined });
}