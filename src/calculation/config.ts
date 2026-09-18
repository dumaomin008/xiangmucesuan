/**
 * 双模式运行配置（Phase 1：仅建立计算侧入口，不切换业务存储）。
 * 演示默认：demo + browser；正式后端仍走 api。
 */
export type AppMode = "demo" | "server";
export type CalcMode = "browser" | "api";

export const CALCULATION_ENGINE_VERSION = "1.0.0-browser";

function readPublicEnv(key: string): string | undefined {
  try {
    if (typeof process !== "undefined" && process.env) {
      return process.env[key];
    }
  } catch {
    /* browser / static bundle without process */
  }
  return undefined;
}

/** 演示默认 demo；正式部署可设 NEXT_PUBLIC_APP_MODE=server */
export const APP_MODE: AppMode =
  readPublicEnv("NEXT_PUBLIC_APP_MODE") === "server" ? "server" : "demo";

/** 演示默认 browser；正式可设 NEXT_PUBLIC_CALC_MODE=api */
export const CALC_MODE: CalcMode =
  readPublicEnv("NEXT_PUBLIC_CALC_MODE") === "api" ? "api" : "browser";

export function isBrowserCalcMode(mode: CalcMode = CALC_MODE): boolean {
  return mode === "browser";
}
