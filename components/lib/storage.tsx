"use client";

import { useEffect, useState, useCallback } from "react";
import type { ApiFunction } from "@/lib/types";

const FAV_KEY = "wapi:favorites";
const HIST_KEY = "wapi:history";

function load<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(key) ?? "[]");
  } catch {
    return [];
  }
}

function save(key: string, vals: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(vals));
  } catch {
    // ignore
  }
}

export function useFavorites() {
  const [favs, setFavs] = useState<string[]>([]);
  const [hist, setHist] = useState<string[]>([]);

  useEffect(() => {
    setFavs(load<string>(FAV_KEY));
    setHist(load<string>(HIST_KEY));
  }, []);

  const toggleFav = useCallback((id: string) => {
    setFavs((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      save(FAV_KEY, next);
      return next;
    });
  }, []);

  const recordView = useCallback((id: string) => {
    setHist((prev) => {
      const next = [id, ...prev.filter((x) => x !== id)].slice(0, 100);
      save(HIST_KEY, next);
      return next;
    });
  }, []);

  return { favs, hist, toggleFav, recordView };
}

/** Resolve ids to full function records (best-effort, cached per session). */
export function useResolveFunctions(ids: string[], ready: boolean): ApiFunction[] {
  const [map, setMap] = useState<Map<string, ApiFunction>>(new Map());
  useEffect(() => {
    if (!ready || ids.length === 0) return;
    const missing = ids.filter((i) => !map.has(i));
    if (missing.length === 0) return;
    let alive = true;
    fetch(`/api/functions?ids=${encodeURIComponent(missing.join(","))}&perPage=200`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        setMap((prev) => {
          const next = new Map(prev);
          for (const f of d.items ?? []) next.set(f.id, f);
          return next;
        });
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [ids.join(","), ready]);
  return ids.map((i) => map.get(i)).filter(Boolean) as ApiFunction[];
}