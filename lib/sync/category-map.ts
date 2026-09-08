import type { Category, TechniqueRef } from "../types";

/**
 * Analyst-curated mapping from malapi.io categories to MITRE ATT&CK enterprise
 * techniques. These are approximations — individual functions can be refined
 * via FUNCTION_TECHNIQUE_OVERRIDES below.
 */
const CATEGORY_TECHNIQUES: Record<Category, Omit<TechniqueRef, "tactic">[]> = {
  Enumeration: [
    { id: "T1082", name: "System Information Discovery" },
    { id: "T1057", name: "Process Discovery" },
    { id: "T1016", name: "System Network Configuration Discovery" },
    { id: "T1007", name: "System Service Discovery" },
    { id: "T1124", name: "System Time Discovery" },
    { id: "T1069", name: "Permission Groups Discovery" },
    { id: "T1012", name: "Query Registry" },
    { id: "T1120", name: "Peripheral Device Discovery" },
  ],
  Injection: [
    { id: "T1055", name: "Process Injection" },
    { id: "T1134", name: "Access Token Manipulation" },
    { id: "T1543", name: "Create or Modify System Process" },
    { id: "T1053", name: "Scheduled Task/Job" },
    { id: "T1106", name: "Native API" },
  ],
  Evasion: [
    { id: "T1027", name: "Obfuscated Files or Information" },
    { id: "T1564", name: "Hide Artifacts" },
    { id: "T1480", name: "Execution Guardrails" },
    { id: "T1140", name: "Deobfuscate/Decode Files or Information" },
    { id: "T1106", name: "Native API" },
  ],
  Spying: [
    { id: "T1056", name: "Input Capture" },
    { id: "T1113", name: "Screen Capture" },
    { id: "T1115", name: "Clipboard Data" },
    { id: "T1005", name: "Data from Local System" },
  ],
  Internet: [
    { id: "T1071", name: "Application Layer Protocol" },
    { id: "T1105", name: "Ingress Tool Transfer" },
    { id: "T1573", name: "Encrypted Channel" },
    { id: "T1041", name: "Exfiltration Over C2 Channel" },
    { id: "T1021", name: "Remote Services" },
  ],
  "Anti-Debugging": [
    { id: "T1622", name: "Debugger Evasion" },
    { id: "T1497", name: "Virtualization/Sandbox Evasion" },
    { id: "T1106", name: "Native API" },
  ],
  Ransomware: [
    { id: "T1486", name: "Data Encrypted for Impact" },
    { id: "T1489", name: "Service Stop" },
    { id: "T1490", name: "Inhibit System Recovery" },
    { id: "T1112", name: "Modify Registry" },
  ],
  Helper: [
    { id: "T1106", name: "Native API" },
    { id: "T1059", name: "Command and Scripting Interpreter" },
  ],
};

/** Per-function refinements keyed by lowercase function name. */
const FUNCTION_TECHNIQUE_OVERRIDES: Record<string, Omit<TechniqueRef, "tactic">[]> = {
  isdebuggerpresent: [{ id: "T1622", name: "Debugger Evasion" }],
  checkremotedebuggerpresent: [{ id: "T1622", name: "Debugger Evasion" }],
  ntqueryinformationprocess: [
    { id: "T1622", name: "Debugger Evasion" },
    { id: "T1057", name: "Process Discovery" },
  ],
  ntqueryinformationthread: [{ id: "T1057", name: "Process Discovery" }],
  outputdebugstringa: [{ id: "T1622", name: "Debugger Evasion" }],
  cryptprotectdata: [
    { id: "T1555", name: "Credentials from Password Stores" },
    { id: "T1140", name: "Deobfuscate/Decode Files or Information" },
  ],
  winhttpsendrequest: [{ id: "T1071", name: "Application Layer Protocol" }],
  httpopenrequesta: [{ id: "T1071", name: "Application Layer Protocol" }],
  httpopenrequestw: [{ id: "T1071", name: "Application Layer Protocol" }],
  httpsendrequesta: [{ id: "T1071", name: "Application Layer Protocol" }],
  httpsendrequestexa: [{ id: "T1071", name: "Application Layer Protocol" }],
  internetopenurlw: [{ id: "T1105", name: "Ingress Tool Transfer" }],
  urldownloadtofile: [{ id: "T1105", name: "Ingress Tool Transfer" }],
  dnsquery_a: [{ id: "T1008", name: "Fallback Channels" }],
  getasynckeystate: [{ id: "T1056.001", name: "Keylogging" }],
  getkeystate: [{ id: "T1056.001", name: "Keylogging" }],
  getkeyboardstate: [{ id: "T1056.001", name: "Keylogging" }],
  setwindowshookex: [{ id: "T1056.001", name: "Keylogging" }],
  setwindowshookexa: [{ id: "T1056.001", name: "Keylogging" }],
  setwindowshookexw: [{ id: "T1056.001", name: "Keylogging" }],
  bitblt: [{ id: "T1113", name: "Screen Capture" }],
  stretchblt: [{ id: "T1113", name: "Screen Capture" }],
  getdc: [{ id: "T1113", name: "Screen Capture" }],
  getwindowdc: [{ id: "T1113", name: "Screen Capture" }],
  getdesktopwindow: [{ id: "T1113", name: "Screen Capture" }],
  cryptencrypt: [{ id: "T1486", name: "Data Encrypted for Impact" }],
  cryptdecrypt: [{ id: "T1140", name: "Deobfuscate/Decode Files or Information" }],
  cryptgenrandom: [
    { id: "T1486", name: "Data Encrypted for Impact" },
    { id: "T1027", name: "Obfuscated Files or Information" },
  ],
  createservice: [{ id: "T1543.003", name: "Windows Service" }],
  startservice: [{ id: "T1569.002", name: "Service Execution" }],
  controlservice: [{ id: "T1489", name: "Service Stop" }],
  ntsetvaluekey: [{ id: "T1112", name: "Modify Registry" }],
  regcreatekey: [{ id: "T1112", name: "Modify Registry" }],
  regcreatekeyex: [{ id: "T1112", name: "Modify Registry" }],
  createremotethread: [{ id: "T1055.001", name: "Dynamic-link Library Injection" }],
  virtualallocex: [{ id: "T1055", name: "Process Injection" }],
  virtualalloc: [
    { id: "T1055", name: "Process Injection" },
    { id: "T1055.001", name: "Dynamic-link Library Injection" },
  ],
  ntallocatevirtualmemory: [
    { id: "T1055", name: "Process Injection" },
    { id: "T1106", name: "Native API" },
  ],
  writeprocessmemory: [{ id: "T1055", name: "Process Injection" }],
  ntwritevirtualmemory: [{ id: "T1055", name: "Process Injection" }],
  queueuserapc: [{ id: "T1055", name: "Process Injection" }],
  ntqueueapcthread: [{ id: "T1055", name: "Process Injection" }],
  setthreadcontext: [{ id: "T1055.003", name: "Thread Execution Hijacking" }],
  getsystemtime: [
    { id: "T1124", name: "System Time Discovery" },
    { id: "T1497", name: "Virtualization/Sandbox Evasion" },
  ],
  gettickcount: [{ id: "T1497", name: "Virtualization/Sandbox Evasion" }],
  gettickcount64: [{ id: "T1497", name: "Virtualization/Sandbox Evasion" }],
  queryperformancecounter: [{ id: "T1497", name: "Virtualization/Sandbox Evasion" }],
  queryperformancefrequency: [{ id: "T1497", name: "Virtualization/Sandbox Evasion" }],
  ntdelayexecution: [{ id: "T1497", name: "Virtualization/Sandbox Evasion" }],
  sleep: [{ id: "T1497", name: "Virtualization/Sandbox Evasion" }],
  encryptfilea: [{ id: "T1486", name: "Data Encrypted for Impact" }],
  internetconnect: [{ id: "T1071", name: "Application Layer Protocol" }],
  internetconnecta: [{ id: "T1071", name: "Application Layer Protocol" }],
  socket: [{ id: "T1071", name: "Application Layer Protocol" }],
  wsasocketa: [{ id: "T1071", name: "Application Layer Protocol" }],
  connect: [{ id: "T1071", name: "Application Layer Protocol" }],
  wnetaddconnection: [{ id: "T1021.002", name: "SMB/Windows Admin Shares" }],
  wnetaddconnection2: [{ id: "T1021.002", name: "SMB/Windows Admin Shares" }],
  netshareenum: [{ id: "T1135", name: "Network Share Discovery" }],
  lookupprivilegevalue: [{ id: "T1134", name: "Access Token Manipulation" }],
  lookupprivilegevaluea: [{ id: "T1134", name: "Access Token Manipulation" }],
  adjusttokenprivileges: [
    { id: "T1134.001", name: "Token Impersonation/Theft" },
    { id: "T1548.002", name: "Bypass User Account Control" },
  ],
  ntadjustprivilegestoken: [
    { id: "T1134.001", name: "Token Impersonation/Theft" },
    { id: "T1548.002", name: "Bypass User Account Control" },
  ],
  openprocesstoken: [{ id: "T1134", name: "Access Token Manipulation" }],
  duplicatetoken: [
    { id: "T1134.001", name: "Token Impersonation/Theft" },
    { id: "T1134.002", name: "Create Process with Token" },
  ],
  impersonateloggedonuser: [{ id: "T1134", name: "Access Token Manipulation" }],
  setthreadtoken: [{ id: "T1134", name: "Access Token Manipulation" }],
  rtlsetprocessiscritical: [{ id: "T1489", name: "Service Stop" }],
  ntshutdownsystem: [{ id: "T1529", name: "System Shutdown/Reboot" }],
  exitwindowsex: [{ id: "T1529", name: "System Shutdown/Reboot" }],
  terminatethread: [{ id: "T1489", name: "Service Stop" }],
  ntterminatethread: [{ id: "T1489", name: "Service Stop" }],
  ntterminateprocess: [{ id: "T1489", name: "Service Stop" }],
  terminateprocess: [{ id: "T1489", name: "Service Stop" }],
  openfilemapping: [{ id: "T1055", name: "Process Injection" }],
  mapviewoffile: [
    { id: "T1055", name: "Process Injection" },
    { id: "T1106", name: "Native API" },
  ],
  ntmapviewofsection: [{ id: "T1055", name: "Process Injection" }],
  createthread: [
    { id: "T1055", name: "Process Injection" },
    { id: "T1106", name: "Native API" },
  ],
  ntcreatethread: [
    { id: "T1055", name: "Process Injection" },
    { id: "T1106", name: "Native API" },
  ],
  ntcreatethreadex: [
    { id: "T1055", name: "Process Injection" },
    { id: "T1106", name: "Native API" },
  ],
  ntcreateprocess: [
    { id: "T1055", name: "Process Injection" },
    { id: "T1106", name: "Native API" },
  ],
  ntcreateuserprocess: [{ id: "T1106", name: "Native API" }],
  ldrunloaddll: [{ id: "T1106", name: "Native API" }],
  ldrloaddll: [{ id: "T1106", name: "Native API" }],
  enumerateprocesses: [{ id: "T1057", name: "Process Discovery" }],
  createtoolhelp32snapshot: [{ id: "T1057", name: "Process Discovery" }],
  virtualprotect: [
    { id: "T1055", name: "Process Injection" },
    { id: "T1027", name: "Obfuscated Files or Information" },
  ],
  readprocessmemory: [
    { id: "T1055", name: "Process Injection" },
    { id: "T1005", name: "Data from Local System" },
  ],
  ntreadvirtualmemory: [
    { id: "T1055", name: "Process Injection" },
    { id: "T1005", name: "Data from Local System" },
  ],
  writefile: [
    { id: "T1105", name: "Ingress Tool Transfer" },
    { id: "T1027", name: "Obfuscated Files or Information" },
  ],
  readfile: [{ id: "T1005", name: "Data from Local System" }],
  searchpath: [{ id: "T1574.001", name: "DLL Search Order Hijacking" }],
  searchpatha: [{ id: "T1574.001", name: "DLL Search Order Hijacking" }],
  loadlibrary: [
    { id: "T1574.001", name: "DLL Search Order Hijacking" },
    { id: "T1055.001", name: "Dynamic-link Library Injection" },
  ],
  loadlibrarya: [
    { id: "T1574.001", name: "DLL Search Order Hijacking" },
    { id: "T1055.001", name: "Dynamic-link Library Injection" },
  ],
  loadlibraryex: [
    { id: "T1574.001", name: "DLL Search Order Hijacking" },
    { id: "T1055.001", name: "Dynamic-link Library Injection" },
  ],
  getprocaddress: [
    { id: "T1055.001", name: "Dynamic-link Library Injection" },
    { id: "T1027", name: "Obfuscated Files or Information" },
  ],
  getmodulefilename: [{ id: "T1082", name: "System Information Discovery" }],
  getmodulebasename: [{ id: "T1082", name: "System Information Discovery" }],
  getmodulebasenamea: [{ id: "T1082", name: "System Information Discovery" }],
  getmodulebasenamew: [{ id: "T1082", name: "System Information Discovery" }],
  reggetvalue: [{ id: "T1012", name: "Query Registry" }],
  regqueryvalue: [{ id: "T1012", name: "Query Registry" }],
  regqueryvalueex: [{ id: "T1012", name: "Query Registry" }],
  regqueryvalueexa: [{ id: "T1012", name: "Query Registry" }],
  regenumkey: [{ id: "T1012", name: "Query Registry" }],
  regenumvalue: [{ id: "T1012", name: "Query Registry" }],
  regopenkey: [{ id: "T1012", name: "Query Registry" }],
  regopenkeyex: [{ id: "T1012", name: "Query Registry" }],
  getusername: [{ id: "T1033", name: "System Owner/User Discovery" }],
  getusernamea: [{ id: "T1033", name: "System Owner/User Discovery" }],
  getcomputernamea: [{ id: "T1082", name: "System Information Discovery" }],
  netusergetinfo: [{ id: "T1087", name: "Account Discovery" }],
  netuserenum: [{ id: "T1087", name: "Account Discovery" }],
  netusergetlocalgroups: [{ id: "T1069.001", name: "Local Groups" }],
};

export function categoryTechniques(categories: Category[]): TechniqueRef[] {
  const seen = new Set<string>();
  const out: TechniqueRef[] = [];
  for (const c of categories) {
    for (const t of CATEGORY_TECHNIQUES[c]) {
      if (!seen.has(t.id)) {
        seen.add(t.id);
        out.push({ ...t });
      }
    }
  }
  return out;
}

export function overrideTechniques(name: string): TechniqueRef[] | null {
  const o = FUNCTION_TECHNIQUE_OVERRIDES[normalizeKey(name)];
  return o ? o.map((t) => ({ ...t })) : null;
}

export function normalizeKey(name: string): string {
  return name.toLowerCase();
}

export { CATEGORY_TECHNIQUES, FUNCTION_TECHNIQUE_OVERRIDES };