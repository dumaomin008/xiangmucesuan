import { flattenSchemeParams, type FlatParam } from "./flatten";
import type { Scheme } from "./types";

const IGNORE_DIFF_KEYS = new Set(["schemeName"]);

export type ParamChange = {
  key: string;
  label: string;
  group: string;
  from: string;
  to: string;
};

export function businessParamRows(scheme: Scheme): FlatParam[] {
  return flattenSchemeParams(scheme).filter((row) => !IGNORE_DIFF_KEYS.has(row.key));
}

export function diffSchemeParams(current: Scheme, source: Scheme): ParamChange[] {
  const currentRows = businessParamRows(current);
  const sourceMap = new Map(businessParamRows(source).map((row) => [row.key, row]));
  const keys = new Set([...currentRows.map((row) => row.key), ...sourceMap.keys()]);
  const changes: ParamChange[] = [];
  for (const key of keys) {
    const to = currentRows.find((row) => row.key === key);
    const from = sourceMap.get(key);
    const fromValue = from?.value ?? "";
    const toValue = to?.value ?? "";
    if (fromValue === toValue) continue;
    changes.push({
      key,
      label: to?.label || from?.label || key,
      group: to?.group || from?.group || "",
      from: fromValue || "—",
      to: toValue || "—",
    });
  }
  return changes;
}

export function summarizeParamChanges(changes: ParamChange[], limit = 6) {
  const labels = [...new Set(changes.map((item) => item.label.replace(/^.*· /, "")))];
  return {
    count: changes.length,
    labels: labels.slice(0, limit),
    extra: Math.max(0, labels.length - limit),
  };
}
