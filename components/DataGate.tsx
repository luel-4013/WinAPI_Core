"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { SyncIcon, DatabaseIcon } from "./icons";
import { useStatus } from "./lib/status-context";

export default function DataGate({ onDone }: { onDone: () => void }) {
  const status = useStatus();
  const [starting, setStarting] = useState(false);
  const busy = status.syncing;
  const c = status.counts;

  async function start() {
    if (busy || starting) return;
    setStarting(true);
    try {
      await fetch("/api/sync", { method: "POST" });
    } finally {
      setStarting(false);
    }
  }

  return (
    <div className="relative flex flex-1 items-center justify-center overflow-hidden p-6">
      {/* ambient glows */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[600px] w-[900px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan/5 blur-[140px]" />
      <div className="pointer-events-none absolute left-[15%] top-[20%] h-[300px] w-[300px] rounded-full bg-magenta/8 blur-[100px]" />
      <div className="pointer-events-none absolute bottom-[10%] right-[15%] h-[300px] w-[300px] rounded-full bg-violet/8 blur-[100px]" />

      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 24 }}
        className="relative w-full max-w-xl"
      >
        <div className="glass clip-corners flex flex-col items-center gap-6 p-10 text-center">
          <div className="flex items-center gap-3">
            <span className="sync-dot" style={{ background: busy ? "#00e5ff" : "#ef4444" }} />
            <span className="gradient-text font-mono text-2xl font-black italic tracking-tight sm:text-3xl">
              WINAPI_CORE
            </span>
          </div>

          <p className="max-w-md font-mono text-[0.75rem] leading-relaxed text-text-dim">
            Local Windows API intelligence explorer. Indexes attack-flagged functions (
            <span className="text-cyan">malapi.io</span>), native <span className="text-magenta">NT/win32k syscall</span> tables (
            <span className="text-violet">j00ru</span>) and the complete <span className="text-green">MITRE ATT&CK</span> enterprise technique set —
            stored on your machine.
          </p>

          <div className="flex items-center gap-2 font-mono text-[0.68rem] uppercase tracking-widest text-text-dim">
            <DatabaseIcon size={13} />
            {busy ? "downloading + indexing…" : "database not initialized"}
            {status.dataSize != null && status.dataSize > 0 && (
              <span className="text-cyan/80 normal-case"> · {formatBytes(status.dataSize)} on disk</span>
            )}
          </div>

          <button
            onClick={start}
            disabled={busy || starting}
            className="clip-corners group relative border border-cyan/60 bg-cyan/10 px-8 py-3.5 font-mono text-sm font-black uppercase tracking-[0.2em] text-cyan transition-all hover:bg-cyan/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className="relative z-10 flex items-center gap-3">
              <SyncIcon spinning={busy} />
              {busy ? "initializing core…" : "initialize database"}
            </span>
          </button>

          {busy && (
            <div className="w-full">
              <div className="h-1 w-full overflow-hidden rounded bg-void/60">
                <motion.div
                  className="h-full bg-gradient-to-r from-cyan via-magenta to-violet"
                  animate={{ width: `${Math.max(4, Math.round(status.progress * 100))}%` }}
                  transition={{ ease: "easeOut" }}
                />
              </div>
              <div className="mt-2 font-mono text-[0.6rem] uppercase tracking-widest text-text-dim">
                {status.stage ?? "init"} · {Math.round(status.progress * 100)}%
              </div>
            </div>
          )}

          {status.error && (
            <div className="w-full rounded border border-red/40 bg-red/10 p-3 text-left font-mono text-xs text-red">
              sync failed: {status.error}
            </div>
          )}

          {!busy && (c.malapi > 0 || c.techniques > 0) && (
            <button onClick={onDone} className="font-mono text-xs uppercase tracking-widest text-green hover:underline">
              resume session ({c.malapi} funcs / {c.techniques} techniques already on disk) →
            </button>
          )}

          <div className="flex flex-wrap items-center justify-center gap-2">
            {[
              ["malapi.io", c.malapi, "#00e5ff"],
              ["NT syscalls", c.natives, "#d946ef"],
              ["win32k", c.win32k, "#7c3aed"],
              ["catalog", c.catalog, "#fbbf24"],
              ["techniques", c.techniques, "#22d3ee"],
            ].map(([label, n, color]) => (
              <span key={label as string} className="badge" style={{ color: color as string, borderColor: (color as string) + "44" }}>
                {label as string}: {(n as number) || 0}
              </span>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
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