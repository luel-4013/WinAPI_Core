"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { ApiFunction, Technique } from "@/lib/types";
import { ChevronIcon, SearchIcon, ExternalIcon } from "./icons";
import FunctionCard from "./FunctionCard";
import { useFavorites } from "./lib/storage";
import { TACTIC_COLORS } from "./lib/colors";

interface TechniqueItem extends Technique {
  functionCount: number;
}

export default function TechniquesView({
  selectedId,
  onOpen,
  onClearSelection,
}: {
  selectedId: string | null;
  onOpen: (fn: ApiFunction) => void;
  onClearSelection: () => void;
}) {
  const { favs, toggleFav, recordView } = useFavorites();
  const [list, setList] = useState<TechniqueItem[]>([]);
  const [tactics, setTactics] = useState<string[]>([]);
  const [q, setQ] = useState("");
  const [tactic, setTactic] = useState("");
  const [selected, setSelected] = useState<TechniqueItem | null>(null);

  useEffect(() => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (tactic) params.set("tactic", tactic);
    params.set("perPage", "500");
    fetch(`/api/techniques?${params.toString()}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        setList(d.items ?? []);
        setTactics(d.tactics?.map((t: { id: string }) => t.id) ?? []);
      })
      .catch(() => {});
  }, [q, tactic]);

  const selectTechnique = useCallback(
    (id: string) => {
      const found = list.find((t) => t.id === id);
      if (found) setSelected(found);
    },
    [list]
  );

  // When navigated here with a selectedId (e.g. from a function card)
  useEffect(() => {
    if (selectedId && !selected) selectTechnique(selectedId);
  }, [selectedId, selected, selectTechnique]);

  const grouped = new Map<string, TechniqueItem[]>();
  for (const t of list) {
    const key = t.tactic || "Unknown";
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(t);
  }

  return (
    <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-5">
      <div className="flex flex-wrap items-center gap-2">
        <div className="glass clip-corners-sm flex flex-1 items-center gap-2 px-3 py-2 min-w-[240px]">
          <SearchIcon size={15} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="search techniques by id / name…"
            className="w-full bg-transparent font-mono text-sm text-text placeholder:text-text-dim/50 focus:outline-none"
            spellCheck={false}
          />
        </div>
        <select
          value={tactic}
          onChange={(e) => setTactic(e.target.value)}
          className="rounded border border-border bg-transparent px-2 py-2 font-mono text-xs text-text-dim focus:outline-none"
        >
          <option value="">all tactics</option>
          {tactics.map((t) => (
            <option key={t} value={t} className="bg-surface">
              {t}
            </option>
          ))}
        </select>
      </div>

      <div className="font-mono text-[0.68rem] uppercase tracking-wider text-text-dim">
        <span className="text-cyan font-bold">{list.length}</span> techniques
      </div>

      <AnimatePresence mode="popLayout">
        {selected ? (
          <TechniqueDetail
            key="detail"
            item={selected}
            favs={favs}
            toggleFav={toggleFav}
            recordView={recordView}
            onOpen={onOpen}
            onBack={() => {
              setSelected(null);
              onClearSelection();
            }}
          />
        ) : (
          <motion.div key="list" className="space-y-5">
            {[...grouped.entries()].map(([tacticName, items]) => (
              <section key={tacticName}>
                <div
                  className="mb-2 flex items-center gap-2 font-mono text-[0.72rem] font-bold uppercase tracking-[0.2em]"
                  style={{ color: TACTIC_COLORS[tacticName] ?? "#94a3b8" }}
                >
                  <span
                    className="inline-block h-2 w-2 rounded-sm"
                    style={{ background: TACTIC_COLORS[tacticName] ?? "#94a3b8" }}
                  />
                  {tacticName}
                  <span className="font-normal text-text-dim">({items.length})</span>
                </div>
                <div className="grid grid-cols-1 gap-1.5 md:grid-cols-2 xl:grid-cols-3">
                  {items.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => {
                        selectTechnique(t.id);
                        onClearSelection();
                      }}
                      className="group flex items-center gap-2 rounded border border-border/60 bg-void/30 px-3 py-2 text-left transition-colors hover:border-violet/50 hover:bg-violet/5"
                    >
                      <ChevronIcon size={12} dir="right" className="text-text-dim/40" />
                      <code className="shrink-0 font-mono text-[0.72rem] font-bold text-violet">{t.id}</code>
                      <span className="truncate text-[0.8rem] text-text group-hover:text-violet">{t.name}</span>
                      <span className="ml-auto shrink-0 font-mono text-[0.62rem] text-text-dim">{t.functionCount}</span>
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function TechniqueDetail({
  item,
  favs,
  toggleFav,
  recordView,
  onOpen,
  onBack,
}: {
  item: TechniqueItem;
  favs: string[];
  toggleFav: (id: string) => void;
  recordView: (id: string) => void;
  onOpen: (fn: ApiFunction) => void;
  onBack: () => void;
}) {
  const [functions, setFunctions] = useState<ApiFunction[]>([]);
  useEffect(() => {
    fetch(`/api/techniques/${item.id}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => d.ok && setFunctions(d.data.functions ?? []))
      .catch(() => {});
  }, [item.id]);

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
      <button onClick={onBack} className="mb-4 flex items-center gap-2 font-mono text-xs text-cyan hover:text-cyan/70">
        <ChevronIcon size={14} dir="left" /> back to technique list
      </button>

      <div className="glass clip-corners-sm p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="font-mono text-[0.62rem] uppercase tracking-[0.3em] text-violet">technique</div>
            <h2 className="mt-1 font-mono text-lg font-bold text-text">
              <span className="text-violet">[{item.id}]</span> {item.name}
            </h2>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {item.tactics.map((t) => (
                <span
                  key={t}
                  className="badge"
                  style={{ color: TACTIC_COLORS[t] ?? "#94a3b8", borderColor: (TACTIC_COLORS[t] ?? "#94a3b8") + "66" }}
                >
                  {t}
                </span>
              ))}
            </div>
          </div>
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded border border-border px-2.5 py-1.5 font-mono text-[0.7rem] text-text-dim transition-colors hover:border-cyan/50 hover:text-cyan"
          >
            <ExternalIcon /> mitre
          </a>
        </div>
        {item.description && <p className="mt-4 text-[0.8rem] leading-relaxed text-text-dim">{item.description}</p>}
      </div>

      <div className="mt-5 mb-2 font-mono text-[0.68rem] uppercase tracking-wider text-text-dim">
        <span className="text-cyan font-bold">{functions.length}</span> api functions mapped to this technique
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {functions.map((fn) => (
          <FunctionCard
            key={fn.id}
            fn={fn}
            isFav={favs.includes(fn.id)}
            onToggleFav={toggleFav}
            onOpen={(f) => {
              recordView(f.id);
              onOpen(f);
            }}
          />
        ))}
      </div>
    </motion.div>
  );
}