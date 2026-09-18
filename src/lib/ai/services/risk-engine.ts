import { AI_RISK_RULE_VERSION } from "../schema/versions";

export type RiskEngineStatus = "rules_not_configured" | "ready";

export function getRiskEngineStatus(): RiskEngineStatus {
  return AI_RISK_RULE_VERSION ? "ready" : "rules_not_configured";
}

export function evaluateRisks(_input: { resultVersionId?: string; extract?: unknown }) {
  return {
    status: getRiskEngineStatus(),
    items: [] as unknown[],
    message: "风险规则与阈值尚未冻结。风险等级不得由大模型直接生成。",
  };
}
