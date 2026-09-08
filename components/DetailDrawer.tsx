"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { ApiFunction, SyncStatus } from "@/lib/types";
import { CategoryBadge } from "./CategoryBadge";
import { TechniqueChip } from "./TechniqueChip";
import { HeartIcon, CloseIcon, ExternalIcon, SyncIcon } from "./icons";
import { sourceColor, sourceLabel } from "./lib/colors";

export default function DetailDrawer({
  fn,
  isFav,
  status,
  onToggleFav,
  onClose,
  onTechnique,
}: {
  fn: ApiFunction | null;
  isFav: boolean;
  status: SyncStatus;
  onToggleFav: (id: string) => void;
  onClose: () => void;
  onTechnique: (id: string) => void;
}) {
  return (
    <AnimatePresence>
      {fn && (
        <>
          <motion.div
            key="scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-void/60 backdrop-blur-[2px]"
            onClick={onClose}
          />
          <motion.aside
            key="drawer"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 34 }}
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[560px] flex-col border-l border-cyan/20 bg-surface/95 shadow-[0_0_60px_rgba(0,229,255,0.15)] backdrop-blur-xl"
          >
            <DrawerBody fn={fn} isFav={isFav} status={status} onToggleFav={onToggleFav} onClose={onClose} onTechnique={onTechnique} />
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

function DrawerBody({
  fn,
  isFav,
  status,
  onToggleFav,
  onClose,
  onTechnique,
}: {
  fn: ApiFunction;
  isFav: boolean;
  status: SyncStatus;
  onToggleFav: (id: string) => void;
  onClose: () => void;
  onTechnique: (id: string) => void;
}) {
  const [localDoc, setLocalDoc] = useState<{ description: string; dll: string } | null>(null);
  const syscallVersions = Object.keys(fn.syscalls ?? {});

  useEffect(() => {
    setLocalDoc(null);
    if (!fn.localDoc) return;
    fetch(`/api/functions/${fn.id}/doc`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => d.ok && d.data && setLocalDoc(d.data))
      .catch(() => {});
  }, [fn.id, fn.localDoc]);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* header */}
      <div className="border-b border-border/50 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="mb-1 font-mono text-[0.62rem] uppercase tracking-[0.3em] text-cyan/70">api record</div>
            <h2 className="break-all font-mono text-xl font-bold text-text">{fn.name}</h2>
            <div className="mt-1 font-mono text-[0.7rem] uppercase tracking-wider text-text-dim">
              {fn.dll || "unknown dll"}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              onClick={() => onToggleFav(fn.id)}
              className={`rounded-md p-2 transition-colors ${isFav ? "text-magenta" : "text-text-dim hover:text-text"}`}
              title="Favorite"
            >
              <HeartIcon size={18} filled={isFav} />
            </button>
            <button onClick={onClose} className="rounded-md p-2 text-text-dim hover:text-text" title="Close">
              <CloseIcon />
            </button>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {fn.categories.map((c) => (
            <CategoryBadge key={c} category={c} />
          ))}
        </div>
      </div>

      {/* body */}
      <div className="flex-1 space-y-6 overflow-y-auto p-5">
        <section>
          <SectionLabel>description</SectionLabel>
          <p className="text-[0.85rem] leading-relaxed text-text">
            {localDoc?.description || fn.description || "No description available for this API."}
          </p>
          {fn.credit && <div className="mt-2 font-mono text-[0.62rem] text-text-dim">{fn.credit}</div>}
        </section>

        <section>
          <SectionLabel>associated attacks</SectionLabel>
          <div className="space-y-1.5">
            {fn.techniques.length === 0 && <div className="font-mono text-[0.7rem] text-text-dim">no attack mapping assigned</div>}
            {fn.techniques.map((t) => (
              <div key={t.id} className="flex items-start justify-between gap-2">
                <TechniqueChip tech={t} onClick={() => onTechnique(t.id)} />
                {t.tactic && <span className="pt-0.5 font-mono text-[0.62rem] uppercase tracking-wider text-text-dim">{t.tactic}</span>}
              </div>
            ))}
            {fn.categories.length > 0 && (
              <div className="pt-1 font-mono text-[0.6rem] italic text-text-dim/70">
                technique names above are pulled from MITRE ATT&CK; the category badges reflect malapi.io's own classification.
                Attack capability labels are only shown when a source provides them — no capability is invented.
              </div>
            )}
          </div>
        </section>

        {fn.ms && (fn.ms.dll || fn.ms.header || fn.ms.library || fn.ms.minClient || fn.ms.platform) && (
          <section>
            <SectionLabel>microsoft requirements</SectionLabel>
            <div className="grid grid-cols-2 gap-1.5">
              {[
                ["dll", fn.ms.dll],
                ["header", fn.ms.header],
                ["library", fn.ms.library],
                ["platform", fn.ms.platform],
                ["min client", fn.ms.minClient],
                ["min server", fn.ms.minServer],
              ]
                .filter(([, v]) => v)
                .map(([k, v]) => (
                  <div key={k as string} className="flex items-baseline justify-between gap-2 rounded border border-border/60 bg-void/40 px-2.5 py-1.5">
                    <span className="shrink-0 font-mono text-[0.6rem] uppercase tracking-wider text-text-dim">{k}</span>
                    <span className="truncate text-right font-mono text-[0.7rem] text-cyan" title={v}>
                      {v}
                    </span>
                  </div>
                ))}
            </div>
            {fn.ms.remarks && <p className="mt-2 text-[0.78rem] leading-relaxed text-text-dim">{fn.ms.remarks}</p>}
          </section>
        )}

        {fn.syscalls && syscallVersions.length > 0 && (
          <section>
            <SectionLabel>
              syscall index{" "}
              <span className="font-mono text-[0.6rem] normal-case tracking-normal text-text-dim">
                ({syscallVersions.length} versions)
              </span>
            </SectionLabel>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
              {Object.entries(fn.syscalls).map(([ver, num]) => (
                <div key={ver} className="flex items-center justify-between rounded border border-border/60 bg-void/40 px-2.5 py-1.5">
                  <span className="truncate font-mono text-[0.62rem] text-text-dim" title={ver}>
                    {ver}
                  </span>
                  <code className="font-mono text-[0.7rem] font-bold text-cyan">{num}</code>
                </div>
              ))}
            </div>
          </section>
        )}

        <section>
          <SectionLabel>sources</SectionLabel>
          <div className="flex flex-wrap gap-1.5">
            {fn.sources.map((s) => (
              <span
                key={s}
                className="badge"
                style={{ color: sourceColor(s), borderColor: sourceColor(s) + "66", background: sourceColor(s) + "11" }}
              >
                {sourceLabel(s)}
              </span>
            ))}
          </div>
        </section>

        <section>
          <SectionLabel>documentation</SectionLabel>
          <div className="space-y-1.5">
            {fn.docs.map((d) => (
              <a
                key={d.url + d.label}
                href={d.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center gap-2 rounded border border-border/60 px-3 py-2 font-mono text-[0.72rem] text-cyan/80 transition-colors hover:border-cyan/40 hover:text-cyan"
              >
                <ExternalIcon />
                {d.label}
                <span className="ml-auto max-w-[55%] truncate text-text-dim group-hover:text-text">{d.url.split("//")[1]}</span>
              </a>
            ))}
          </div>
        </section>

        {fn.aliases.length > 0 && (
          <section>
            <SectionLabel>aliases</SectionLabel>
            <div className="flex flex-wrap gap-1.5">
              {fn.aliases.map((a) => (
                <code key={a} className="rounded border border-border/60 px-2 py-0.5 font-mono text-[0.68rem] text-text-dim">
                  {a}
                </code>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* footer */}
      {status.catalogStage !== "done" && fn.sources.includes("catalog") && !localDoc && (
        <div className="flex items-center gap-2 border-t border-border/50 p-3 font-mono text-[0.62rem] text-amber/80">
          <SyncIcon size={12} />
          catalog content not downloaded — run “Full Catalog” in Data Core for local descriptions.
        </div>
      )}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-2 font-mono text-[0.66rem] font-bold uppercase tracking-[0.22em] text-cyan/70">{children}</div>
  );
}