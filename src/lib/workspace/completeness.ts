import type { Scheme } from "./types";

export type Completeness = {
  percent: number;
  filled: number;
  required: number;
  computed: number;
  aiExtracted: number;
  pending: number;
  missing: string[];
};

function filledText(value: unknown) {
  return value !== null && value !== undefined && String(value).trim() !== "";
}

function filledPositive(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0;
}

export function calcCompleteness(scheme: Scheme, previewReady: boolean, aiExtracted = 0): Completeness {
  const missing: string[] = [];
  const checks: { ok: boolean; label: string }[] = [
    { ok: filledText(scheme.schemeName), label: "方案名称" },
    { ok: filledText(scheme.leaseType), label: "租赁形式" },
    { ok: filledPositive(scheme.fleetSize), label: "车队规模" },
    { ok: filledPositive(scheme.calculationYears), label: "测算年限" },
    { ok: filledPositive(scheme.financeTaxPlan.operatingMonthsYear ?? 12), label: "年运营月数" },
  ];

  const segments = scheme.routes.flatMap((route) => route.segments);
  if (scheme.routes.length === 0 || segments.length === 0) {
    checks.push({ ok: false, label: "至少一条运输线路" });
  }
  for (const seg of segments) {
    checks.push({ ok: filledText(seg.originName), label: `${seg.segmentName || "路段"}装货地` });
    checks.push({ ok: filledText(seg.destinationName), label: `${seg.segmentName || "路段"}卸货地` });
    checks.push({ ok: filledPositive(seg.distanceKm), label: `${seg.segmentName || "路段"}距离` });
    checks.push({ ok: filledText(seg.loadTon), label: `${seg.segmentName || "路段"}载重` });
    checks.push({ ok: filledPositive(seg.tripsPerVehicleMonth), label: `${seg.segmentName || "路段"}月趟数` });
    checks.push({ ok: filledText(seg.freightPrice), label: `${seg.segmentName || "路段"}运价` });
    checks.push({ ok: filledText(seg.electricityPrice), label: `${seg.segmentName || "路段"}电价` });
    checks.push({ ok: filledText(seg.loadedEnergyConsumption), label: `${seg.segmentName || "路段"}满载能耗` });
  }

  for (const item of checks) {
    if (!item.ok) missing.push(item.label);
  }
  const filled = checks.filter((item) => item.ok).length;
  const required = checks.length;
  const pending = missing.length;
  const computed = previewReady ? 6 : 0;
  const percent = required === 0 ? 0 : Math.round((filled / required) * 100);
  return { percent, filled, required, computed, aiExtracted, pending, missing };
}
