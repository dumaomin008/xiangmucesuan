import { Decimal, roundMoney } from "./decimal";
import { PROFIT_MARGIN_REASON_TEXT, PROFIT_MARGIN_REASONS } from "./reasons";
import { resolveRevenueFormula, revenueExpression } from "./revenue";
import { driverCostSourceLabel } from "./variable-cost";
import type { ResultTraceItem, SegmentMetrics, SchemeCalculationInput } from "./types";

export function money(v: Decimal): string {
  return roundMoney(v).toFixed(2);
}

export function buildTraces(params: {
  input: SchemeCalculationInput;
  monthlyRevenue: Decimal;
  monthlyTotalCost: Decimal;
  monthlyProfit: Decimal;
  profitMargin: Decimal | null;
  energyCost: Decimal;
  tireCost: Decimal;
  sampleSegment?: SegmentMetrics;
}): ResultTraceItem[] {
  const ruleVersion = params.input.ruleSet.ruleVersionId;
  const seg = params.sampleSegment;
  const sampleInputSeg = params.input.routes
    .flatMap((r) => r.segments)
    .find((s) => s.id === seg?.segmentId);
  const formula = sampleInputSeg
    ? resolveRevenueFormula(sampleInputSeg.freightPriceUnit, params.input.ruleSet.revenue.formulaByUnit)
    : "PER_TON";
  const consumption = sampleInputSeg
    ? (seg?.loadState === "EMPTY" ? sampleInputSeg.emptyEnergyConsumption : sampleInputSeg.loadedEnergyConsumption)
    : "";

  const traces: ResultTraceItem[] = [
    {
      resultCode: "monthly_revenue",
      resultName: "月营收",
      resultValue: money(params.monthlyRevenue),
      unit: "元",
      ruleCode: "R001",
      ruleVersion,
      calculationExpression: sampleInputSeg && seg
        ? `路段示例 ${revenueExpression(formula, sampleInputSeg, params.input.fleetSize, seg.monthlyRevenue)}；全方案按各路段运价单位汇总`
        : "Σ 路段收入（按 PER_TON / PER_TRIP / PER_TON_KM）",
      explanation: "各启用路段按 Rule Engine 中的运价单位公式独立计收后汇总。空载时元/吨、元/吨公里收入为 0，元/趟仍可产生收入。",
      sourceParameterSnapshot: {
        fleet_size: String(params.input.fleetSize),
        route_count: String(params.input.routes.length),
        sample_unit: sampleInputSeg?.freightPriceUnit ?? "",
      },
      sortNo: 1,
    },
    {
      resultCode: "energy_cost",
      resultName: "能源成本",
      resultValue: money(params.energyCost),
      unit: "元",
      ruleCode: "R004",
      ruleVersion,
      calculationExpression: sampleInputSeg
        ? `${params.input.fleetSize} × ${sampleInputSeg.electricityPrice} × ${consumption} × ${sampleInputSeg.distanceKm} × ${sampleInputSeg.tripsPerVehicleMonth}${seg ? ` = ¥${money(seg.energyCost)}（示例路段）` : ""}`
        : "energy_cost = fleet × electricity_price × consumption × distance × trips；载重为 0 走空载能耗",
      explanation: "Excel V5：单路段单状态能耗（满载或空载），载重为 0 使用 emptyEnergyConsumption。",
      sourceParameterSnapshot: sampleInputSeg
        ? {
            fleet_size: String(params.input.fleetSize),
            electricity_price: sampleInputSeg.electricityPrice,
            loaded_energy_consumption: sampleInputSeg.loadedEnergyConsumption,
            empty_energy_consumption: sampleInputSeg.emptyEnergyConsumption,
            distance_km: sampleInputSeg.distanceKm,
            trips_per_vehicle_month: sampleInputSeg.tripsPerVehicleMonth,
            load_state: seg?.loadState ?? "",
          }
        : {},
      sortNo: 2,
    },
    {
      resultCode: "tire_cost",
      resultName: "轮胎成本",
      resultValue: money(params.tireCost),
      unit: "元",
      ruleCode: "R005",
      ruleVersion,
      calculationExpression: "tire_cost = SUMPRODUCT(distance, trips) / tire_life × tire_count × fleet × tire_unit_price",
      explanation: "按运营里程摊销轮胎成本。",
      sourceParameterSnapshot: {
        tire_count: String(params.input.vehicle.tireCount),
        tire_unit_price: params.input.vehicle.tireUnitPrice,
        tire_life_km: params.input.vehicle.tireLifeKm,
      },
      sortNo: 3,
    },
    {
      resultCode: "driver_cost",
      resultName: "司机成本",
      resultValue: seg ? money(seg.driverCost) : null,
      unit: "元",
      ruleCode: "R006",
      ruleVersion,
      calculationExpression: "driver_cost = fleet × trips × driver_cost_per_trip（按趟）或方案月固定/单车月",
      explanation: seg ? driverCostSourceLabel(seg.driverCostSource) : "司机成本按口径汇总。",
      sourceParameterSnapshot: {
        driver_cost_type: params.input.vehicle.driverCostType,
        scheme_driver_cost: params.input.vehicle.driverCost,
        segment_driver_cost: sampleInputSeg?.driverCostPerTrip ?? "",
        driver_cost_source: seg?.driverCostSource ?? "",
      },
      sortNo: 7,
    },
    {
      resultCode: "monthly_total_cost",
      resultName: "月总成本",
      resultValue: money(params.monthlyTotalCost),
      unit: "元",
      ruleCode: "R010",
      ruleVersion,
      calculationExpression: "total_cost = fixed_cost + variable_cost + finance_cost + tax_cost",
      explanation: "五类成本分项保存后汇总。",
      sourceParameterSnapshot: {},
      sortNo: 4,
    },
    {
      resultCode: "monthly_profit",
      resultName: "月利润",
      resultValue: money(params.monthlyProfit),
      unit: "元",
      ruleCode: "R011",
      ruleVersion,
      calculationExpression: "profit = revenue - total_cost",
      explanation: "经营利润 = 月营收 − 月总成本。",
      sourceParameterSnapshot: {},
      sortNo: 5,
    },
    {
      resultCode: "profit_margin",
      resultName: "利润率",
      resultValue: params.profitMargin ? params.profitMargin.toFixed(4) : null,
      unit: "%",
      ruleCode: "R012",
      ruleVersion,
      calculationExpression: "profit_margin = profit / revenue；revenue = 0 时返回 null",
      explanation: params.profitMargin
        ? "利润 / 营收。"
        : PROFIT_MARGIN_REASON_TEXT[PROFIT_MARGIN_REASONS.REVENUE_ZERO],
      sourceParameterSnapshot: {},
      sortNo: 6,
    },
  ];
  return traces;
}
