import { Decimal, roundMoney, roundQty } from "./decimal";
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
  const traces: ResultTraceItem[] = [
    {
      resultCode: "monthly_revenue",
      resultName: "月营收",
      resultValue: money(params.monthlyRevenue),
      unit: "元",
      ruleCode: "R001",
      ruleVersion,
      calculationExpression: "Σ (freight_price × load_ton × trips_per_vehicle_month × fleet_size) 按运价单位规则",
      explanation: "各启用路段按规则版本中的运价单位公式独立计收后汇总。",
      sourceParameterSnapshot: {
        fleet_size: String(params.input.fleetSize),
        route_count: String(params.input.routes.length),
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
      calculationExpression:
        "energy_cost = fleet × electricity_price × SUMPRODUCT(IF(load, loaded_kwh_km, empty_kwh_km), distance, trips)；能耗单位 kWh/km，载重为 0 走空载",
      explanation: "Excel V5：单路段单状态能耗（满载或空载），不是往返双计。",
      sourceParameterSnapshot: seg
        ? {
            electricity_price: String(seg.freightPrice ? params.input.routes[0]?.segments[0]?.electricityPrice : ""),
            loaded_energy_consumption: params.input.routes[0]?.segments[0]?.loadedEnergyConsumption ?? "",
            empty_energy_consumption: params.input.routes[0]?.segments[0]?.emptyEnergyConsumption ?? "",
            loaded_mileage: roundQty(seg.loadedMileage).toString(),
            empty_mileage: roundQty(seg.emptyMileage).toString(),
            energy_mileage_rule: JSON.stringify(params.input.ruleSet.energyMileage),
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
      explanation: params.profitMargin ? "利润 / 营收。" : "营收为 0，利润率无法计算，不展示除零错误。",
      sourceParameterSnapshot: {},
      sortNo: 6,
    },
  ];
  return traces;
}
