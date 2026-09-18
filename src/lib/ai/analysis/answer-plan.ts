export const ANSWER_INTENTS = [
  "summary",
  "scenario",
  "risk",
  "cost",
  "profit",
  "sensitivity",
  "comparison",
  "due_diligence",
  "clarify",
] as const;

export type AnswerIntent = (typeof ANSWER_INTENTS)[number];

export const VISUALIZATION_WHITELIST = [
  "kpi",
  "cost_structure",
  "scenario_comparison",
  "scenario_delta",
  "profit_delta",
  "cost_delta",
  "profit_trend",
  "cashflow",
  "sensitivity",
  "risk",
  "comparison",
  "due_diligence",
  "parameter_change",
] as const;

export type VisualizationType = (typeof VISUALIZATION_WHITELIST)[number];

export const SECTION_IDS = [
  "summary",
  "metrics",
  "risk",
  "sensitivity",
  "costStructure",
  "scenarioComparison",
  "recommendations",
  "trend",
  "assumptions",
  "parameterChange",
  "delta",
  "dueDiligence",
] as const;

export type SectionId = (typeof SECTION_IDS)[number];

export type ClarificationOption = {
  label: string;
  question: string;
};

export type Clarification = {
  prompt: string;
  options: ClarificationOption[];
};

export type AnswerPlan = {
  intent: AnswerIntent;
  title: string;
  question: string;
  requiresRecalculation: boolean;
  needsClarification: boolean;
  clarification: Clarification | null;
  contextLabel: string | null;
  continueFromLast: boolean;
  primaryConclusion: true;
  primaryMetrics: string[];
  visualizations: VisualizationType[];
  expandedSections: SectionId[];
  collapsedSections: SectionId[];
  temporaryScenario: boolean;
};

export type MetricDeltaRow = {
  key: string;
  name: string;
  baseline: number | null;
  next: number | null;
  delta: number | null;
  deltaRate: number | null;
  unit: "元" | "ratio" | "月";
};

export type ParameterChangeView = {
  name: string;
  before: string;
  after: string;
  changeLabel: string;
  unit: string;
};

export type ScenarioDeltaView = {
  contextLabel: string | null;
  lead: string;
  rows: MetricDeltaRow[];
  parameters: ParameterChangeView[];
  temporaryScenario: true;
  source: "calculation_engine";
};

const VISUALIZATION_SET = new Set<string>(VISUALIZATION_WHITELIST);
const SECTION_SET = new Set<string>(SECTION_IDS);
const INTENT_SET = new Set<string>(ANSWER_INTENTS);

type Layout = {
  title: string;
  primaryMetrics: string[];
  visualizations: VisualizationType[];
  expandedSections: SectionId[];
};

const LAYOUTS: Record<Exclude<AnswerIntent, "clarify">, Layout> = {
  summary: {
    title: "项目综合分析",
    primaryMetrics: ["monthlyProfit", "profitMargin", "monthlyRevenue", "paybackPeriod"],
    visualizations: ["kpi", "risk", "sensitivity", "cost_structure", "scenario_comparison"],
    expandedSections: ["summary", "metrics", "risk", "sensitivity", "costStructure", "scenarioComparison", "recommendations"],
  },
  scenario: {
    title: "情景影响分析",
    primaryMetrics: ["monthlyProfit", "profitMargin", "monthlyRevenue", "monthlyCost", "paybackPeriod"],
    visualizations: ["parameter_change", "scenario_delta", "profit_delta", "cost_delta", "risk"],
    expandedSections: ["summary", "parameterChange", "delta", "metrics", "risk", "recommendations"],
  },
  risk: {
    title: "风险分析",
    primaryMetrics: ["monthlyProfit", "profitMargin", "paybackPeriod"],
    visualizations: ["risk", "sensitivity", "kpi"],
    expandedSections: ["summary", "risk", "metrics", "sensitivity", "recommendations"],
  },
  cost: {
    title: "成本结构分析",
    primaryMetrics: ["monthlyCost", "monthlyProfit"],
    visualizations: ["cost_structure", "kpi"],
    expandedSections: ["summary", "metrics", "costStructure", "recommendations"],
  },
  profit: {
    title: "收益分析",
    primaryMetrics: ["monthlyRevenue", "monthlyCost", "monthlyProfit", "profitMargin", "paybackPeriod"],
    visualizations: ["kpi", "cashflow", "profit_trend", "sensitivity"],
    expandedSections: ["summary", "metrics", "trend", "sensitivity", "recommendations"],
  },
  sensitivity: {
    title: "敏感性分析",
    primaryMetrics: ["monthlyProfit", "profitMargin"],
    visualizations: ["sensitivity"],
    expandedSections: ["summary", "sensitivity", "metrics", "recommendations"],
  },
  comparison: {
    title: "方案对比",
    primaryMetrics: ["monthlyRevenue", "monthlyCost", "monthlyProfit", "profitMargin", "paybackPeriod"],
    visualizations: ["comparison", "scenario_comparison", "scenario_delta", "kpi"],
    expandedSections: ["summary", "metrics", "scenarioComparison", "delta", "risk", "recommendations"],
  },
  due_diligence: {
    title: "待确认数据",
    primaryMetrics: [],
    visualizations: ["due_diligence"],
    expandedSections: ["summary", "dueDiligence", "assumptions", "recommendations"],
  },
};

function compact(question: string) {
  return question.replace(/\s+/g, "");
}

export function isVisualizationType(value: string): value is VisualizationType {
  return VISUALIZATION_SET.has(value);
}

export function filterVisualizations(values: readonly string[]): VisualizationType[] {
  const seen = new Set<VisualizationType>();
  const next: VisualizationType[] = [];
  for (const value of values) {
    if (!isVisualizationType(value) || seen.has(value)) continue;
    seen.add(value);
    next.push(value);
  }
  return next;
}

export function classifyQuestion(question: string): AnswerIntent {
  const q = compact(question);
  if (clarificationFor(question)) return "clarify";
  if (/尽调|待确认|没确认|未确认|哪些数据|需要确认|需要核实|核实什么/.test(q)) return "due_diligence";
  if (/最大的风险|会不会亏损|会亏|最危险|重点关注/.test(q) || (/风险/.test(q) && !/如果/.test(q))) return "risk";
  if (/成本主要|哪块成本|降本|电费占比|成本结构|最大成本|花在哪里/.test(q)) return "cost";
  if (/敏感|影响最大|哪个更重要|利用率/.test(q) && !/如果/.test(q)) return "sensitivity";
  if (/哪个方案|比较方案|方案对比|保守和基准|有什么区别|差多少/.test(q) && !/如果/.test(q)) return "comparison";
  if (/能赚|赚多少|利润怎么样|收益率|多久回本|回本|回收期/.test(q) && !/如果/.test(q)) return "profit";
  if (/如果|上涨|下降|提高到|降低到|增加到|减少/.test(q)) return "scenario";
  return "summary";
}

export function clarificationFor(question: string): Clarification | null {
  const q = compact(question);
  const hasAmount = /\d/.test(q);
  if (/电价/.test(q) && /涨|上|降|下/.test(q) && !hasAmount) {
    const down = /降|下/.test(q) && !/涨|上/.test(q);
    return {
      prompt: down ? "你希望电价下降多少？不会默认假设一个比例。" : "你希望电价上涨多少？不会默认假设 10%。",
      options: down
        ? [
            { label: "-5%", question: "如果电价下降5%呢？" },
            { label: "-10%", question: "如果电价下降10%呢？" },
            { label: "-20%", question: "如果电价下降20%呢？" },
          ]
        : [
            { label: "+5%", question: "如果电价上涨5%呢？" },
            { label: "+10%", question: "如果电价上涨10%呢？" },
            { label: "+20%", question: "如果电价上涨20%呢？" },
          ],
    };
  }
  if (/运价/.test(q) && /涨|上|降|下/.test(q) && !hasAmount) {
    const up = /涨|上/.test(q) && !/降|下/.test(q);
    return {
      prompt: "你希望运价变动多少？不会默认假设一个比例。",
      options: up
        ? [
            { label: "+5%", question: "如果运价上涨5%呢？" },
            { label: "+10%", question: "如果运价上涨10%呢？" },
          ]
        : [
            { label: "-5%", question: "如果运价下降5%呢？" },
            { label: "-10%", question: "如果运价下降10%呢？" },
            { label: "-20%", question: "如果运价下降20%呢？" },
          ],
    };
  }
  if (/车辆|车队/.test(q) && /增加|加车|多几台/.test(q) && !hasAmount) {
    return {
      prompt: "车辆要增加到多少台？不会自动补台数。",
      options: [
        { label: "20台", question: "车辆增加到20台会怎样？" },
        { label: "30台", question: "车辆增加到30台会怎样？" },
        { label: "40台", question: "车辆增加到40台会怎样？" },
      ],
    };
  }
  return null;
}

export function wantsLastScenario(question: string) {
  return /再|在此基础上|接着/.test(compact(question));
}

function collapsedFor(expanded: SectionId[]): SectionId[] {
  return SECTION_IDS.filter((item) => !expanded.includes(item));
}

export function buildAnswerPlan(input: {
  question: string;
  scenarioTitle?: string;
  forceScenario?: boolean;
  continueFromLast?: boolean;
  contextBasis?: string | null;
  clarify?: Clarification | null;
}): AnswerPlan {
  const question = input.question.trim() || "帮我分析一下这个项目";
  const clarify = input.clarify ?? clarificationFor(question);
  const continueFromLast = input.continueFromLast ?? wantsLastScenario(question);
  if (clarify && !input.forceScenario) {
    return {
      intent: "clarify",
      title: "需要补充测算条件",
      question,
      requiresRecalculation: false,
      needsClarification: true,
      clarification: clarify,
      contextLabel: input.contextBasis ? `当前分析基于：${input.contextBasis}` : null,
      continueFromLast,
      primaryConclusion: true,
      primaryMetrics: [],
      visualizations: [],
      expandedSections: ["summary"],
      collapsedSections: collapsedFor(["summary"]),
      temporaryScenario: false,
    };
  }
  const classified = input.forceScenario ? "scenario" : classifyQuestion(question);
  const intent: Exclude<AnswerIntent, "clarify"> = classified === "clarify" ? "summary" : classified;
  const layout = LAYOUTS[intent];
  const contextLabel = continueFromLast && input.contextBasis
    ? `当前分析基于：${input.contextBasis}`
    : intent === "scenario"
      ? `当前分析：${input.scenarioTitle || layout.title}`
      : null;
  return {
    intent,
    title: input.scenarioTitle && intent === "scenario" ? input.scenarioTitle : layout.title,
    question,
    requiresRecalculation: intent === "scenario",
    needsClarification: false,
    clarification: null,
    contextLabel,
    continueFromLast,
    primaryConclusion: true,
    primaryMetrics: layout.primaryMetrics,
    visualizations: filterVisualizations(layout.visualizations),
    expandedSections: layout.expandedSections,
    collapsedSections: collapsedFor(layout.expandedSections),
    temporaryScenario: intent === "scenario",
  };
}

export function sanitizeAnswerPlan(raw: unknown, fallback: AnswerPlan): AnswerPlan {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return fallback;
  const data = raw as Record<string, unknown>;
  const intent = typeof data.intent === "string" && INTENT_SET.has(data.intent) ? (data.intent as AnswerIntent) : fallback.intent;
  const visualizations = filterVisualizations(Array.isArray(data.visualizations) ? data.visualizations.map(String) : fallback.visualizations);
  const expanded = (Array.isArray(data.expandedSections) ? data.expandedSections.map(String) : fallback.expandedSections).filter(
    (item): item is SectionId => SECTION_SET.has(item),
  );
  return {
    ...fallback,
    intent,
    title: typeof data.title === "string" && data.title.trim() && !/\d{5,}/.test(data.title) ? data.title.trim() : fallback.title,
    visualizations: visualizations.length ? visualizations : fallback.visualizations,
    expandedSections: expanded.length ? expanded : fallback.expandedSections,
    collapsedSections: collapsedFor(expanded.length ? expanded : fallback.expandedSections),
    primaryMetrics: fallback.primaryMetrics,
    needsClarification: fallback.needsClarification,
    clarification: fallback.clarification,
    requiresRecalculation: fallback.requiresRecalculation,
    temporaryScenario: fallback.temporaryScenario,
  };
}
