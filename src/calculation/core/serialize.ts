import { Decimal } from "./decimal";
import type { SchemeCalculationOutput } from "./types";

/**
 * 将计算结果转为可 JSON 序列化对象（LocalStorage / postMessage）。
 * 显示层格式化与计算层精度分离：此处仅做 Decimal → string，不二次四舍五入。
 */
export function serializeCalculationResult(output: SchemeCalculationOutput): Record<string, unknown> {
  return JSON.parse(JSON.stringify(output, (_key, value) => {
    if (value instanceof Decimal || (value && typeof value === "object" && value.constructor?.name === "Decimal")) {
      return value.toString();
    }
    return value;
  })) as Record<string, unknown>;
}

/** 从序列化快照恢复关键标量（完整 Decimal 树在浏览器侧可按需再算） */
export function snapshotKeyMetrics(output: SchemeCalculationOutput) {
  return {
    monthlyRevenue: output.monthlyRevenue.toString(),
    monthlyFixedCost: output.monthlyFixedCost.toString(),
    monthlyVariableCost: output.monthlyVariableCost.toString(),
    monthlyFinanceCost: output.monthlyFinanceCost.toString(),
    monthlyTaxCost: output.monthlyTaxCost.toString(),
    monthlyTotalCost: output.monthlyTotalCost.toString(),
    monthlyProfit: output.monthlyProfit.toString(),
    profitMargin: output.profitMargin ? output.profitMargin.toString() : null,
    profitMarginReason: output.profitMarginReason,
    irr: output.irr ? output.irr.toString() : null,
    irrReason: output.irrReason,
    firstPositiveMonth: output.firstPositiveMonth,
    cumulativeCashFlow: output.cumulativeCashFlow.toString(),
    monthlyVolume: output.monthlyVolume.toString(),
    monthlyMileage: output.monthlyMileage.toString(),
    ruleVersionId: output.ruleVersionId,
    operatingMonthsYear: output.operatingMonthsYear,
  };
}
