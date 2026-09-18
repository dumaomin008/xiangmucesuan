import { calculateScheme, previewSegmentHelpers } from "@/lib/engine/calculate";
import { calculateExcelV5, calculateExcelMonthlyPnl } from "@/lib/engine/excel-v5";
import { CALCULATION_ENGINE_VERSION } from "../config";
import { cloneCalculationInput } from "./normalize";
import type { SchemeCalculationInput, SchemeCalculationOutput } from "./types";

/**
 * 浏览器 / 服务端统一计算入口。
 * 公式口径与 calculateScheme 完全一致，禁止页面自行复制公式。
 */
export function calculateProject(input: SchemeCalculationInput): SchemeCalculationOutput {
  return calculateScheme(cloneCalculationInput(input));
}

/** 兼容旧名；新代码请优先使用 calculateProject */
export const calculateSchemeCompat = calculateScheme;

export {
  calculateScheme,
  previewSegmentHelpers,
  calculateExcelV5,
  calculateExcelMonthlyPnl,
  CALCULATION_ENGINE_VERSION,
};
