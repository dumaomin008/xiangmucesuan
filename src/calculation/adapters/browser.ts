import { CALC_MODE, CALCULATION_ENGINE_VERSION, type CalcMode } from "../config";
import {
  calculateProject,
  runSensitivity,
  serializeCalculationResult,
  snapshotKeyMetrics,
  validateSchemeInput,
  type SchemeCalculationInput,
  type SchemeCalculationOutput,
  type SensitivityVariableCode,
} from "../core";

/**
 * 浏览器端计算适配器：直接调用纯函数引擎，无网络、无数据库。
 */
export function browserCalculate(input: SchemeCalculationInput): SchemeCalculationOutput {
  return calculateProject(input);
}

export function browserValidate(input: SchemeCalculationInput) {
  return validateSchemeInput(input);
}

export function browserSensitivity(params: {
  input: SchemeCalculationInput;
  variable: SensitivityVariableCode;
  changeMode: "PERCENT" | "ABSOLUTE";
  minChange: string;
  maxChange: string;
  step: string;
}) {
  return runSensitivity(params);
}

export function browserCalculateSerializable(input: SchemeCalculationInput) {
  const output = calculateProject(input);
  return {
    engineVersion: CALCULATION_ENGINE_VERSION,
    metrics: snapshotKeyMetrics(output),
    result: serializeCalculationResult(output),
  };
}

export function createBrowserAdapter(mode: CalcMode = CALC_MODE) {
  if (mode !== "browser") {
    throw new Error(`browser adapter 仅支持 CALC_MODE=browser，当前为 ${mode}`);
  }
  return {
    mode: "browser" as const,
    engineVersion: CALCULATION_ENGINE_VERSION,
    calculate: browserCalculate,
    validate: browserValidate,
    sensitivity: browserSensitivity,
    calculateSerializable: browserCalculateSerializable,
  };
}
