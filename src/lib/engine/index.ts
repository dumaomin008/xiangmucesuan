export { calculateScheme, previewSegmentHelpers } from "./calculate";
export { calculateExcelV5, calculateExcelMonthlyPnl } from "./excel-v5";
export { runSensitivity } from "./sensitivity";
export { validateSchemeInput } from "./validate";
export { DEFAULT_RULE_SET } from "./rule-engine";
export { EngineError } from "./decimal";
export { SENSITIVITY_VARIABLES } from "./types";
export type { SchemeCalculationInput, SchemeCalculationOutput, ValidationIssue } from "./types";

/** Phase 1：浏览器统一入口（实现位于 @/calculation，公式仍委托本模块） */
export { calculateProject } from "@/calculation/core/calculate";
