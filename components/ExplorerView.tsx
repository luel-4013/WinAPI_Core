"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { ApiFunction, MetaFacets } from "@/lib/types";
import FunctionCard from "./FunctionCard";
import { SearchIcon } from "./icons";
import { useFavorites } from "./lib/storage";

export interface ExplorerFilters {
  q: string;
  category: string;
  dll: string;
  tactic: string;
  source: string;
}

export default function ExplorerView({
  meta,
  onOpen,
  onTechnique,
}: {
  meta: MetaFacets | null;
  onOpen: (fn: ApiFunction) => void;
  onTechnique: (id: string, from?: "explorer") => void;
}) {
  const { favs, toggleFav } = useFavorites();
  const [filters, setFilters] = useState<ExplorerFilters>({ q: "", category: "", dll: "", tactic: "", source: "" });
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<ApiFunction[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const qTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(
    async (f: ExplorerFilters, p: number) => {
      setLoading(true);
      const params = new URLSearchParams();
      if (f.q) params.set("q", f.q);
      if (f.category) params.set("category", f.category);
      if (f.dll) params.set("dll", f.dll);
      if (f.tactic) params.set("tactic", f.tactic);
      if (f.source) params.set("source", f.source);
      params.set("page", String(p));
      params.set("perPage", "48");
      try {
        const res = await fetch(`/api/functions?${params.toString()}`, { cache: "no-store" });
        const data = await res.json();
        setItems(data.items ?? []);
        setTotal(data.total ?? 0);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    load(filters, page);
  }, [filters, page, load]);

  const onQ = (val: string) => {
    if (qTimer.current) clearTimeout(qTimer.current);
    qTimer.current = setTimeout(() => {
      setFilters((f) => ({ ...f, q: val }));
      setPage(1);
    }, 250);
  };

  const sel = "";

  return (
    <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-5">
      <div className="flex flex-wrap items-center gap-2">
        <div className="glass clip-corners-sm flex flex-1 items-center gap-2 py-2 pl-3 pr-2 min-w-[240px]">
          <SearchIcon size={15} />
          <input
            defaultValue={filters.q}
            onChange={(e) => onQ(e.target.value)}
            placeholder="search functions, dlls, descriptions, categories…"
            className="w-full bg-transparent font-mono text-sm text-text placeholder:text-text-dim/50 focus:outline-none"
            spellCheck={false}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
          <Select
            value={sel}
            placeholder="category"
            onChange={(v) => {
              setFilters((f) => ({ ...f, category: v }));
              setPage(1);
            }}
            options={meta?.categories ?? []}
            resetValue={filters.category}
          />
          <Select
            value={sel}
            placeholder="dll"
            onChange={(v) => {
              setFilters((f) => ({ ...f, dll: v }));
              setPage(1);
            }}
            options={meta?.dlls ?? []}
            resetValue={filters.dll}
          />
          <Select
            value={sel}
            placeholder="tactic"
            onChange={(v) => {
              setFilters((f) => ({ ...f, tactic: v }));
              setPage(1);
            }}
            options={meta?.tactics ?? []}
            resetValue={filters.tactic}
          />
          <Select
            value={sel}
            placeholder="source"
            onChange={(v) => {
              setFilters((f) => ({ ...f, source: v }));
              setPage(1);
            }}
            options={meta?.sources ?? []}
            resetValue={filters.source}
          />
        </div>
      </div>

      <div className="flex items-center justify-between font-mono text-[0.68rem] uppercase tracking-wider text-text-dim">
        <span>
          {loading ? "scanning…" : (
            <>
              <span className="font-bold text-cyan">{total}</span> result{total === 1 ? "" : "s"}
              {Object.values(filters).some((v) => v) && (
                <button
                  onClick={() => setFilters({ q: "", category: "", dll: "", tactic: "", source: "" })}
                  className="ml-3 text-red/80 hover:text-red"
                >
                  [clear filters]
                </button>
              )}
            </>
          )}
        </span>
      </div>

      <AnimatePresence mode="popLayout">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {items.map((fn) => (
            <FunctionCard
              key={fn.id}
              fn={fn}
              isFav={favs.includes(fn.id)}
              onToggleFav={toggleFav}
              onOpen={onOpen}
              onTechnique={(id) => onTechnique(id, "explorer")}
            />
          ))}
        </div>
      </AnimatePresence>

      {!loading && items.length === 0 && (
        <div className="flex flex-1 items-center justify-center py-24 font-mono text-sm text-text-dim">
          no functions matched — adjust filters or run a sync
        </div>
      )}

      {Math.ceil(total / 48) > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2 font-mono text-xs">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="rounded border border-border px-3 py-1.5 transition-colors hover:border-cyan/50 disabled:opacity-30"
          >
            ← prev
          </button>
          <span className="px-2 text-text-dim">
            page <span className="text-cyan">{page}</span> / {Math.ceil(total / 48)}
          </span>
          <button
            disabled={page >= Math.ceil(total / 48)}
            onClick={() => setPage((p) => p + 1)}
            className="rounded border border-border px-3 py-1.5 transition-colors hover:border-cyan/50 disabled:opacity-30"
          >
            next →
          </button>
        </div>
      )}
    </div>
  );
}

function Select({
  placeholder,
  options,
  value,
  resetValue,
  onChange,
}: {
  placeholder: string;
  options: { name?: string; id?: string; count?: number }[];
  value: string;
  resetValue: string;
  onChange: (v: string) => void;
}) {
  const effective = resetValue;
  return (
    <select
      value={effective}
      onChange={(e) => onChange(e.target.value)}
      className={`rounded border px-2 py-2 font-mono text-xs transition-colors focus:outline-none ${
        effective ? "border-cyan/50 text-cyan bg-cyan/5" : "border-border text-text-dim bg-transparent hover:border-cyan/40"
      }`}
    >
      <option value="">
        {placeholder}
      </option>
      {options.map((o) => {
        const k = o.id ?? o.name ?? "";
        return (
          <option key={k} value={k} className="bg-surface">
            {o.name ?? o.id} ({o.count ?? 0})
          </option>
        );
      })}
    </select>
  );
}