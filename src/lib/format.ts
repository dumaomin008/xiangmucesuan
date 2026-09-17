export function formatFirstPositiveMonth(month: number | null | undefined): string {
  if (month === null || month === undefined) return "测算期内未转正";
  if (month === 0) return "无需回收初始投资";
  return `第 ${month} 月`;
}

export function formatMonthLabel(monthIndex: number): string {
  if (monthIndex === 0) return "0期 / 初始投入";
  return String(monthIndex);
}

export function formatMoney(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  const n = Number(value);
  if (!Number.isFinite(n)) return "无法计算";
  return n.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatPercent(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "无法计算";
  const n = Number(value);
  if (!Number.isFinite(n)) return "无法计算";
  return `${(n * 100).toFixed(2)}%`;
}

export function formatQty(value: string | number | null | undefined, digits = 2): string {
  if (value === null || value === undefined || value === "") return "—";
  const n = Number(value);
  if (!Number.isFinite(n)) return "无法计算";
  return n.toLocaleString("zh-CN", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("zh-CN", { hour12: false });
}

export { explainUnavailable, PARAMETER_SOURCE_LABEL } from "./engine/reasons";

export const STATUS_LABEL: Record<string, string> = {
  draft: "草稿",
  calculated: "已测算",
  baseline: "基准",
  archived: "已归档",
};
