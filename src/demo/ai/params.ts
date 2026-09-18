import type { SchemeCalculationInput } from "@/calculation";
import { cloneJson } from "../utils";

/** AI 可识别/可修改的经营参数（映射到真实输入，不做公式计算） */
export type AssistantParamKey =
  | "electricityPrice"
  | "fleetSize"
  | "freightPrice"
  | "tripsPerVehicleMonth"
  | "distanceKm"
  | "loadTon"
  | "loadedEnergyConsumption"
  | "driverCostPerTrip"
  | "monthlyRentPerVehicle";

/** 参数作用域：车辆/项目级 vs 线路/路段级 */
export type ParamScope = "project" | "vehicle" | "all_routes" | "route" | "segment";

export type ParamPatch = {
  field: AssistantParamKey;
  label: string;
  operation: "set" | "add" | "multiply";
  value: number;
  unit: string;
  scope?: ParamScope;
  routeId?: string;
  segmentId?: string;
};

export type ParamSnapshot = {
  field: AssistantParamKey;
  label: string;
  value: number | null;
  unit: string;
  display: string;
};

export type SegmentParamLocation = {
  routeId: string;
  routeName: string;
  segmentId: string;
  segmentName: string;
  value: number | null;
};

export type ParamValidationIssue = {
  level: "error" | "warning";
  field: AssistantParamKey;
  message: string;
};

const FIELD_META: Record<AssistantParamKey, { label: string; unit: string; scopeLevel: "vehicle" | "segment" }> = {
  electricityPrice: { label: "电价", unit: "元/kWh", scopeLevel: "segment" },
  fleetSize: { label: "车辆数", unit: "台", scopeLevel: "vehicle" },
  freightPrice: { label: "运价", unit: "元", scopeLevel: "segment" },
  tripsPerVehicleMonth: { label: "单车月趟次", unit: "趟", scopeLevel: "segment" },
  distanceKm: { label: "里程", unit: "km", scopeLevel: "segment" },
  loadTon: { label: "载重", unit: "吨", scopeLevel: "segment" },
  loadedEnergyConsumption: { label: "重载能耗", unit: "kWh/km", scopeLevel: "segment" },
  driverCostPerTrip: { label: "司机成本", unit: "元/趟", scopeLevel: "segment" },
  monthlyRentPerVehicle: { label: "单车月租", unit: "元", scopeLevel: "vehicle" },
};

/** 硬性非法：不得进入引擎 */
const HARD_RULES: Record<AssistantParamKey, (n: number) => string | null> = {
  electricityPrice: (n) => (n < 0 ? "电价不能为负数" : null),
  fleetSize: (n) => (n <= 0 ? "车辆数必须大于 0" : null),
  freightPrice: (n) => (n < 0 ? "运价不能为负数" : null),
  tripsPerVehicleMonth: (n) => (n < 0 ? "趟次不能为负数" : null),
  distanceKm: (n) => (n <= 0 ? "里程必须大于 0" : null),
  loadTon: (n) => (n < 0 ? "载重不能为负数" : null),
  loadedEnergyConsumption: (n) => (n < 0 ? "能耗不能为负数" : null),
  driverCostPerTrip: (n) => (n < 0 ? "司机成本不能为负数" : null),
  monthlyRentPerVehicle: (n) => (n < 0 ? "月租不能为负数" : null),
};

/** 明显偏离常规但仍数学合法：提示二次确认，不擅自纠正 */
const SOFT_RANGE: Record<AssistantParamKey, { min?: number; max?: number; hint: string }> = {
  electricityPrice: { min: 0.1, max: 5, hint: "常规电价多在 0.1～5 元/kWh" },
  fleetSize: { min: 1, max: 2000, hint: "常规车辆数多在 1～2000 台" },
  freightPrice: { min: 1, max: 2000, hint: "常规运价多在 1～2000 元量级" },
  tripsPerVehicleMonth: { min: 1, max: 60, hint: "常规单车月趟次多在 1～60 趟" },
  distanceKm: { min: 1, max: 2000, hint: "常规里程多在 1～2000 km" },
  loadTon: { min: 0.1, max: 80, hint: "常规载重多在 0.1～80 吨" },
  loadedEnergyConsumption: { min: 0.2, max: 5, hint: "常规重载能耗多在 0.2～5 kWh/km" },
  driverCostPerTrip: { min: 0, max: 2000, hint: "常规司机单趟成本多在 0～2000 元" },
  monthlyRentPerVehicle: { min: 1000, max: 50000, hint: "常规单车月租多在 1000～50000 元" },
};

function firstSegment(inputs: SchemeCalculationInput) {
  return inputs.routes?.[0]?.segments?.[0];
}

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function fieldScopeLevel(field: AssistantParamKey): "vehicle" | "segment" {
  return FIELD_META[field].scopeLevel;
}

export function defaultScopeForField(field: AssistantParamKey): ParamScope {
  return FIELD_META[field].scopeLevel === "vehicle" ? "vehicle" : "all_routes";
}

export function listSegmentParamLocations(
  inputs: SchemeCalculationInput,
  field: AssistantParamKey,
): SegmentParamLocation[] {
  if (FIELD_META[field].scopeLevel !== "segment") return [];
  const key = field as Exclude<AssistantParamKey, "fleetSize" | "monthlyRentPerVehicle">;
  const rows: SegmentParamLocation[] = [];
  for (const route of inputs.routes || []) {
    for (const seg of route.segments || []) {
      rows.push({
        routeId: route.id,
        routeName: route.routeName || route.routeCode || route.id,
        segmentId: seg.id,
        segmentName: seg.segmentName || seg.id,
        value: num((seg as unknown as Record<string, unknown>)[key]),
      });
    }
  }
  return rows;
}

export function getParamValue(
  inputs: SchemeCalculationInput,
  field: AssistantParamKey,
  scope?: { scope?: ParamScope; routeId?: string; segmentId?: string },
): number | null {
  if (field === "fleetSize") {
    return num(inputs.fleetSize ?? inputs.vehicle?.fleetSize);
  }
  if (field === "monthlyRentPerVehicle") {
    return num(inputs.vehicle?.monthlyRentPerVehicle);
  }

  const locs = listSegmentParamLocations(inputs, field);
  if (!locs.length) return null;

  if (scope?.scope === "segment" && scope.segmentId) {
    return locs.find((l) => l.segmentId === scope.segmentId)?.value ?? null;
  }
  if (scope?.scope === "route" && scope.routeId) {
    const routeVals = locs.filter((l) => l.routeId === scope.routeId).map((l) => l.value);
    const finite = routeVals.filter((v): v is number => v != null);
    if (!finite.length) return null;
    if (finite.every((v) => v === finite[0])) return finite[0];
    return finite[0];
  }

  // 默认读取：若全部路段一致返回该值，否则返回首路段（仅用于展示参考）
  const finite = locs.map((l) => l.value).filter((v): v is number => v != null);
  if (!finite.length) return null;
  if (finite.every((v) => v === finite[0])) return finite[0];
  return locs[0]?.value ?? null;
}

export function describeParamValues(inputs: SchemeCalculationInput, field: AssistantParamKey): string {
  if (FIELD_META[field].scopeLevel === "vehicle") {
    const v = getParamValue(inputs, field);
    return v == null ? "—" : String(v);
  }
  const locs = listSegmentParamLocations(inputs, field);
  if (!locs.length) return "—";
  const finite = locs.map((l) => l.value);
  if (finite.every((v) => v === finite[0])) return finite[0] == null ? "—" : String(finite[0]);
  return locs.map((l) => `${l.routeName}/${l.segmentName}=${l.value ?? "—"}`).join("；");
}

export function areSegmentValuesEqual(inputs: SchemeCalculationInput, field: AssistantParamKey): boolean {
  if (FIELD_META[field].scopeLevel !== "segment") return true;
  const locs = listSegmentParamLocations(inputs, field);
  if (locs.length <= 1) return true;
  const first = locs[0]?.value;
  return locs.every((l) => l.value === first);
}

export function countSegments(inputs: SchemeCalculationInput): number {
  return (inputs.routes || []).reduce((n, r) => n + (r.segments?.length || 0), 0);
}

export function resolveComputedValue(
  inputs: SchemeCalculationInput,
  patch: ParamPatch,
): number | null {
  const current = getParamValue(inputs, patch.field, patch);
  if (patch.operation === "set") return patch.value;
  if (patch.operation === "add") return (current ?? 0) + patch.value;
  if (current == null) return null;
  return current * patch.value;
}

export function validateParamValue(
  field: AssistantParamKey,
  nextValue: number,
): ParamValidationIssue | null {
  const hard = HARD_RULES[field](nextValue);
  if (hard) return { level: "error", field, message: hard };
  const soft = SOFT_RANGE[field];
  if (soft.min != null && nextValue < soft.min) {
    return { level: "warning", field, message: `${FIELD_META[field].label}=${nextValue} 明显偏低（${soft.hint}），请确认是否仍要修改` };
  }
  if (soft.max != null && nextValue > soft.max) {
    return { level: "warning", field, message: `${FIELD_META[field].label}=${nextValue} 明显偏高（${soft.hint}），请确认是否仍要修改` };
  }
  return null;
}

export function validatePatches(
  inputs: SchemeCalculationInput,
  patches: ParamPatch[],
): { errors: ParamValidationIssue[]; warnings: ParamValidationIssue[] } {
  const errors: ParamValidationIssue[] = [];
  const warnings: ParamValidationIssue[] = [];
  for (const patch of patches) {
    const next = resolveComputedValue(inputs, patch);
    if (next == null || !Number.isFinite(next)) {
      errors.push({ level: "error", field: patch.field, message: `${patch.label}无法计算目标值` });
      continue;
    }
    const issue = validateParamValue(patch.field, next);
    if (!issue) continue;
    if (issue.level === "error") errors.push(issue);
    else warnings.push(issue);
  }
  return { errors, warnings };
}

export function snapshotParams(inputs: SchemeCalculationInput): ParamSnapshot[] {
  return (Object.keys(FIELD_META) as AssistantParamKey[]).map((field) => {
    const meta = FIELD_META[field];
    const value = getParamValue(inputs, field);
    return {
      field,
      label: meta.label,
      value,
      unit: meta.unit,
      display: value == null ? "—" : `${value}${meta.unit ? ` ${meta.unit}` : ""}`,
    };
  });
}

function applyOne(inputs: SchemeCalculationInput, patch: ParamPatch): void {
  const current = getParamValue(inputs, patch.field, patch);
  let next: number;
  if (patch.operation === "set") next = patch.value;
  else if (patch.operation === "add") next = (current ?? 0) + patch.value;
  else next = (current ?? 0) * patch.value;

  if (patch.field === "fleetSize") {
    const n = Math.max(1, Math.round(next));
    inputs.fleetSize = n;
    if (inputs.vehicle) inputs.vehicle.fleetSize = n;
    return;
  }
  if (patch.field === "monthlyRentPerVehicle") {
    if (inputs.vehicle) inputs.vehicle.monthlyRentPerVehicle = String(next);
    return;
  }

  const key = patch.field as Exclude<AssistantParamKey, "fleetSize" | "monthlyRentPerVehicle">;
  const scope = patch.scope || "all_routes";

  for (const route of inputs.routes || []) {
    if (scope === "route" && patch.routeId && route.id !== patch.routeId) continue;
    for (const seg of route.segments || []) {
      if (scope === "segment" && patch.segmentId && seg.id !== patch.segmentId) continue;
      if (scope === "route" || scope === "segment" || scope === "all_routes") {
        (seg as unknown as Record<string, string>)[key] = String(next);
      }
    }
  }
}

export function applyParamPatches(
  inputs: SchemeCalculationInput,
  patches: ParamPatch[],
): {
  inputs: SchemeCalculationInput;
  changes: {
    field: AssistantParamKey;
    label: string;
    from: string;
    to: string;
    unit: string;
    scope: ParamScope;
    scopeLabel: string;
  }[];
} {
  const next = cloneJson(inputs);
  const changes = patches.map((patch) => {
    const meta = FIELD_META[patch.field];
    const scope = patch.scope || defaultScopeForField(patch.field);
    const fromText =
      meta.scopeLevel === "segment" && scope === "all_routes" && !areSegmentValuesEqual(inputs, patch.field)
        ? describeParamValues(inputs, patch.field)
        : (() => {
            const fromVal = getParamValue(next, patch.field, patch);
            return fromVal == null ? "—" : String(fromVal);
          })();
    applyOne(next, { ...patch, scope });
    const toVal = getParamValue(next, patch.field, { ...patch, scope });
    return {
      field: patch.field,
      label: meta.label,
      from: fromText,
      to: toVal == null ? "—" : String(toVal),
      unit: meta.unit,
      scope,
      scopeLabel: formatScopeLabel(inputs, { ...patch, scope }),
    };
  });
  return { inputs: next, changes };
}

export function formatScopeLabel(
  inputs: SchemeCalculationInput,
  patch: Pick<ParamPatch, "scope" | "routeId" | "segmentId" | "field">,
): string {
  const scope = patch.scope || defaultScopeForField(patch.field);
  if (scope === "project" || scope === "vehicle") return "项目/车辆级";
  if (scope === "all_routes") {
    const n = countSegments(inputs);
    return n <= 1 ? "当前路段" : `全部${n}个路段`;
  }
  if (scope === "route") {
    const route = (inputs.routes || []).find((r) => r.id === patch.routeId);
    return route ? `线路「${route.routeName || route.id}」` : "指定线路";
  }
  if (scope === "segment") {
    for (const route of inputs.routes || []) {
      const seg = (route.segments || []).find((s) => s.id === patch.segmentId);
      if (seg) return `路段「${route.routeName}/${seg.segmentName}」`;
    }
    return "指定路段";
  }
  return "未指定";
}

export function describePatches(patches: ParamPatch[], inputs: SchemeCalculationInput): string {
  return patches
    .map((p) => {
      const preview = applyParamPatches(inputs, [p]).changes[0];
      return `${p.label}：${preview.from} → ${preview.to}${p.unit ? ` ${p.unit}` : ""}（${preview.scopeLabel}）`;
    })
    .join("；");
}

export function findRouteByHint(inputs: SchemeCalculationInput, hint: string): { id: string; name: string } | null {
  const q = hint.replace(/\s+/g, "");
  for (const route of inputs.routes || []) {
    const name = route.routeName || "";
    const code = route.routeCode || "";
    if (q.includes(name) || (code && q.includes(code)) || q.includes(route.id)) {
      return { id: route.id, name: name || code || route.id };
    }
  }
  return null;
}

export function findSegmentByHint(
  inputs: SchemeCalculationInput,
  hint: string,
): { routeId: string; segmentId: string; label: string } | null {
  const q = hint.replace(/\s+/g, "");
  for (const route of inputs.routes || []) {
    for (const seg of route.segments || []) {
      const label = `${route.routeName}/${seg.segmentName}`;
      if (q.includes(seg.segmentName) || q.includes(seg.id) || q.includes(label.replace(/\s+/g, ""))) {
        return { routeId: route.id, segmentId: seg.id, label };
      }
    }
  }
  return null;
}

export { FIELD_META };
