export type Category =
  | "Enumeration"
  | "Injection"
  | "Evasion"
  | "Spying"
  | "Internet"
  | "Anti-Debugging"
  | "Ransomware"
  | "Helper";

export const CATEGORIES: Category[] = [
  "Enumeration",
  "Injection",
  "Evasion",
  "Spying",
  "Internet",
  "Anti-Debugging",
  "Ransomware",
  "Helper",
];

export type ApiSource = "malapi" | "nt-native" | "win32k" | "catalog";

export interface TechniqueRef {
  id: string;
  name: string;
  tactic?: string;
}

export interface DocLink {
  label: string;
  url: string;
}

export interface MsRequirements {
  platform?: string;
  header?: string;
  library?: string;
  dll?: string;
  minClient?: string;
  minServer?: string;
  remarks?: string;
}

export interface ApiFunction {
  id: string;
  name: string;
  aliases: string[];
  dll: string;
  categories: Category[];
  description: string;
  docsUrl?: string;
  docs: DocLink[];
  sources: ApiSource[];
  techniques: TechniqueRef[];
  attacks?: string[];
  syscalls?: Record<string, string>;
  malware?: string[];
  credit?: string;
  localDoc?: string;
  ms?: MsRequirements;
}

export interface Technique {
  id: string;
  name: string;
  tactic: string;
  tactics: string[];
  url: string;
  description: string;
  isSubtechnique: boolean;
  parent?: string;
}

export interface SyncLogEntry {
  t: string;
  msg: string;
}

export interface SyncStatus {
  ready: boolean;
  syncing: boolean;
  stage?: string;
  progress: number;
  dataDir: string;
  dataSize?: number;
  cachedRun?: boolean;
  log: SyncLogEntry[];
  startedAt?: string;
  completedAt?: string;
  error?: string;
catalogStage?: "none" | "indexing" | "materializing" | "done" | "error";
  microsoftStage?: "none" | "running" | "done" | "error";
  counts: {
    malapi: number;
    natives: number;
    syscalls: number;
    win32k: number;
    catalog: number;
    microsoft: number;
    techniques: number;
  };
}

export interface MetaFacets {
  categories: { name: Category; count: number }[];
  dlls: { name: string; count: number }[];
  tactics: { id: string; name: string; count: number }[];
  sources: { name: ApiSource; count: number }[];
  totals: { functions: number; techniques: number; catalog: number };
}

export const EMPTY_STATUS: SyncStatus = {
  ready: false,
  syncing: false,
  progress: 0,
  dataDir: "",
  log: [],
  catalogStage: "none",
  counts: { malapi: 0, natives: 0, syscalls: 0, win32k: 0, catalog: 0, microsoft: 0, techniques: 0 },
};

export interface Result<T> {
  ok: boolean;
  error?: string;
  data?: T;
}