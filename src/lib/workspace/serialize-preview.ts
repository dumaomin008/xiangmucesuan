import type { SchemeCalculationOutput } from "@/lib/engine/types";

export function toPreviewDto(output: SchemeCalculationOutput) {
  const months = output.operatingMonthsYear;
  return {
    monthlyRevenue: output.monthlyRevenue.toFixed(2),
    monthlyTotalCost: output.monthlyTotalCost.toFixed(2),
    monthlyProfit: output.monthlyProfit.toFixed(2),
    profitMargin: output.profitMargin ? output.profitMargin.toString() : null,
    profitMarginReason: output.profitMarginReason,
    monthlyVolume: output.monthlyVolume.toFixed(2),
    monthlyMileage: output.monthlyMileage.toFixed(2),
    vehicleMonthlyRevenue: output.vehicleMonthlyRevenue.toFixed(2),
    vehicleMonthlyProfit: output.vehicleMonthlyProfit ? output.vehicleMonthlyProfit.toFixed(2) : null,
    firstPositiveMonth: output.firstPositiveMonth,
    irr: output.irr ? output.irr.toString() : null,
    irrReason: output.irrReason,
    operatingMonthsYear: months,
    annualRevenue: output.monthlyRevenue.mul(months).toFixed(2),
    annualTotalCost: output.monthlyTotalCost.mul(months).toFixed(2),
    annualProfit: output.monthlyProfit.mul(months).toFixed(2),
    annualVolume: output.monthlyVolume.mul(months).toFixed(2),
    costBreakdown: output.costBreakdown.map((item) => ({
      code: item.code,
      name: item.name,
      amount: item.amount.toFixed(2),
      share: item.share ? item.share.toString() : null,
    })),
  };
}
