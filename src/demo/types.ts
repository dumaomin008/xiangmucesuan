import type { SchemeCalculationInput } from "@/calculation";

/** 与项目管理 Demo 对齐的项目上下文（关联主键 = projectId） */
export type DemoProjectContext = {
  projectId: string;
  projectName: string;
  customer: string;
  region: string;
  owner: string;
  projectType: string;
  place: string;
  tractorDemand: number | null;
  trailerDemand: number | null;
  stage?: string;
  status?: string;
};

export type DemoProjectRecord = DemoProjectContext & {
  members: string[];
  eco?: string;
  source?: string;
  createdAt: string;
  updatedAt: string;
};

export type ScenarioStatus = "draft" | "calculated" | "baseline" | "archived";

/** 测算方案：必须保存输入快照 + 结果快照 + 引擎版本 */
export type DemoCalcScenario = {
  id: string;
  projectId: string;
  name: string;
  version: string;
  status: ScenarioStatus;
  createdAt: string;
  updatedAt: string;
  inputs: SchemeCalculationInput;
  /** 序列化后的关键指标与完整结果（可 JSON） */
  results: DemoScenarioResults | null;
  calculationVersion: string;
  notes?: string;
};

export type DemoScenarioResults = {
  metrics: {
    monthlyRevenue: string;
    monthlyFixedCost: string;
    monthlyVariableCost: string;
    monthlyFinanceCost: string;
    monthlyTaxCost: string;
    monthlyTotalCost: string;
    monthlyProfit: string;
    profitMargin: string | null;
    profitMarginReason: string | null;
    irr: string | null;
    irrReason: string | null;
    firstPositiveMonth: number | null;
    cumulativeCashFlow: string;
    monthlyVolume: string;
    monthlyMileage: string;
    ruleVersionId: string;
    operatingMonthsYear: number;
  };
  /** 完整可序列化结果树 */
  full: Record<string, unknown>;
  calculatedAt: string;
};

export type DemoCalcDraft = {
  id: string;
  projectId: string;
  scenarioId: string | null;
  name: string;
  inputs: SchemeCalculationInput;
  updatedAt: string;
};

export type DemoCalcPreferences = {
  lastProjectId: string | null;
  lastScenarioId: string | null;
  compareScenarioIds: string[];
  uiDensity: "compact" | "comfortable";
};

export type VersionedEnvelope<T> = {
  schemaVersion: number;
  updatedAt: string;
  data: T;
};

export const DEMO_SCHEMA_VERSION = 1;
