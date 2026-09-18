import type { CalculationResultV1 } from "../schema/types";

export function assertEngineSourced(result: CalculationResultV1) {
  if (result.source !== "calculation_engine") {
    throw new Error("KPI 只能来自测算引擎，禁止使用大模型数字覆盖 CalculationResultV1");
  }
}

export function mergeExplanation(result: CalculationResultV1, explanation: string) {
  assertEngineSourced(result);
  return { result, explanation, source: "calculation_engine" as const };
}
