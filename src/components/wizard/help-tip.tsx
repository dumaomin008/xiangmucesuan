"use client";

import { useEffect, useState } from "react";
import { clsx } from "clsx";
import { FIELD_HELP } from "@/lib/workspace/field-help";

export function HelpTip({ field }: { field: string }) {
  const help = FIELD_HELP[field];
  const [open, setOpen] = useState(false);
  if (!help) return null;
  return (
    <span className="relative inline-flex">
      <button
        type="button"
        className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-sn-hover text-[10px] font-semibold text-sn-secondary"
        aria-label="查看参数说明"
        onClick={() => setOpen((v) => !v)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      >
        ?
      </button>
      {open && (
        <div className="absolute left-0 top-6 z-20 w-72 rounded-sn-md border border-white/50 bg-white/90 p-3 text-left text-[12px] leading-5 text-sn-secondary shadow-sn-float backdrop-blur-[20px]">
          <p className="font-medium text-sn-primary">{help.what}</p>
          <p className="mt-1">为什么需要：{help.why}</p>
          <p>通常来源：{help.source}</p>
          <p>影响结果：{help.impacts}</p>
        </div>
      )}
    </span>
  );
}

export function SourceBadge({ source, overridden }: { source?: string; overridden?: boolean }) {
  if (!source) return null;
  return (
    <span
      className={clsx(
        "rounded-full px-2 py-0.5 text-[11px]",
        overridden ? "bg-sn-warning/15 text-[#C47B12]" : "bg-sn-hover text-sn-muted",
      )}
    >
      {overridden ? "已覆盖标准" : source}
    </span>
  );
}

export function LiveMetricCard({
  label,
  value,
  hint,
  highlight,
}: {
  label: string;
  value: string;
  hint?: string;
  highlight?: boolean;
}) {
  const [flash, setFlash] = useState(false);
  useEffect(() => {
    if (!highlight) return;
    setFlash(true);
    const t = setTimeout(() => setFlash(false), 700);
    return () => clearTimeout(t);
  }, [value, highlight]);
  return (
    <div className={clsx("rounded-sn-md bg-sn-subtle p-4 transition duration-300", flash && "ring-2 ring-sn-info/40")}>
      <div className="text-[12px] font-medium tracking-[0.04em] text-sn-muted">{label}</div>
      <div className="mt-1 text-[22px] font-bold tracking-[-0.02em]">{value}</div>
      {hint && <div className="mt-1 text-[12px] text-sn-muted">{hint}</div>}
    </div>
  );
}
