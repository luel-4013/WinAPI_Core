"use client";

import { motion } from "framer-motion";
import { CATEGORY_COLORS } from "./lib/colors";
import type { Category } from "@/lib/types";

export function CategoryBadge({ category, size }: { category: Category; size?: "sm" | "md" }) {
  const color = CATEGORY_COLORS[category] ?? "#94a3b8";
  return (
    <motion.span
      whileHover={{ scale: 1.02 }}
      className={`badge inline-flex items-center gap-1 whitespace-nowrap ${size === "sm" ? "text-[0.62rem]" : ""}`}
      style={{
        color,
        borderColor: color + "66",
        background: color + "11",
      }}
      title={category}
    >
      <span style={{ background: color }} className="inline-block h-1.5 w-1.5 rounded-full" />
      {category}
    </motion.span>
  );
}