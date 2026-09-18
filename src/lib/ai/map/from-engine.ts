import { CALCULATION_RESULT_SCHEMA_VERSION } from "../schema/versions";
import type { CalculationResultV1 } from "../schema/types";

export function toCalculationResultV1(input: {
  ruleVersion: string;
  snapshotId?: string | null;
  resultId?: string | null;
  monthlyRevenue: string;
  monthlyTotalCost: string;
  monthlyProfit: string;
  profitMargin: string | null;
  profitMarginReason?: string | null;
  irr: string | null;
  irrReason?: string | null;
  monthlyVolume: string;
  monthlyMileage: string;
  firstPositiveMonth: number | null;
  cumulativeCashFlow: string;
  costBreakdown?: unknown[];
  routes?: unknown[];
  warnings?: unknown[];
}): CalculationResultV1 {
  return {
    schema_version: CALCULATION_RESULT_SCHEMA_VERSION,
    source: "calculation_engine",
    rule_version: input.ruleVersion,
    snapshot_id: input.snapshotId ?? null,
    result_id: input.resultId ?? null,
    kpis: {
      monthly_revenue: input.monthlyRevenue,
      monthly_total_cost: input.monthlyTotalCost,
      monthly_profit: input.monthlyProfit,
      profit_margin: input.profitMargin,
      profit_margin_reason: input.profitMarginReason ?? null,
      irr: input.irr,
      irr_reason: input.irrReason ?? null,
      monthly_volume: input.monthlyVolume,
      monthly_mileage: input.monthlyMileage,
      first_positive_month: input.firstPositiveMonth,
      cumulative_cash_flow: input.cumulativeCashFlow,
    },
    cost_breakdown: (input.costBreakdown ?? []) as CalculationResultV1["cost_breakdown"],
    routes: input.routes ?? [],
    warnings: input.warnings ?? [],
  };
}
