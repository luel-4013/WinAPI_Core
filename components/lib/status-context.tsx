"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { SyncStatus } from "@/lib/types";
import { EMPTY_STATUS } from "@/lib/types";

const STATUS_POLL_MS = 2500;

const StatusContext = createContext<SyncStatus>(EMPTY_STATUS);

export function StatusProvider({ initial, children }: { initial?: SyncStatus; children: ReactNode }) {
  const [status, setStatus] = useState<SyncStatus>(initial ?? EMPTY_STATUS);

  useEffect(() => {
    let alive = true;
    async function poll() {
      try {
        const res = await fetch("/api/status", { cache: "no-store" });
        const data = await res.json();
        if (alive) setStatus(data);
      } catch {
        // ignore transient errors
      }
    }
    poll();
    const id = setInterval(poll, STATUS_POLL_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  return <StatusContext.Provider value={status}>{children}</StatusContext.Provider>;
}

export function useStatus() {
  return useContext(StatusContext);
}