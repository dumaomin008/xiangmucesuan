/**
 * 单位标准化：保留原始值/单位，输出标准值/标准单位。
 * 不做任何 KPI 计算。
 */

export type NormalizedUnit = {
  originalValue: string | number | null;
  originalUnit?: string;
  originalText?: string;
  normalizedValue: string | number | null;
  unit?: string;
};

const UNIT_ALIASES: Record<string, string> = {
  度: "元/kWh",
  "元/度": "元/kWh",
  "元/kwh": "元/kWh",
  "元/kWh": "元/kWh",
  公里: "km",
  千米: "km",
  km: "km",
  吨: "吨",
  t: "吨",
  "元/吨": "元",
  "元/t": "元",
  "元/趟": "元/趟",
  "元/月/车": "元",
  "元/车/月": "元",
  台: "台",
  趟: "趟",
  "kWh/km": "kWh/km",
  "度/公里": "kWh/km",
};

export function normalizeUnitLabel(raw?: string): string | undefined {
  if (!raw) return undefined;
  const key = raw.trim();
  return UNIT_ALIASES[key] || UNIT_ALIASES[key.toLowerCase()] || key;
}

/** 从自由文本解析数值+单位 */
export function parseValueWithUnit(text: string): NormalizedUnit {
  const trimmed = text.trim();
  const m = trimmed.match(/(-?\d+(?:\.\d+)?)\s*([^\d\s]*)/);
  if (!m) {
    return {
      originalValue: null,
      originalText: trimmed,
      normalizedValue: null,
    };
  }
  const num = Number(m[1]);
  const unitRaw = m[2] || undefined;
  return {
    originalValue: num,
    originalUnit: unitRaw,
    originalText: trimmed,
    normalizedValue: Number.isFinite(num) ? num : null,
    unit: normalizeUnitLabel(unitRaw),
  };
}

export function normalizeElectricity(value: number, unitHint?: string): NormalizedUnit {
  return {
    originalValue: value,
    originalUnit: unitHint || "元/度",
    originalText: `${value}${unitHint || "元/度"}`,
    normalizedValue: value,
    unit: "元/kWh",
  };
}

export function normalizeDistance(value: number, unitHint?: string): NormalizedUnit {
  return {
    originalValue: value,
    originalUnit: unitHint || "公里",
    originalText: `${value}${unitHint || "公里"}`,
    normalizedValue: value,
    unit: "km",
  };
}
