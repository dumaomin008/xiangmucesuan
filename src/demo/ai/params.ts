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

export type ParamPatch = {
  field: AssistantParamKey;
  label: string;
  operation: "set" | "add" | "multiply";
  value: number;
  unit: string;
};

export type ParamSnapshot = {
  field: AssistantParamKey;
  label: string;
  value: number | null;
  unit: string;
  display: string;
};

const FIELD_META: Record<AssistantParamKey, { label: string; unit: string }> = {
  electricityPrice: { label: "电价", unit: "元/kWh" },
  fleetSize: { label: "车辆数", unit: "台" },
  freightPrice: { label: "运价", unit: "元" },
  tripsPerVehicleMonth: { label: "单车月趟次", unit: "趟" },
  distanceKm: { label: "里程", unit: "km" },
  loadTon: { label: "载重", unit: "吨" },
  loadedEnergyConsumption: { label: "重载能耗", unit: "kWh/km" },
  driverCostPerTrip: { label: "司机成本", unit: "元/趟" },
  monthlyRentPerVehicle: { label: "单车月租", unit: "元" },
};

function firstSegment(inputs: SchemeCalculationInput) {
  return inputs.routes?.[0]?.segments?.[0];
}

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function getParamValue(inputs: SchemeCalculationInput, field: AssistantParamKey): number | null {
  const seg = firstSegment(inputs);
  switch (field) {
    case "fleetSize":
      return num(inputs.fleetSize ?? inputs.vehicle?.fleetSize);
    case "monthlyRentPerVehicle":
      return num(inputs.vehicle?.monthlyRentPerVehicle);
    case "electricityPrice":
      return num(seg?.electricityPrice);
    case "freightPrice":
      return num(seg?.freightPrice);
    case "tripsPerVehicleMonth":
      return num(seg?.tripsPerVehicleMonth);
    case "distanceKm":
      return num(seg?.distanceKm);
    case "loadTon":
      return num(seg?.loadTon);
    case "loadedEnergyConsumption":
      return num(seg?.loadedEnergyConsumption);
    case "driverCostPerTrip":
      return num(seg?.driverCostPerTrip);
    default:
      return null;
  }
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
  const current = getParamValue(inputs, patch.field);
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
  for (const route of inputs.routes || []) {
    for (const seg of route.segments || []) {
      (seg as unknown as Record<string, string>)[key] = String(next);
    }
  }
}

export function applyParamPatches(
  inputs: SchemeCalculationInput,
  patches: ParamPatch[],
): { inputs: SchemeCalculationInput; changes: { field: AssistantParamKey; label: string; from: string; to: string; unit: string }[] } {
  const next = cloneJson(inputs);
  const changes = patches.map((patch) => {
    const meta = FIELD_META[patch.field];
    const fromVal = getParamValue(next, patch.field);
    applyOne(next, patch);
    const toVal = getParamValue(next, patch.field);
    return {
      field: patch.field,
      label: meta.label,
      from: fromVal == null ? "—" : String(fromVal),
      to: toVal == null ? "—" : String(toVal),
      unit: meta.unit,
    };
  });
  return { inputs: next, changes };
}

export function describePatches(patches: ParamPatch[], inputs: SchemeCalculationInput): string {
  return patches
    .map((p) => {
      const from = getParamValue(inputs, p.field);
      const preview = applyParamPatches(inputs, [p]).changes[0];
      return `${p.label}：${preview.from} → ${preview.to}${p.unit ? ` ${p.unit}` : ""}${from == null ? "" : ""}`;
    })
    .join("；");
}

export { FIELD_META };
