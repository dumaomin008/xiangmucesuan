export const PROFIT_MARGIN_REASONS = {
  REVENUE_ZERO: "REVENUE_ZERO",
} as const;

export const IRR_REASONS = {
  IRR_NO_SIGN_CHANGE: "IRR_NO_SIGN_CHANGE",
  IRR_NOT_CONVERGED: "IRR_NOT_CONVERGED",
  IRR_INSUFFICIENT_PERIODS: "IRR_INSUFFICIENT_PERIODS",
  IRR_DIV_ZERO: "IRR_DIV_ZERO",
  IRR_DIVERGED: "IRR_DIVERGED",
  IRR_ANNUALIZE_INVALID: "IRR_ANNUALIZE_INVALID",
  IRR_HORIZON_SHORT: "IRR_HORIZON_SHORT",
} as const;

export const PROFIT_MARGIN_REASON_TEXT: Record<string, string> = {
  REVENUE_ZERO: "当前方案营收为0，因此利润率无法计算",
};

export const IRR_REASON_TEXT: Record<string, string> = {
  IRR_NO_SIGN_CHANGE: "现金流未同时出现正负号，无法计算",
  IRR_NOT_CONVERGED: "算法无法收敛，无法计算",
  IRR_INSUFFICIENT_PERIODS: "现金流期数不足，无法计算",
  IRR_DIV_ZERO: "迭代过程中分母为 0，无法计算",
  IRR_DIVERGED: "迭代发散，无法计算",
  IRR_ANNUALIZE_INVALID: "年化结果非法，无法计算",
  IRR_HORIZON_SHORT: "测算年限不足，无法计算",
};

export function explainUnavailable(code: string | null | undefined, fallback = "无法计算"): string {
  if (!code) return fallback;
  return PROFIT_MARGIN_REASON_TEXT[code] || IRR_REASON_TEXT[code] || code;
}

export const PARAMETER_SOURCE_LABEL: Record<string, string> = {
  STANDARD: "公司标准",
  PROJECT: "项目填写",
  ROUTE: "线路填写",
  SEGMENT: "路段填写",
  COMPUTED: "系统计算",
  OVERRIDE: "人工覆盖",
};
