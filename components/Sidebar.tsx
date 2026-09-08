"use client";

import { motion } from "framer-motion";
import { RadarIcon, OctagonIcon, HeartIcon, HistoryIcon, SyncIcon } from "./icons";
import { useStatus } from "./lib/status-context";

export type View = "explorer" | "techniques" | "favorites" | "history" | "sync";

const NAV: { view: View; label: string; icon: (s?: number) => React.ReactNode }[] = [
  { view: "explorer", label: "Functions", icon: (s) => <RadarIcon size={s} /> },
  { view: "techniques", label: "Techniques", icon: (s) => <OctagonIcon size={s} /> },
  { view: "favorites", label: "Favorites", icon: (s) => <HeartIcon size={s} /> },
  { view: "history", label: "History", icon: (s) => <HistoryIcon size={s} /> },
  { view: "sync", label: "Data Core", icon: (s) => <SyncIcon size={s} /> },
];

export default function Sidebar({
  view,
  setView,
  favCount,
}: {
  view: View;
  setView: (v: View) => void;
  favCount: number;
}) {
  const status = useStatus();
  return (
    <motion.aside
      initial={{ x: -40, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      className="glass sticky top-0 z-30 flex h-screen w-[220px] shrink-0 flex-col border-r px-4 py-5"
    >
      <div className="mb-8">
        <div className="flex items-center gap-2">
          <span className="sync-dot" style={{ background: status.syncing ? "#00e5ff" : status.ready ? "#22c55e" : "#ef4444" }} />
          <span className="gradient-text text-lg font-black italic tracking-tight">WINAPI_CORE</span>
        </div>
        <div className="mt-2 pl-[18px] font-mono text-[0.62rem] uppercase tracking-[0.25em] text-text-dim">
          windows api intelligence
        </div>
      </div>

      <nav className="flex flex-col gap-1.5">
        {NAV.map(({ view: v, label, icon }) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`group relative flex items-center gap-3 rounded-md px-3 py-2.5 text-left font-mono text-[0.78rem] uppercase tracking-wider transition-colors ${
              view === v ? "text-cyan" : "text-text-dim hover:text-text"
            }`}
          >
            {view === v && (
              <motion.span
                layoutId="nav-glow"
                className="absolute inset-0 rounded-md border border-cyan/30 bg-cyan/5 glow-border"
              />
            )}
            <span className="relative z-10 opacity-80 group-hover:opacity-100">{icon(16)}</span>
            <span className="relative z-10">{label}</span>
            {v === "favorites" && favCount > 0 && (
              <span className="relative z-10 ml-auto rounded-full bg-magenta/20 px-2 py-0.5 font-mono text-[0.62rem] text-magenta">
                {favCount}
              </span>
            )}
          </button>
        ))}
      </nav>

      <div className="mt-auto space-y-2 rounded-md border border-border/50 p-3 font-mono text-[0.62rem] leading-relaxed text-text-dim">
        <div className="flex items-center justify-between">
          <span className="uppercase tracking-wider">status</span>
          <span className={status.ready ? "text-green" : status.syncing ? "text-cyan" : "text-red"}>
            {status.syncing ? "SYNCING" : status.ready ? "ONLINE" : "OFFLINE"}
          </span>
        </div>
        {status.stage && status.syncing && <div className="truncate text-cyan">stage: {status.stage}</div>}
      </div>
    </motion.aside>
  );
}