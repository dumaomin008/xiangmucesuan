import { Decimal } from "./decimal";
import { calculateScheme } from "./calculate";
import type { SchemeCalculationInput, SensitivityVariableCode } from "./types";

function cloneInput(input: SchemeCalculationInput): SchemeCalculationInput {
  return JSON.parse(JSON.stringify(input)) as SchemeCalculationInput;
}

function shifted(base: Decimal, delta: Decimal, mode: "PERCENT" | "ABSOLUTE"): Decimal {
  return mode === "PERCENT" ? base.mul(new Decimal(1).plus(delta.div(100))) : base.plus(delta);
}

function applyChange(
  input: SchemeCalculationInput,
  variable: SensitivityVariableCode,
  delta: Decimal,
  mode: "PERCENT" | "ABSOLUTE",
) {
  if (variable === "monthly_rent_per_vehicle") {
    input.vehicle.monthlyRentPerVehicle = shifted(
      new Decimal(input.vehicle.monthlyRentPerVehicle),
      delta,
      mode,
    ).toString();
    return;
  }
  for (const route of input.routes) {
    for (const seg of route.segments) {
      if (variable === "electricity_price") {
        seg.electricityPrice = shifted(new Decimal(seg.electricityPrice), delta, mode).toString();
      }
      if (variable === "freight_price") {
        seg.freightPrice = shifted(new Decimal(seg.freightPrice), delta, mode).toString();
      }
      if (variable === "trips_per_vehicle_month") {
        seg.tripsPerVehicleMonth = shifted(new Decimal(seg.tripsPerVehicleMonth), delta, mode).toString();
      }
      if (variable === "loaded_energy_consumption") {
        seg.loadedEnergyConsumption = shifted(new Decimal(seg.loadedEnergyConsumption), delta, mode).toString();
      }
      if (variable === "loading_unloading_fee") {
        seg.loadingUnloadingFee = shifted(new Decimal(seg.loadingUnloadingFee || "0"), delta, mode).toString();
      }
      if (variable === "information_fee") {
        seg.informationFee = shifted(new Decimal(seg.informationFee || "0"), delta, mode).toString();
      }
    }
  }
}

export function runSensitivity(params: {
  input: SchemeCalculationInput;
  variable: SensitivityVariableCode;
  changeMode: "PERCENT" | "ABSOLUTE";
  minChange: string;
  maxChange: string;
  step: string;
}) {
  const baselineOutput = calculateScheme(params.input);
  const min = new Decimal(params.minChange);
  const max = new Decimal(params.maxChange);
  const step = new Decimal(params.step);
  if (step.lte(0)) {
    throw new Error("步长必须大于 0");
  }

  const points: Decimal[] = [];
  for (let v = min; v.lte(max); v = v.plus(step)) {
    points.push(v);
    if (points.length > 80) break;
  }
  if (!points.some((p) => p.isZero())) {
    points.push(new Decimal(0));
    points.sort((a, b) => a.cmp(b));
  }

  return points.map((delta) => {
    const nextInput = cloneInput(params.input);
    applyChange(nextInput, params.variable, delta, params.changeMode);
    const output = calculateScheme(nextInput);
    const profitDelta = output.monthlyProfit.minus(baselineOutput.monthlyProfit);
    const profitDeltaRate = baselineOutput.monthlyProfit.isZero()
      ? null
      : profitDelta.div(baselineOutput.monthlyProfit);
    return {
      parameterChange: delta.toString(),
      monthlyRevenue: output.monthlyRevenue.toFixed(2),
      monthlyCost: output.monthlyTotalCost.toFixed(2),
      monthlyProfit: output.monthlyProfit.toFixed(2),
      profitMargin: output.profitMargin ? output.profitMargin.toFixed(4) : null,
      profitDelta: profitDelta.toFixed(2),
      profitDeltaRate: profitDeltaRate ? profitDeltaRate.toFixed(4) : null,
      isBaseline: delta.isZero(),
    };
  });
}
