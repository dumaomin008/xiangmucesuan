/**
 * 浏览器安全计算核心 —— 公式唯一来源仍为 src/lib/engine。
 * 本目录禁止引入 Prisma / fs / Route Handler / 服务端 Secret。
 */
export type {
  SchemeCalculationInput,
  SchemeCalculationOutput,
  ValidationIssue,
  SegmentInput,
  RouteInput,
  VehiclePlanInput,
  FinanceTaxPlanInput,
  CostBreakdownItem,
  RouteMetrics,
  SegmentMetrics,
  MonthlyCashFlow,
  AnnualCashFlow,
  SensitivityVariableCode,
  FreightPricingSummary,
} from "@/lib/engine/types";

export { SENSITIVITY_VARIABLES } from "@/lib/engine/types";
