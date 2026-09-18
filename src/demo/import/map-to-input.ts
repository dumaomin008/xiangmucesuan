/**
 * 将已确认的 ExtractedParameter 映射为 SchemeCalculationInput。
 * 不计算 KPI；以引擎输入结构为唯一准入。
 */
import type { SchemeCalculationInput } from "@/calculation";
import { excelExampleInput } from "@/lib/engine/__tests__/fixture";
import { cloneJson } from "../utils";
import { IMPORT_FIELD_WHITELIST, type ExtractedParameter, type ImportFieldKey } from "./types";

export type MapToInputResult = {
  ok: boolean;
  inputs?: SchemeCalculationInput;
  projectPatch: {
    projectName?: string;
    customer?: string;
    region?: string;
    owner?: string;
    projectType?: string;
  };
  errors: string[];
  warnings: string[];
  defaultsUsed: { field: string; label: string; defaultValue: string }[];
};

function num(v: string | number | null | undefined): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function str(v: string | number | null | undefined): string | null {
  if (v === null || v === undefined || v === "") return null;
  return String(v);
}

export function mapToSchemeCalculationInput(parameters: ExtractedParameter[]): MapToInputResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const defaultsUsed: MapToInputResult["defaultsUsed"] = [];
  const byField = new Map<string, ExtractedParameter>();

  for (const p of parameters) {
    if (!IMPORT_FIELD_WHITELIST.includes(p.field as ImportFieldKey)) {
      warnings.push(`非法字段已丢弃：${p.field}`);
      continue;
    }
    byField.set(p.field, p);
  }

  // 冲突 / 未确认推断 / 必填缺失 → 禁止映射
  for (const p of byField.values()) {
    if (p.status === "CONFLICT") errors.push(`${p.label} 仍有冲突未处理`);
    if (p.status === "INFERRED") errors.push(`${p.label} 为 AI 推断，需人工确认`);
    if (p.unitUnresolved) errors.push(`${p.label} 单位无法换算`);
    if (p.offerSystemDefault && p.status === "MISSING" && !p.confirmedByUser) {
      errors.push(`${p.label} 需确认是否采用系统默认值`);
    }
    if (p.required && (p.status === "MISSING" || p.normalizedValue == null || p.normalizedValue === "")) {
      errors.push(`${p.label} 为必填但尚未填写`);
    }
  }

  if (errors.length) {
    return { ok: false, projectPatch: {}, errors, warnings, defaultsUsed };
  }

  const base = cloneJson(excelExampleInput());
  const seg = base.routes[0].segments[0];

  const fleet = num(byField.get("fleetSize")?.normalizedValue);
  if (fleet != null) {
    base.fleetSize = Math.max(1, Math.round(fleet));
    base.vehicle.fleetSize = base.fleetSize;
  }

  const rent = str(byField.get("monthlyRentPerVehicle")?.normalizedValue);
  if (rent != null) base.vehicle.monthlyRentPerVehicle = rent;

  const distance = str(byField.get("distanceKm")?.normalizedValue);
  if (distance != null) seg.distanceKm = distance;

  const load = str(byField.get("loadTon")?.normalizedValue);
  if (load != null) seg.loadTon = load;

  const trips = str(byField.get("tripsPerVehicleMonth")?.normalizedValue);
  if (trips != null) seg.tripsPerVehicleMonth = trips;

  const freight = str(byField.get("freightPrice")?.normalizedValue);
  if (freight != null) seg.freightPrice = freight;

  const freightUnit = str(byField.get("freightPriceUnit")?.normalizedValue);
  if (freightUnit != null) seg.freightPriceUnit = freightUnit;

  const elec = str(byField.get("electricityPrice")?.normalizedValue);
  if (elec != null) seg.electricityPrice = elec;

  const energy = str(byField.get("loadedEnergyConsumption")?.normalizedValue);
  if (energy != null) seg.loadedEnergyConsumption = energy;

  const emptyEnergy = str(byField.get("emptyEnergyConsumption")?.normalizedValue);
  if (emptyEnergy != null) seg.emptyEnergyConsumption = emptyEnergy;
  else defaultsUsed.push({ field: "emptyEnergyConsumption", label: "空载能耗", defaultValue: String(seg.emptyEnergyConsumption) });

  const driver = str(byField.get("driverCostPerTrip")?.normalizedValue);
  if (driver != null) seg.driverCostPerTrip = driver;

  const toll = str(byField.get("tollPerTrip")?.normalizedValue);
  if (toll != null) seg.tollPerTrip = toll;

  const opMonths = num(byField.get("operatingMonthsYear")?.normalizedValue);
  if (opMonths != null) seg.operatingMonthsYear = String(opMonths);

  const routeName = str(byField.get("routeName")?.normalizedValue);
  if (routeName != null) base.routes[0].routeName = routeName;

  const origin = str(byField.get("originName")?.normalizedValue);
  if (origin != null) seg.originName = origin;

  const dest = str(byField.get("destinationName")?.normalizedValue);
  if (dest != null) seg.destinationName = dest;

  const projectName = str(byField.get("projectName")?.normalizedValue) || undefined;
  base.schemeName = projectName ? `${projectName}-AI导入方案` : "AI导入测算方案";

  return {
    ok: true,
    inputs: base,
    projectPatch: {
      projectName,
      customer: str(byField.get("customer")?.normalizedValue) || undefined,
      region: str(byField.get("region")?.normalizedValue) || undefined,
      owner: str(byField.get("owner")?.normalizedValue) || undefined,
      projectType: str(byField.get("projectType")?.normalizedValue) || undefined,
    },
    errors: [],
    warnings,
    defaultsUsed,
  };
}

export function summarizeParameterStates(parameters: ExtractedParameter[]) {
  const counts = {
    extracted: 0,
    missing: 0,
    conflict: 0,
    inferred: 0,
    manual: 0,
    confirmed: 0,
    total: parameters.length,
  };
  for (const p of parameters) {
    if (p.status === "EXTRACTED") counts.extracted += 1;
    else if (p.status === "MISSING") counts.missing += 1;
    else if (p.status === "CONFLICT") counts.conflict += 1;
    else if (p.status === "INFERRED") counts.inferred += 1;
    else if (p.status === "MANUAL") counts.manual += 1;
    else if (p.status === "CONFIRMED") counts.confirmed += 1;
  }
  return counts;
}

export function canStartCalculation(parameters: ExtractedParameter[]): { ok: boolean; reasons: string[] } {
  const reasons: string[] = [];
  for (const p of parameters) {
    if (p.status === "CONFLICT") reasons.push(`${p.label}：冲突未解决`);
    if (p.status === "INFERRED") reasons.push(`${p.label}：推断未确认`);
    if (p.unitUnresolved) reasons.push(`${p.label}：单位无法换算`);
    if (p.offerSystemDefault && p.status === "MISSING" && !p.confirmedByUser) {
      reasons.push(`${p.label}：请确认是否采用系统默认值`);
    }
    if (p.required && (p.normalizedValue == null || p.normalizedValue === "" || p.status === "MISSING")) {
      reasons.push(`${p.label}：必填缺失`);
    }
  }
  return { ok: reasons.length === 0, reasons };
}
