"use client";

import type { ApiFunction } from "@/lib/types";
import FunctionCard from "./FunctionCard";
import { useFavorites, useResolveFunctions } from "./lib/storage";
import { useStatus } from "./lib/status-context";

export default function SavedView({ kind, onOpen }: { kind: "favorites" | "history"; onOpen: (f: ApiFunction) => void }) {
  const { favs, hist, toggleFav } = useFavorites();
  const { ready } = useStatus();
  const ids = kind === "favorites" ? favs : hist;
  const items = useResolveFunctions(ids, ready);

  return (
    <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-5">
      <div className="font-mono text-[0.68rem] uppercase tracking-wider text-text-dim">
        <span className="text-cyan font-bold">{ids.length}</span> {kind} stored locally
      </div>

      {ids.length === 0 ? (
        <div className="flex flex-1 items-center justify-center py-24 text-center font-mono text-sm text-text-dim">
          {kind === "favorites"
            ? "no favorites yet — hit the heart on any function"
            : "no history yet — open a function to record it here"}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {items.map((fn) => (
            <FunctionCard
              key={fn.id}
              fn={fn}
              isFav={kind === "favorites"}
              onToggleFav={toggleFav}
              onOpen={onOpen}
            />
          ))}
        </div>
      )}
    </div>
  );
}