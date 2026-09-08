"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { SyncIcon, DatabaseIcon } from "./icons";
import { useStatus } from "./lib/status-context";

const STAGE_INFO: Record<string, { label: string; color: string }> = {
  init: { label: "initializing", color: "#22d3ee" },
  mitre: { label: "MITRE ATT&CK", color: "#22d3ee" },
  malapi: { label: "malapi.io", color: "#00e5ff" },
  syscalls: { label: "system-call tables", color: "#d946ef" },
  merge: { label: "merging", color: "#7c3aed" },
  done: { label: "complete", color: "#34d399" },
  microsoft: { label: "microsoft learn", color: "#38bdf8" },
  catalog: { label: "win32 catalog", color: "#fbbf24" },
  error: { label: "error", color: "#ef4444" },
};

export default function SyncView({ onDone }: { onDone?: () => void }) {
  const status = useStatus();
  const [launched, setLaunched] = useState(false);
  const [catalogMsg, setCatalogMsg] = useState("");
  const [msMsg, setMsMsg] = useState("");
  const [starting, setStarting] = useState(false);
  const busy = status.syncing;

  async function startCoreSync() {
    if (busy || starting) return;
    setStarting(true);
    try {
      const res = await fetch("/api/sync", { method: "POST" });
      const data = await res.json();
      if (!data.ok) setCatalogMsg(data.error || "failed to start sync");
    } finally {
      setStarting(false);
      setLaunched(true);
    }
  }

  async function startCatalog(materialize: boolean) {
    if (busy) return;
    setCatalogMsg("");
    const res = await fetch("/api/sync/catalog", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ materialize }),
    });
    const data = await res.json();
    if (!data.ok) setCatalogMsg(data.error || "failed to start catalog sync");
    else setCatalogMsg(materialize ? "full Win32 reference download started (large)" : "catalog index download started");
  }

  async function startMs(limit?: number) {
    if (busy) return;
    setMsMsg(limit ? `crawling attack-relevant subset (~${limit} pages)…` : "crawling all learn.microsoft.com pages — resumable, will take a while…");
    const res = await fetch(`/api/sync/microsoft${limit ? `?limit=${limit}` : ""}`, { method: "POST" });
    const data = await res.json();
    if (!data.ok) setMsMsg(data.error || "failed to start microsoft sync");
  }

  const c = status.counts;
  const catalogStageBusy = status.catalogStage === "indexing" || status.catalogStage === "materializing";
  const msStageBusy = status.microsoftStage === "running";
  const stage = STAGE_INFO[msStageBusy ? "microsoft" : catalogStageBusy ? "catalog" : (status.stage ?? "init")] ?? STAGE_INFO.init;
  const pct = Math.min(100, Math.round(status.progress * 100));
  const elapsed =
    status.startedAt && status.syncing
      ? Math.max(0, Math.round((Date.now() - new Date(status.startedAt).getTime()) / 1000))
      : 0;

  return (
    <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-5">
      <div>
        <h2 className="gradient-text font-mono text-lg font-black uppercase tracking-widest">data core</h2>
        <p className="mt-2 max-w-2xl text-[0.8rem] leading-relaxed text-text-dim">
          The database is built by downloading public intelligence sources into your local <code className="text-cyan">/data</code> directory.
          You control when to pull. Source attribution is kept per function.
        </p>
        <div className="mt-3 inline-flex max-w-full items-center gap-2 rounded border border-border/60 bg-void/40 px-3 py-2 font-mono text-[0.68rem] text-text-dim">
          <DatabaseIcon size={13} />
          <span className="text-cyan/80">db path:</span>
          <span className="truncate">{status.dataDir || "…"}</span>
          <span className="text-border">|</span>
          <span className="text-cyan/80">size:</span>
          <span>{status.dataSize != null ? formatBytes(status.dataSize) : "—"}</span>
        </div>
        <div className="mt-2 font-mono text-[0.66rem] uppercase tracking-wider text-text-dim/70">
          status:{" "}
          <span className={status.ready ? "text-green" : "text-amber"}>
            {status.ready ? "ready" : status.syncing ? "syncing" : "empty"}
          </span>
          {status.cachedRun && <span className="text-green"> · offline-ready (all sources local)</span>}
          {status.syncing && (
            <span className="text-text-dim">
              {" · "}
              <span style={{ color: stage.color }}>{stage.label}</span>
              {" · "}
              {pct}% · {elapsed}s
            </span>
          )}
          {status.completedAt && (
            <span>{" · last sync " + new Date(status.completedAt).toLocaleTimeString()}</span>
          )}
        </div>
      </div>

      {/* live progress */}
      {(status.syncing || status.stage === "done") && (
        <div className="glass clip-corners-sm max-w-2xl p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="font-mono text-xs font-bold uppercase tracking-widest" style={{ color: stage.color }}>
              {busy ? "syncing" : "progress"}
            </div>
            <div className="font-mono text-[0.7rem] text-text-dim">
              <span style={{ color: stage.color }}>{stage.label}</span>
              <span className="mx-2">·</span>
              {pct}%
            </div>
          </div>
          <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full border border-border/60 bg-void/60">
            <motion.div
              className="h-full rounded-full"
              style={{
                background: `linear-gradient(90deg, ${stage.color}, ${stage.color}88)`,
                boxShadow: `0 0 12px ${stage.color}66`,
              }}
              animate={{
                width: `${Math.max(pct, status.syncing ? 4 : 0)}%`,
                opacity: status.syncing ? [1, 0.7, 1] : 1,
              }}
              transition={{ opacity: { duration: 1.2, repeat: Infinity }, width: { type: "spring", stiffness: 80, damping: 22 } }}
            />
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[0.62rem] text-text-dim/80">
            {Object.entries({ malapi: c.malapi, natives: c.natives, win32k: c.win32k, catalog: c.catalog, ms: c.microsoft, techniques: c.techniques }).map(
              ([k, v]) => (
                <span key={k}>
                  <span className="text-cyan/80">{k}</span> {v}
                </span>
              )
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="malapi.io functions" value={c.malapi} color="#00e5ff" icon={<DatabaseIcon />} />
        <StatCard label="NT native syscalls" value={c.natives} color="#d946ef" icon={<SyncIcon />} />
        <StatCard label="win32k syscalls" value={c.win32k} color="#7c3aed" icon={<SyncIcon />} />
        <StatCard label="Win32 catalog (MS)" value={c.catalog} color="#fbbf24" icon={<DatabaseIcon />} />
        <StatCard label="MS Learn enrichments" value={c.microsoft} color="#38bdf8" icon={<DatabaseIcon />} />
        <StatCard label="MITRE techniques" value={c.techniques} color="#22d3ee" icon={<DatabaseIcon />} />
      </div>

      <div className="glass clip-corners-sm max-w-2xl p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="font-mono text-xs font-bold uppercase tracking-widest text-cyan">core sync</div>
            <p className="mt-1 text-[0.76rem] text-text-dim">
              malapi.io attack mappings + j00ru system-call tables + MITRE ATT&CK enterprise techniques.
              Small and fast. Re-sync runs from local caches — works fully offline once downloaded.
            </p>
          </div>
          <button
            onClick={startCoreSync}
            disabled={busy || starting}
            className="clip-corners-sm shrink-0 border border-cyan/50 bg-cyan/10 px-4 py-2.5 font-mono text-xs font-bold uppercase tracking-widest text-cyan transition-all hover:bg-cyan/20 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <span className="flex items-center gap-2">
              <SyncIcon size={14} spinning={busy} />
              {busy ? "syncing…" : launched ? "re-sync" : "start sync"}
            </span>
          </button>
        </div>

        {status.error && <div className="mt-3 rounded border border-red/40 bg-red/10 p-2 font-mono text-xs text-red">{status.error}</div>}

        {/* log */}
        {status.log.length > 0 && (
          <div className="mt-4 max-h-56 space-y-1 overflow-y-auto rounded border border-border/50 bg-void/50 p-3 font-mono text-[0.68rem] leading-relaxed">
            {status.log.map((e, i) => (
              <div key={i} className="flex gap-2">
                <span className="shrink-0 text-text-dim/60">{new Date(e.t).toLocaleTimeString()}</span>
                <span className={e.msg.startsWith("SYNC") ? "text-cyan" : "text-text-dim"}>{e.msg}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="glass clip-corners-sm max-w-2xl border-amber/20 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="font-mono text-xs font-bold uppercase tracking-widest text-amber">full win32 catalog</div>
            <p className="mt-1 text-[0.76rem] text-text-dim">
              The complete documented Win32 API reference (all <span className="text-amber">~40,000</span> functions) from
              MicrosoftDocs/sdk-api. Two levels:{" "}
              <code className="text-amber">index</code> (names + doc links, small) or{" "}
              <code className="text-amber">full content</code> (several hundred MB, offline descriptions).
            </p>
            <div className="mt-1 font-mono text-[0.62rem] text-text-dim/70">
              status: {status.catalogStage ?? "none"}
              {c.catalog ? ` · ${c.catalog.toLocaleString()} functions indexed` : ""}
              {catalogStageBusy && " · syncing…"}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <button
              onClick={() => startCatalog(false)}
              disabled={busy}
              className="clip-corners-sm border border-cyan/40 bg-cyan/5 px-4 py-2 font-mono text-xs font-bold uppercase tracking-widest text-cyan transition-colors hover:bg-cyan/15 disabled:opacity-40"
            >
              index only
            </button>
            <button
              onClick={() => startCatalog(true)}
              disabled={busy}
              className="clip-corners-sm border border-amber/40 bg-amber/5 px-4 py-2 font-mono text-xs font-bold uppercase tracking-widest text-amber transition-colors hover:bg-amber/15 disabled:opacity-40"
            >
              full content
            </button>
          </div>
        </div>
        {catalogMsg && <div className="mt-3 font-mono text-xs text-text-dim">{catalogMsg}</div>}
      </div>

      <div className="glass clip-corners-sm max-w-2xl border-sky/20 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="font-mono text-xs font-bold uppercase tracking-widest text-sky">microsoft learn metadata</div>
            <p className="mt-1 text-[0.76rem] text-text-dim">
              Crawls each function's <code className="text-sky">learn.microsoft.com</code> API page and merges the
              Requirements table (<span className="text-sky">DLL / header / library / min-OS</span>) and Remarks into the
              same record as the GitHub + catalog data. Cache-first and resumable — runs fully offline once pages are saved.
            </p>
            <div className="mt-1 font-mono text-[0.62rem] text-text-dim/70">
              status: {status.microsoftStage ?? "none"}
              {c.microsoft ? ` · ${c.microsoft.toLocaleString()} enriched` : ""}
              {msStageBusy && " · syncing…"}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <button
              onClick={() => startMs(400)}
              disabled={busy}
              className="clip-corners-sm border border-sky/40 bg-sky/5 px-4 py-2 font-mono text-xs font-bold uppercase tracking-widest text-sky transition-colors hover:bg-sky/15 disabled:opacity-40"
            >
              attack subset
            </button>
            <button
              onClick={() => startMs(undefined)}
              disabled={busy}
              className="clip-corners-sm border border-amber/40 bg-amber/5 px-4 py-2 font-mono text-xs font-bold uppercase tracking-widest text-amber transition-colors hover:bg-amber/15 disabled:opacity-40"
            >
              all functions
            </button>
          </div>
        </div>
        {msMsg && <div className="mt-3 font-mono text-xs text-text-dim">{msMsg}</div>}
      </div>

      {status.ready && (
        <button
          onClick={onDone}
          className="clip-corners-sm max-w-2xl border border-green/40 bg-green/5 px-4 py-3 text-left font-mono text-xs uppercase tracking-widest text-green transition-colors hover:bg-green/10"
        >
          ✓ database online — return to explorer
        </button>
      )}
    </div>
  );
}

function StatCard({ label, value, color, icon }: { label: string; value: number; color: string; icon: React.ReactNode }) {
  return (
    <motion.div
      whileHover={{ y: -2 }}
      className="glass clip-corners-sm p-4"
      style={{ borderColor: color + "33" }}
    >
      <div className="flex items-center justify-between text-text-dim" style={{ color }}>
        {icon}
      </div>
      <div className="mt-2 font-mono text-2xl font-black" style={{ color }}>
        {value.toLocaleString()}
      </div>
      <div className="mt-1 font-mono text-[0.62rem] uppercase tracking-wider text-text-dim">{label}</div>
    </motion.div>
  );
}

function formatBytes(n: number): string {
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v >= 100 || i === 0 ? 0 : 1)} ${units[i]}`;
}