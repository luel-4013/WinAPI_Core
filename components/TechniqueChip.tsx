"use client";

import { motion } from "framer-motion";
import type { TechniqueRef } from "@/lib/types";

export function TechniqueChip({ tech, onClick, compact }: { tech: TechniqueRef; onClick?: () => void; compact?: boolean }) {
  const el = onClick ? (
    <a
      onClick={(e) => {
        e.preventDefault();
        onClick();
      }}
      href="#"
      className="inline-flex no-underline"
    >
      <ChipBody tech={tech} compact={compact} interactive />
    </a>
  ) : (
    <ChipBody tech={tech} compact={compact} />
  );
  return el;
}

function ChipBody({ tech, compact, interactive }: { tech: TechniqueRef; compact?: boolean; interactive?: boolean }) {
  return (
    <motion.span
      whileHover={interactive ? { scale: 1.03 } : undefined}
      className={`badge inline-flex items-center gap-1.5 whitespace-nowrap ${compact ? "text-[0.62rem]" : ""}`}
      style={{
        color: "#c4b5fd",
        borderColor: "#7c3aed55",
        background: "#7c3aed14",
      }}
    >
      <span className="font-bold" style={{ color: "#a78bfa" }}>[{tech.id}]</span>
      {tech.name}
    </motion.span>
  );
}