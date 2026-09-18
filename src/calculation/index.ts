export { APP_MODE, CALC_MODE, CALCULATION_ENGINE_VERSION, isBrowserCalcMode } from "./config";
export type { AppMode, CalcMode } from "./config";

export {
  calculateProject,
  calculateScheme,
  previewSegmentHelpers,
  calculateExcelV5,
  calculateExcelMonthlyPnl,
  runSensitivity,
  validateSchemeInput,
  serializeCalculationResult,
  snapshotKeyMetrics,
  Decimal,
  EngineError,
  SENSITIVITY_VARIABLES,
} from "./core";

export type {
  SchemeCalculationInput,
  SchemeCalculationOutput,
  ValidationIssue,
  SensitivityVariableCode,
} from "./core";

export { createBrowserAdapter, browserCalculate, browserValidate, browserSensitivity } from "./adapters/browser";
export { createApiAdapter } from "./adapters/api";
