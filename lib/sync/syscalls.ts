import fs from "node:fs";
import path from "node:path";
import { type ApiFunction } from "../types";
import { RAW_DIR, appendLog } from "../db";
import { fetchText } from "../http";
import { normalizeKey } from "./category-map";

const SYSCALL_BASE = "https://raw.githubusercontent.com/j00ru/windows-syscalls/master/x64/csv";
const SYSCALL_RAW_DIR = path.join(RAW_DIR, "syscalls");

/** Returns the version column headers from a syscall CSV. */
function parseSyscallCsv(csv: string): { versionColumns: string[]; rows: [string, string[]][] } {
  const lines = csv.trim().split("\n");
  const header = lines[0].split(",");
  const versionColumns = header.slice(1).map((h) => h.trim());
  const rows: [string, string[]][] = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(",");
    if (!parts[0]?.trim()) continue;
    rows.push([parts[0].trim(), parts.slice(1).map((p) => p.trim())]);
  }
  return { versionColumns, rows };
}

function cacheCsv(name: string, content: string) {
  fs.mkdirSync(SYSCALL_RAW_DIR, { recursive: true });
  fs.writeFileSync(path.join(SYSCALL_RAW_DIR, `${name}.csv`), content);
}

function loadCsv(name: string): string | null {
  const p = path.join(SYSCALL_RAW_DIR, `${name}.csv`);
  return fs.existsSync(p) ? fs.readFileSync(p, "utf8") : null;
}

export interface SyscallDataset {
  functions: ApiFunction[];
  /** Compact per-version map merged across nt + win32k (for detail view). */
  versionColumns: string[];
}

function buildFunctions(
  csv: string,
  dll: string,
  source: ApiFunction["sources"][number],
  versionColumns: string[],
  techniqueHint?: { id: string; name: string; tactic: string }
): ApiFunction[] {
  const { rows } = parseSyscallCsv(csv);
  const out: ApiFunction[] = [];

  for (const [name, numbers] of rows) {
    const key = normalizeKey(name);
    const syscalls: Record<string, string> = {};
    for (let i = 0; i < versionColumns.length; i++) {
      const v = numbers[i];
      if (v && v !== "" && v !== "-" && /^[0-9a-fx]+$/i.test(v)) {
        syscalls[versionColumns[i]] = v;
      }
    }
    const isZw = name.startsWith("Zw");
    out.push({
      id: key,
      name,
      aliases: isZw ? [name.replace(/^Zw/, "Nt")] : name.startsWith("Nt") ? [name.replace(/^Nt/, "Zw")] : [],
      dll,
      categories: [],
      description: `Native ${dll} system call — monitored at index ${
        Object.values(syscalls)[0] ?? "n/a"
      } (${Object.keys(syscalls).length} Windows versions covered).`,
      docs: [
        {
          label: "j00ru/windows-syscalls",
          url: `https://github.com/j00ru/windows-syscalls/blob/master/x64/csv/${dll === "win32k.sys" ? "win32k" : "nt"}.csv`,
        },
      ],
      sources: [source],
      techniques: techniqueHint ? [{ ...techniqueHint }] : [{ id: "T1106", name: "Native API", tactic: "Execution" }],
      syscalls,
    });
  }

  return out;
}

export function syscallsSourceCached(): boolean {
  return loadCsv("nt") !== null && loadCsv("win32k") !== null;
}

export async function fetchSyscalls(
  onProgress?: (fraction: number, label?: string) => void
): Promise<SyscallDataset> {
  appendLog("Fetching native system-call tables (j00ru/windows-syscalls)");
  onProgress?.(0, "syscalls — nt");
  const nt = loadCsv("nt") ?? (await fetchText(`${SYSCALL_BASE}/nt.csv`, 60_000));
  cacheCsv("nt", nt);
  const win32k = loadCsv("win32k") ?? (await fetchText(`${SYSCALL_BASE}/win32k.csv`, 60_000));
  cacheCsv("win32k", win32k);

  const ntInfo = parseSyscallCsv(nt);
  const win32kInfo = parseSyscallCsv(win32k);

  const versionColumns = ntInfo.versionColumns;
  const natives = buildFunctions(nt, "ntdll.dll", "nt-native", versionColumns);
  onProgress?.(0.5, "syscalls — native build");
  const win32kFuncs = buildFunctions(win32k, "win32k.sys", "win32k", versionColumns);
  onProgress?.(1, "syscalls — win32k build");

  appendLog(`syscalls: ${natives.length} NT native + ${win32kFuncs.length} win32k`);
  return { functions: [...natives, ...win32kFuncs], versionColumns };
}

export function reindexSyscallsFromCache(): SyscallDataset | null {
  const nt = loadCsv("nt");
  const win32k = loadCsv("win32k");
  if (!nt || !win32k) return null;
  const versionColumns = parseSyscallCsv(nt).versionColumns;
  return {
    functions: [
      ...buildFunctions(nt, "ntdll.dll", "nt-native", versionColumns),
      ...buildFunctions(win32k, "win32k.sys", "win32k", versionColumns),
    ],
    versionColumns,
  };
}