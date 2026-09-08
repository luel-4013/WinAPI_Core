"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { ApiFunction, MetaFacets } from "@/lib/types";
import Sidebar, { type View } from "./Sidebar";
import ExplorerView from "./ExplorerView";
import TechniquesView from "./TechniquesView";
import SavedView from "./SavedView";
import SyncView from "./SyncView";
import DetailDrawer from "./DetailDrawer";
import DataGate from "./DataGate";
import { useStatus } from "./lib/status-context";
import { useFavorites } from "./lib/storage";

export default function AppShell() {
  const status = useStatus();
  const { favs, toggleFav, recordView } = useFavorites();
  const [view, setView] = useState<View>("explorer");
  const [meta, setMeta] = useState<MetaFacets | null>(null);
  const [openFn, setOpenFn] = useState<ApiFunction | null>(null);
  const [selectedTechnique, setSelectedTechnique] = useState<string | null>(null);

  const ready = status.ready;

  useEffect(() => {
    if (!ready) return;
    fetch("/api/meta", { cache: "no-store" })
      .then((r) => r.json())
      .then(setMeta)
      .catch(() => {});
  }, [ready, status.completedAt]);

  const openFunction = useCallback(
    (fn: ApiFunction) => {
      recordView(fn.id);
      setOpenFn(fn);
    },
    [recordView]
  );

  const goToTechnique = useCallback((id: string) => {
    setSelectedTechnique(id);
    setView("techniques");
  }, []);

  const isSelectedFav = useMemo(
    () => (openFn ? favs.includes(openFn.id) : false),
    [openFn, favs]
  );

  return (
    <div className="relative flex h-screen w-full overflow-hidden">
      <Sidebar view={view} setView={setView} favCount={favs.length} />

      <main className="flex flex-1 flex-col overflow-hidden">
        <TopStrip view={view} setView={setView} />
        {!ready ? (
          <DataGate onDone={() => setView("explorer")} />
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={view}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
              className="flex flex-1 flex-col overflow-hidden"
            >
              {view === "explorer" && <ExplorerView meta={meta} onOpen={openFunction} onTechnique={goToTechnique} />}
              {view === "techniques" && (
                <TechniquesView
                  selectedId={selectedTechnique}
                  onOpen={openFunction}
                  onClearSelection={() => setSelectedTechnique(null)}
                />
              )}
              {view === "favorites" && <SavedView kind="favorites" onOpen={openFunction} />}
              {view === "history" && <SavedView kind="history" onOpen={openFunction} />}
              {view === "sync" && <SyncView onDone={() => setView("explorer")} />}
            </motion.div>
          </AnimatePresence>
        )}
      </main>

      <DetailDrawer
        fn={openFn}
        isFav={isSelectedFav}
        status={status}
        onToggleFav={toggleFav}
        onClose={() => setOpenFn(null)}
        onTechnique={goToTechnique}
      />
    </div>
  );
}

const STEPS = ["scan", "map", "hit"];

function TopStrip({ view, setView }: { view: View; setView: (v: View) => void }) {
  const status = useStatus();
  return (
    <div className="glass sticky top-0 z-20 flex items-center gap-4 border-b border-border/50 px-5 py-2.5">
      <div className="flex items-center gap-3 font-mono text-[0.62rem] uppercase tracking-widest text-text-dim">
        {STEPS.map((s) => (
          <span key={s} className="flex items-center gap-1.5">
            <span className="text-text-dim/40">0{STEPS.indexOf(s) + 1}</span>
            <span className={view === "explorer" && s === "scan" ? "text-cyan" : ""}>{s}</span>
          </span>
        ))}
      </div>
      <div className="ml-auto flex items-center gap-3 font-mono text-[0.68rem]">
        <span className="flex items-center gap-1.5 text-text-dim">
          <span className="sync-dot" style={{ background: status.syncing ? "#00e5ff" : status.ready ? "#22c55e" : "#ef4444" }} />
          {status.syncing ? "syncing" : status.ready ? "db online" : "offline"}
        </span>
        {status.ready && (
          <>
            <span className="hidden text-text-dim/50 sm:inline">
              {status.counts.malapi + status.counts.syscalls} fns · {status.counts.techniques} techs
            </span>
            {status.completedAt && (
              <span className="hidden text-text-dim/40 md:inline">last sync {new Date(status.completedAt).toLocaleDateString()}</span>
            )}
          </>
        )}
        <button onClick={() => setView("sync")} className="text-cyan/70 hover:text-cyan" title="Data core">
          <SyncSmall />
        </button>
      </div>
    </div>
  );
}

function SyncSmall() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M21 12a9 9 0 1 1-3-6.7" />
      <path d="M21 3v6h-6" />
    </svg>
  );
}