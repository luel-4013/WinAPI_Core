export const CATEGORY_COLORS: Record<string, string> = {
  Enumeration: "#00e5ff",
  Injection: "#d946ef",
  Evasion: "#fbbf24",
  Spying: "#22d3ee",
  Internet: "#7c3aed",
  "Anti-Debugging": "#ef4444",
  Ransomware: "#f97316",
  Helper: "#94a3b8",
};

export const TACTIC_COLORS: Record<string, string> = {
  "Reconnaissance": "#93c5fd",
  "Resource Development": "#a78bfa",
  "Initial Access": "#f472b6",
  "Execution": "#34d399",
  "Persistence": "#fbbf24",
  "Privilege Escalation": "#fb923c",
  "Defense Evasion": "#f87171",
  "Defense Impairment": "#f87171",
  "Stealth": "#f87171",
  "Credential Access": "#c084fc",
  "Discovery": "#22d3ee",
  "Lateral Movement": "#facc15",
  "Collection": "#f9a8d4",
  "Command and Control": "#818cf8",
  "Exfiltration": "#fb7185",
  "Impact": "#ef4444",
};

export function sourceLabel(s: string): string {
  return {
    malapi: "malapi.io",
    "nt-native": "NT Native",
    win32k: "win32k",
    catalog: "Win32 Catalog",
  }[s] ?? s;
}

export function sourceColor(s: string): string {
  return {
    malapi: "#00e5ff",
    "nt-native": "#d946ef",
    win32k: "#7c3aed",
    catalog: "#22d3ee",
  }[s] ?? "#94a3b8";
}