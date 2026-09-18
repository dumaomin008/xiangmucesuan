import { CALC_MODE, CALCULATION_ENGINE_VERSION, type CalcMode } from "../config";
import { calculateProject, type SchemeCalculationInput, type SchemeCalculationOutput } from "../core";

/**
 * API 适配器（正式模式预留）。
 * Phase 1：本地仍走同一套纯函数，保证与 browser 结果一致；
 * 后续可替换为 fetch('/api/calculation-schemes/:id/calculate')。
 */
export type ApiCalculateFn = (input: SchemeCalculationInput) => Promise<SchemeCalculationOutput>;

export function createApiAdapter(options?: {
  mode?: CalcMode;
  /** 正式环境可注入远程计算；未注入时回退到本地纯函数（用于一致性对照） */
  remoteCalculate?: ApiCalculateFn;
}) {
  const mode = options?.mode ?? CALC_MODE;
  if (mode !== "api" && !options?.remoteCalculate) {
    // 允许在测试中强制使用 api 适配器的本地回退路径
  }

  const calculateLocal = (input: SchemeCalculationInput) => calculateProject(input);

  return {
    mode: "api" as const,
    engineVersion: CALCULATION_ENGINE_VERSION,
    async calculate(input: SchemeCalculationInput): Promise<SchemeCalculationOutput> {
      if (options?.remoteCalculate) {
        return options.remoteCalculate(input);
      }
      return calculateLocal(input);
    },
    /** 与浏览器引擎对照用：强制本地纯函数 */
    calculateLocal,
  };
}
