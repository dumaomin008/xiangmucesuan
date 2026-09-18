"use client";

import { clsx } from "clsx";
import { Check } from "lucide-react";
import { WIZARD_STEPS } from "@/lib/workspace/types";

export function CalculationStepper({
  step,
  onChange,
}: {
  step: number;
  onChange: (index: number) => void;
}) {
  return (
    <ol className="mb-6 grid grid-cols-5 gap-2">
      {WIZARD_STEPS.map((item, index) => {
        const done = index < step;
        const current = index === step;
        return (
          <li key={item.key}>
            <button
              type="button"
              onClick={() => onChange(index)}
              className={clsx(
                "flex w-full items-center gap-2 rounded-sn-md px-3 py-3 text-left text-[13px] font-semibold transition duration-200",
                current && "bg-sn-primary text-white shadow-sn-card",
                done && "bg-white text-sn-primary shadow-sn-card",
                !current && !done && "bg-white text-sn-secondary shadow-sn-card",
              )}
            >
              <span
                className={clsx(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[12px]",
                  current ? "bg-white/15" : done ? "bg-sn-success/15 text-sn-success" : "bg-sn-hover",
                )}
              >
                {done ? <Check size={14} /> : index + 1}
              </span>
              <span className="truncate">
                {index + 1}. {item.label}
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
