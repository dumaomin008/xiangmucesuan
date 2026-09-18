import type { AI_ANALYSIS_REPORT_SCHEMA_VERSION } from "../schema/versions";

export type AnalysisMode = "online" | "demo" | "fallback";
export type MetricStatus = "normal" | "near_breakeven" | "below_breakeven" | "pending";
export type RiskLevel = "high" | "medium" | "low";
export type ImpactLevel = "high" | "medium" | "low";
export type ScenarioSource = "demo_rule" | "calculation_engine";
export type AssumptionTag = "confirmed" | "calculated" | "ai_inferred" | "missing";

export type KeyMetric = {
  key: string;
  name: string;
  value: number | null;
  unit: "元" | "ratio" | "月";
  source: "calculation_engine";
  status: MetricStatus;
  statusLabel: string;
};

export type CostStructureItem = {
  code: string;
  name: string;
  value: number;
  percentage: number;
};

export type ScenarioAdjustment = {
  parameter: string;
  percent: number;
};

export type ScenarioComparison = {
  name: string;
  revenue: number;
  cost: number;
  profit: number;
  roi: number | null;
  paybackPeriod: number | null;
  scenarioSource: ScenarioSource;
  adjustments: ScenarioAdjustment[];
};

export type SensitivityPoint = {
  parameter: string;
  parameterKey: string;
  change: number;
  profit: number;
  profitChange: number;
  impactLevel: ImpactLevel;
};

export type AnalysisRisk = {
  name: string;
  level: RiskLevel;
  description: string;
  affectedMetrics: string[];
  evidence: string;
  suggestion: string;
};

export type AssumptionItem = {
  label: string;
  tag: AssumptionTag;
};

export type AnalysisRecommendation = {
  priority: number;
  action: string;
  reason: string;
  affectedMetric: string;
};

export type VisualizationHint = {
  type: "kpi" | "cost_structure" | "scenario_comparison" | "profit_trend" | "cashflow" | "sensitivity" | "risk";
  title: string;
  dataSource: string;
};

export type TrendPoint = {
  monthIndex: number;
  revenue: number;
  cost: number;
  profit: number;
  cumulativeCashFlow: number;
};

export type AnalysisAssumptionInput = {
  field_code?: string;
  field_name?: string;
  value?: string;
  unit?: string | null;
  label?: string;
  status?: string;
  source_label?: string;
};

export type AIAnalysisReport = {
  schemaVersion: typeof AI_ANALYSIS_REPORT_SCHEMA_VERSION;
  mode: AnalysisMode;
  notice: string | null;
  scenarioSource: ScenarioSource;
  scenarioNote: string;
  summary: {
    title: string;
    conclusion: string;
    highlights: string[];
  };
  keyMetrics: KeyMetric[];
  costStructure: CostStructureItem[];
  costInsight: {
    largest: string | null;
    anomaly: string | null;
    optimize: string | null;
  };
  trend: {
    available: boolean;
    message: string | null;
    breakevenMonth: number | null;
    points: TrendPoint[];
  };
  scenarios: ScenarioComparison[];
  sensitivity: SensitivityPoint[];
  sensitivityHighlight: {
    parameter: string;
    reason: string;
  } | null;
  risks: AnalysisRisk[];
  assumptions: {
    confirmed: AssumptionItem[];
    calculated: AssumptionItem[];
    aiInferred: AssumptionItem[];
    missing: AssumptionItem[];
  };
  recommendations: AnalysisRecommendation[];
  visualizations: VisualizationHint[];
};

export const DEMO_ANALYSIS_NOTICE = "AI智能分析暂时使用本地分析模式，测算结果不受影响。";
export const FALLBACK_ANALYSIS_NOTICE = "测算已完成，AI深度分析暂时不可用。";
export const TREND_UNAVAILABLE_MESSAGE = "当前测算结果未提供分期现金流数据，暂无法生成趋势分析。";
