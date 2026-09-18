/** AI 对话测算的结构化协议。数字由调用方从 Calculation Engine 填入，模型不得覆盖。 */

export type AIIntent =
  | "GENERAL_CHAT"
  | "CREATE_CALCULATION"
  | "IMPORT_CALCULATION"
  | "PROJECT_ANALYSIS"
  | "PROJECT_COMPARE"
  | "SCHEME_COMPARE"
  | "RISK_ANALYSIS"
  | "SENSITIVITY_ANALYSIS"
  | "CALCULATION_EXPLAIN"
  | "GENERATE_REPORT";

export type KPITrend = "up" | "down" | "flat" | "none";

export type KPIItem = {
  key: string;
  label: string;
  value: string;
  raw: number | null;
  unit?: string;
  hint?: string;
  trend: KPITrend;
  trendLabel?: string;
};

export type ChartSeries = {
  name: string;
  values: number[];
};

export type ChartBlock = {
  type: "chart";
  chartType: "bar" | "line" | "pie" | "horizontalBar" | "sensitivity";
  title: string;
  categories?: string[];
  series?: ChartSeries[];
  slices?: { name: string; value: number }[];
  note?: string;
  highlightIndex?: number;
};

export type TableColumn = {
  key: string;
  label: string;
  align?: "left" | "right";
  numeric?: boolean;
  signed?: boolean;
};

export type TableRow = {
  project?: string;
  scheme?: string;
  revenue?: string;
  cost?: string;
  profit?: string;
  margin?: string;
  fleet?: string;
  status?: string;
  profitRaw?: number | null;
  projectId?: string;
  scenarioId?: string;
};

export type TableBlock = {
  type: "table";
  title?: string;
  columns: TableColumn[];
  rows: TableRow[];
};

export type ConclusionBlock = {
  type: "conclusion";
  title: string;
  items: string[];
};

export type RiskItem = {
  name: string;
  level: "高" | "中" | "低";
  evidence: string;
  projectId?: string;
  scenarioId?: string;
};

export type RiskBlock = {
  type: "risk";
  data: RiskItem[];
};

export type TextBlock = {
  type: "text";
  text: string;
};

export type CalculationCompareItem = {
  label: string;
  before: string;
  after: string;
  delta: string;
  afterRaw: number | null;
  deltaRaw: number | null;
};

export type CalculationBlock = {
  type: "calculation";
  title: string;
  beforeLabel: string;
  afterLabel: string;
  items: CalculationCompareItem[];
};

export type AIBlock =
  | TextBlock
  | { type: "kpi"; data: KPIItem[] }
  | ChartBlock
  | TableBlock
  | ConclusionBlock
  | RiskBlock
  | CalculationBlock;

export type AIActionKind = "navigate" | "ask" | "export" | "picker" | "import" | "import-confirm" | "import-edit";

export type AIAction = {
  id: string;
  label: string;
  kind: AIActionKind;
  href?: string;
  ask?: string;
  picker?: "compare" | "copy";
  projectId?: string;
  scenarioId?: string;
};

export type AIResponse = {
  intent: AIIntent;
  message: string;
  blocks: AIBlock[];
  actions: AIAction[];
  context?: {
    projectId?: string;
    schemeId?: string;
    calculationResultId?: string;
    importSessionId?: string;
  };
};

export type CenterMetrics = {
  monthlyRevenue: string;
  monthlyTotalCost: string;
  monthlyProfit: string;
  profitMargin: string | null;
  monthlyFixedCost?: string;
  monthlyVariableCost?: string;
  monthlyFinanceCost?: string;
  monthlyTaxCost?: string;
  fleetSize?: number;
  profitPerVehicle?: string | null;
  irr?: string | null;
};

export type CashFlowPoint = {
  monthIndex: number;
  revenueCashIn: string;
  currentNetCashFlow: string;
  isProjectMonth?: boolean;
};

export type CenterScenario = {
  id: string;
  name: string;
  status: string;
  projectId: string;
  metrics: CenterMetrics | null;
  calculatedAt?: string | null;
  inputs?: unknown;
  cashFlows?: CashFlowPoint[];
};

export type CenterProject = {
  projectId: string;
  projectName: string;
  customer: string;
  scenarios: CenterScenario[];
};

export type SensitivityPoint = {
  parameterChange: string;
  monthlyRevenue: string;
  monthlyProfit: string;
  profitMargin: string | null;
  profitDelta: string;
};

export type SensitivityRunner = (params: {
  input: unknown;
  variable: string;
  changeMode: "PERCENT";
  minChange: string;
  maxChange: string;
  step: string;
}) => SensitivityPoint[];

export type ImportParamView = {
  label: string;
  value: string | number | null;
  unit?: string;
  status: string;
  group?: string;
};

export type ConversationMeta = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
};
