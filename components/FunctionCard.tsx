"use client";

import { motion } from "framer-motion";
import type { ApiFunction } from "@/lib/types";
import { CategoryBadge } from "./CategoryBadge";
import { TechniqueChip } from "./TechniqueChip";
import { HeartIcon } from "./icons";
import { sourceColor, sourceLabel } from "./lib/colors";

export default function FunctionCard({
  fn,
  isFav,
  onToggleFav,
  onOpen,
  onTechnique,
}: {
  fn: ApiFunction;
  isFav: boolean;
  onToggleFav: (id: string) => void;
  onOpen: (fn: ApiFunction) => void;
  onTechnique?: (id: string) => void;
}) {
  const src = fn.sources[0] ?? "catalog";
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      className="glass clip-corners-sm group flex cursor-pointer flex-col gap-3 p-4 transition-colors hover:glow-border"
      onClick={() => onOpen(fn)}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span
              className="inline-block h-2 w-2 shrink-0 rounded-sm"
              style={{ background: sourceColor(src), boxShadow: `0 0 8px ${sourceColor(src)}` }}
            />
            <h3 className="truncate font-mono text-[0.95rem] font-bold tracking-tight text-text group-hover:text-cyan">
              {fn.name}
            </h3>
          </div>
          <div className="mt-1.5 font-mono text-[0.62rem] uppercase tracking-wider text-text-dim">
            {fn.dll || "n/a"}
            <span className="mx-1.5 text-border">/</span>
            {sourceLabel(src)}
          </div>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleFav(fn.id);
          }}
          className={`shrink-0 rounded p-1 transition-colors ${isFav ? "text-magenta" : "text-text-dim/50 hover:text-text"}`}
          title={isFav ? "Remove from favorites" : "Add to favorites"}
        >
          <HeartIcon size={15} filled={isFav} />
        </button>
      </div>

      <p className="line-clamp-2 text-[0.78rem] leading-relaxed text-text-dim">{fn.description || "—"}</p>

      <div className="mt-auto flex flex-wrap items-center gap-1.5">
        {fn.categories.slice(0, 3).map((c) => (
          <CategoryBadge key={c} category={c} size="sm" />
        ))}
        {fn.techniques.slice(0, 2).map((t) => (
          <TechniqueChip
            key={t.id}
            tech={t}
            compact
            onClick={() => onTechnique?.(t.id)}
          />
        ))}
        {(fn.categories.length > 3 || (fn.techniques.length > 2 && fn.techniques.length)) && (
          <span className="font-mono text-[0.6rem] text-text-dim">+</span>
        )}
      </div>
    </motion.div>
  );
}