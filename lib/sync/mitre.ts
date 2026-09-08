import fs from "node:fs";
import path from "node:path";
import type { Technique } from "../types";
import { RAW_DIR, appendLog } from "../db";
import { fetchBuffer } from "../http";

const STIX_URL =
  "https://raw.githubusercontent.com/mitre/cti/master/enterprise-attack/enterprise-attack.json";
const MITRE_STIX_FILE = path.join(RAW_DIR, "mitre-enterprise-attack.json");

interface StixObject {
  type?: string;
  name?: string;
  description?: string;
  external_references?: { source_name?: string; external_id?: string; url?: string }[];
  kill_chain_phases?: { kill_chain_name?: string; phase_name?: string }[];
  x_mitre_is_subtechnique?: boolean;
}

const PHASE_DISPLAY: Record<string, string> = {
  reconnaissance: "Reconnaissance",
  recon: "Reconnaissance",
  "resource-development": "Resource Development",
  "initial-access": "Initial Access",
  execution: "Execution",
  persistence: "Persistence",
  "privilege-escalation": "Privilege Escalation",
  "defense-evasion": "Defense Evasion",
  "defense-impairment": "Defense Impairment",
  stealth: "Stealth",
  "credential-access": "Credential Access",
  discovery: "Discovery",
  "lateral-movement": "Lateral Movement",
  collection: "Collection",
  "command-and-control": "Command and Control",
  c2: "Command and Control",
  exfiltration: "Exfiltration",
  impact: "Impact",
};

export function displayTactic(phase: string): string {
  return PHASE_DISPLAY[phase.toLowerCase()] ?? phase.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function extractTechniques(bundle: StixObject[]): Technique[] {
  const techniques: Technique[] = [];
  for (const obj of bundle) {
    if (obj.type !== "attack-pattern") continue;
    const ref = obj.external_references?.find((r) => r.source_name === "mitre-attack");
    const externalId = ref?.external_id;
    if (!externalId || !/^T\d{4}/.test(externalId)) continue;

    const phases = (obj.kill_chain_phases ?? [])
      .filter((p) => p.kill_chain_name === "mitre-attack")
      .map((p) => displayTactic(p.phase_name ?? ""))
      .filter(Boolean);

    const isSub = Boolean(obj.x_mitre_is_subtechnique);
    const parent = isSub ? externalId.split(".")[0] : undefined;
    const url = isSub
      ? `https://attack.mitre.org/techniques/${parent}/${externalId.split(".")[1].padStart(3, "0")}/`
      : `https://attack.mitre.org/techniques/${externalId}/`;

    let description = (obj.description ?? "").replace(/\s+/g, " ").trim();
    if (description.length > 700) description = description.slice(0, 697) + "...";

    techniques.push({
      id: externalId,
      name: obj.name ?? externalId,
      tactic: phases[0] ?? "Unknown",
      tactics: phases,
      url,
      description,
      isSubtechnique: isSub,
      parent,
    });
  }
  // Sort: parents first, then sub
  techniques.sort((a, b) => (a.isSubtechnique === b.isSubtechnique ? a.id.localeCompare(b.id) : a.isSubtechnique ? 1 : -1));
  return techniques;
}

export function mitreSourceCached(): boolean {
  return fs.existsSync(MITRE_STIX_FILE);
}

export async function fetchMitreTechniques(force = false): Promise<Technique[]> {
  let raw: Buffer;
  if (!force && fs.existsSync(MITRE_STIX_FILE)) {
    raw = fs.readFileSync(MITRE_STIX_FILE);
  } else {
    appendLog("Downloading MITRE ATT&CK enterprise bundle (~45 MB)");
    raw = await fetchBuffer(STIX_URL, 300_000);
    fs.mkdirSync(RAW_DIR, { recursive: true });
    fs.writeFileSync(MITRE_STIX_FILE, raw);
  }
  const parsed = JSON.parse(raw.toString("utf8"));
  const bundle = Array.isArray(parsed) ? parsed : (parsed.objects ?? []);
  const techniques = extractTechniques(bundle);
  appendLog(`MITRE: indexed ${techniques.length} enterprise techniques`);
  return techniques;
}

export function reindexMitreFromCache(): Technique[] | null {
  if (!fs.existsSync(MITRE_STIX_FILE)) return null;
  const parsed = JSON.parse(fs.readFileSync(MITRE_STIX_FILE, "utf8"));
  const bundle = Array.isArray(parsed) ? parsed : (parsed.objects ?? []);
  return extractTechniques(bundle);
}