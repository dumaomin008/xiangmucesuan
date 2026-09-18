"use client";

import type { FieldIssue } from "@/lib/workspace/step-validate";
import { scrollToField } from "@/lib/workspace/step-validate";

export function StepIssueBanner({
  issues,
  onJump,
}: {
  issues: FieldIssue[];
  onJump?: (issue: FieldIssue) => void;
}) {
  if (!issues.length) return null;
  return (
    <div className="mb-4 rounded-sn-md bg-sn-error/12 px-4 py-3">
      <p className="text-sm font-semibold text-[#C44747]">当前还有 {issues.length} 项需要完成</p>
      <ul className="mt-2 space-y-1">
        {issues.map((item) => (
          <li key={`${item.field}-${item.message}`}>
            <button
              type="button"
              className="text-left text-sm text-[#C44747] underline-offset-2 hover:underline"
              onClick={() => {
                onJump?.(item);
                scrollToField(item.field);
              }}
            >
              {item.message}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
