import { calculateScheme } from "@/lib/engine/calculate";
import type { SchemeCalculationInput, SchemeCalculationOutput } from "@/lib/engine/types";
import { toCalculationResultV1 } from "../map/from-engine";
import type { ScenarioAction } from "./intent";

function cloneInput(input: SchemeCalculationInput): SchemeCalculationInput {
  return JSON.parse(JSON.stringify(input)) as SchemeCalculationInput;
}

function applyNumber(current: string, operation: ScenarioAction["operation"], value: number) {
  const n = Number(current);
  const base = Number.isFinite(n) ? n : 0;
  if (operation === "multiply") return String(base * value);
  if (operation === "add") return String(base + value);
  return String(value);
}

export function applyScenarioPatch(input: SchemeCalculationInput, actions: ScenarioAction[]): SchemeCalculationInput {
  const next = cloneInput(input);
  for (const action of actions) {
    if (action.field_code === "vehicle.fleet_size") {
      const fleet = Number(applyNumber(String(next.fleetSize), action.operation, action.value));
      next.fleetSize = Math.max(1, Math.round(fleet));
      next.vehicle.fleetSize = next.fleetSize;
      continue;
    }
    if (action.field_code === "vehicle.monthly_rent") {
      next.vehicle.monthlyRentPerVehicle = applyNumber(next.vehicle.monthlyRentPerVehicle, action.operation, action.value);
      continue;
    }
    for (const route of next.routes) {
      for (const seg of route.segments) {
        if (action.field_code === "revenue.freight_price") seg.freightPrice = applyNumber(seg.freightPrice, action.operation, action.value);
        if (action.field_code === "energy.electricity_price") seg.electricityPrice = applyNumber(seg.electricityPrice, action.operation, action.value);
        if (action.field_code === "ops.trips_per_vehicle_month") {
          seg.tripsPerVehicleMonth = applyNumber(seg.tripsPerVehicleMonth, action.operation, action.value);
        }
        if (action.field_code === "energy.loaded_consumption") {
          seg.loadedEnergyConsumption = applyNumber(seg.loadedEnergyConsumption, action.operation, action.value);
        }
      }
    }
  }
  return next;
}

export function runScenario(baselineInput: SchemeCalculationInput, actions: ScenarioAction[]) {
  const patched = applyScenarioPatch(baselineInput, actions);
  const baselineOutput = calculateScheme(baselineInput);
  const scenarioOutput = calculateScheme(patched);
  return {
    patchedInput: patched,
    beforeOutput: baselineOutput,
    afterOutput: scenarioOutput,
    baseline: summarize(baselineOutput, baselineInput.ruleSet.ruleVersionId),
    scenario: summarize(scenarioOutput, patched.ruleSet.ruleVersionId),
    difference: diff(baselineOutput, scenarioOutput),
    source: "calculation_engine" as const,
  };
}

function money(value: { toFixed: (n: number) => string } | null | undefined) {
  return value ? value.toFixed(2) : null;
}

function summarize(output: SchemeCalculationOutput, ruleVersion: string) {
  const energy = output.costBreakdown.find((i) => i.code === "energy_cost")?.amount;
  const vehicle = output.costBreakdown.find((i) => i.code === "vehicle_cost")?.amount;
  return toCalculationResultV1({
    ruleVersion,
    monthlyRevenue: output.monthlyRevenue.toFixed(2),
    monthlyTotalCost: output.monthlyTotalCost.toFixed(2),
    monthlyProfit: output.monthlyProfit.toFixed(2),
    profitMargin: output.profitMargin ? output.profitMargin.toFixed(4) : null,
    profitMarginReason: output.profitMarginReason,
    irr: output.irr ? output.irr.toFixed(4) : null,
    irrReason: output.irrReason,
    monthlyVolume: output.monthlyVolume.toFixed(2),
    monthlyMileage: output.monthlyMileage.toFixed(2),
    firstPositiveMonth: output.firstPositiveMonth,
    cumulativeCashFlow: output.cumulativeCashFlow.toFixed(2),
    costBreakdown: output.costBreakdown,
    routes: output.routes,
  });
}

function diff(base: SchemeCalculationOutput, next: SchemeCalculationOutput) {
  const delta = (a: { minus: (x: never) => { toFixed: (n: number) => string } }, b: never) => a.minus(b).toFixed(2);
  return {
    monthly_revenue: next.monthlyRevenue.minus(base.monthlyRevenue).toFixed(2),
    monthly_total_cost: next.monthlyTotalCost.minus(base.monthlyTotalCost).toFixed(2),
    monthly_profit: next.monthlyProfit.minus(base.monthlyProfit).toFixed(2),
    profit_margin: next.profitMargin && base.profitMargin ? next.profitMargin.minus(base.profitMargin).toFixed(4) : null,
    energy_cost: (next.costBreakdown.find((i) => i.code === "energy_cost")?.amount ?? next.monthlyVariableCost)
      .minus(base.costBreakdown.find((i) => i.code === "energy_cost")?.amount ?? base.monthlyVariableCost)
      .toFixed(2),
    vehicle_cost: (next.costBreakdown.find((i) => i.code === "vehicle_cost")?.amount ?? next.monthlyFixedCost)
      .minus(base.costBreakdown.find((i) => i.code === "vehicle_cost")?.amount ?? base.monthlyFixedCost)
      .toFixed(2),
    first_positive_month: next.firstPositiveMonth,
    irr: next.irr && base.irr ? next.irr.minus(base.irr).toFixed(4) : null,
    source: "calculation_engine" as const,
  };
}
