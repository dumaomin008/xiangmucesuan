import { detectIntent } from "./intent";
import type {
  AIAction,
  AIBlock,
  AIResponse,
  CalculationCompareItem,
  CenterProject,
  CenterScenario,
  ChartBlock,
  ImportParamView,
  KPIItem,
  RiskItem,
  SensitivityPoint,
  SensitivityRunner,
  TableRow,
} from "./types";

const NAME_TOKENS = ["临港", "杭州", "盐田", "洋山", "嘉兴", "深圳", "宁波", "鄂尔多斯", "成渝", "沪甬", "沪杭"];

const VARIABLE_SPECS: { test: RegExp; code: string; name: string }[] = [
  { test: /电价/, code: "electricity_price", name: "电价" },
  { test: /运价/, code: "freight_price", name: "运价" },
  { test: /货量|趟次|运量/, code: "trips_per_vehicle_month", name: "单车月趟数" },
  { test: /租金|月租/, code: "monthly_rent_per_vehicle", name: "单车月租" },
  { test: /能耗|电耗/, code: "loaded_energy_consumption", name: "满载能耗" },
];

const SUPPORTED_VARIABLES = "电价、运价、货量（单车月趟数）、车辆月租、满载能耗";

export function formatEngineMoney(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatEnginePercent(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return `${(n * 100).toFixed(2)}%`;
}

function num(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function moneyDelta(before: number | null, after: number | null): string {
  if (before === null || after === null) return "—";
  const delta = after - before;
  const text = formatEngineMoney(delta);
  return delta > 0 ? `+${text}` : text;
}

function percentDelta(before: number | null, after: number | null): string {
  if (before === null || after === null) return "—";
  const delta = (after - before) * 100;
  return `${delta >= 0 ? "+" : ""}${delta.toFixed(2)} pt`;
}

export function latestScenario(project: CenterProject): CenterScenario | null {
  const calculated = project.scenarios.filter((s) => s.metrics && s.calculatedAt);
  if (calculated.length) {
    return [...calculated].sort((a, b) => String(b.calculatedAt).localeCompare(String(a.calculatedAt)))[0];
  }
  return project.scenarios.find((s) => s.metrics) || project.scenarios[0] || null;
}

function bizStatus(project: CenterProject): { label: string; tone: "danger" | "warning" | "success" } {
  const risky = project.scenarios.some((s) => {
    const profit = num(s.metrics?.monthlyProfit);
    return profit != null && profit < 0;
  });
  if (risky) return { label: "存在风险", tone: "danger" };
  const hasResult = project.scenarios.some((s) => Boolean(s.metrics));
  const hasDraft = project.scenarios.some((s) => s.status === "draft" || !s.metrics);
  if (hasDraft && !hasResult) return { label: "待完善", tone: "warning" };
  if (hasResult) return { label: "已测算", tone: "success" };
  return { label: "待完善", tone: "warning" };
}

function shortName(name: string): string {
  return name.length > 10 ? `${name.slice(0, 10)}…` : name;
}

function matchProjects(question: string, projects: CenterProject[]): CenterProject[] {
  const named = projects.filter((p) => question.includes(p.projectName));
  if (named.length) return named;
  return projects.filter((p) => NAME_TOKENS.some((token) => question.includes(token) && p.projectName.includes(token)));
}

function portfolio(projects: CenterProject[]) {
  const latest = projects
    .map((project) => ({ project, scenario: latestScenario(project) }))
    .filter((row): row is { project: CenterProject; scenario: CenterScenario } => Boolean(row.scenario?.metrics));
  const revenue = latest.reduce((sum, row) => sum + (num(row.scenario.metrics?.monthlyRevenue) || 0), 0);
  const profit = latest.reduce((sum, row) => sum + (num(row.scenario.metrics?.monthlyProfit) || 0), 0);
  const margins = latest.map((row) => num(row.scenario.metrics?.profitMargin)).filter((v): v is number => v != null);
  const avgMargin = margins.length ? margins.reduce((sum, v) => sum + v, 0) / margins.length : null;
  const schemeCount = projects.reduce((sum, project) => sum + project.scenarios.length, 0);
  const incomplete = projects.filter((project) => project.scenarios.some((s) => !s.metrics || s.status === "draft")).length;
  const risky = projects.filter((project) =>
    project.scenarios.some((s) => s.metrics && (num(s.metrics.monthlyProfit) ?? 0) < 0),
  ).length;
  return { latest, revenue, profit, avgMargin, schemeCount, incomplete, risky };
}

function kpi(partial: Omit<KPIItem, "trend"> & { trend?: KPIItem["trend"] }): KPIItem {
  return { trend: "none", ...partial };
}

function analysisKpis(projects: CenterProject[]): KPIItem[] {
  const stats = portfolio(projects);
  const profitTrend = stats.profit > 0 ? "up" : stats.profit < 0 ? "down" : "flat";
  return [
    kpi({
      key: "projects",
      label: "测算项目数",
      value: String(projects.length),
      raw: projects.length,
      unit: "个",
      hint: "当前可见范围内已有测算方案的项目数",
    }),
    kpi({
      key: "schemes",
      label: "测算方案数",
      value: String(stats.schemeCount),
      raw: stats.schemeCount,
      unit: "个",
      hint: "上述项目下的方案合计，含草稿",
    }),
    kpi({
      key: "revenue",
      label: "预计月收入",
      value: formatEngineMoney(stats.revenue),
      raw: stats.revenue,
      unit: "元",
      hint: "各项目最新已测算方案的月收入合计，来自 Calculation Engine",
      trend: profitTrend,
      trendLabel: stats.latest.length ? "已测算方案合计" : "暂无结果",
    }),
    kpi({
      key: "margin",
      label: "平均利润率",
      value: formatEnginePercent(stats.avgMargin),
      raw: stats.avgMargin,
      hint: "最新已测算方案利润率的算术平均，用于对照，不是新的财务公式",
      trend: profitTrend,
      trendLabel: stats.profit > 0 ? "整体盈利" : stats.profit < 0 ? "整体亏损" : "持平",
    }),
  ];
}

function projectRows(projects: CenterProject[]): TableRow[] {
  return projects.map((project) => {
    const scenario = latestScenario(project);
    const metrics = scenario?.metrics;
    const profitRaw = num(metrics?.monthlyProfit);
    const status = bizStatus(project);
    return {
      project: project.projectName,
      scheme: scenario?.name || "待测算",
      revenue: formatEngineMoney(metrics?.monthlyRevenue),
      cost: formatEngineMoney(metrics?.monthlyTotalCost),
      profit: formatEngineMoney(metrics?.monthlyProfit),
      margin: formatEnginePercent(metrics?.profitMargin),
      fleet: metrics?.fleetSize != null ? String(metrics.fleetSize) : "—",
      status: status.label,
      profitRaw,
      projectId: project.projectId,
      scenarioId: scenario?.id,
    };
  });
}

const PROJECT_COLUMNS = [
  { key: "project", label: "项目" },
  { key: "revenue", label: "月收入", align: "right" as const, numeric: true },
  { key: "cost", label: "月成本", align: "right" as const, numeric: true },
  { key: "profit", label: "月利润", align: "right" as const, numeric: true, signed: true },
  { key: "margin", label: "利润率", align: "right" as const, numeric: true },
  { key: "fleet", label: "车辆数", align: "right" as const, numeric: true },
  { key: "status", label: "状态" },
];

function statusPie(projects: CenterProject[]): ChartBlock {
  const counts = new Map<string, number>();
  for (const project of projects) {
    const label = bizStatus(project).label;
    counts.set(label, (counts.get(label) || 0) + 1);
  }
  return {
    type: "chart",
    chartType: "pie",
    title: "项目测算状态",
    slices: [...counts.entries()].map(([name, value]) => ({ name, value })),
    note: "按项目归类：存在亏损方案优先记为存在风险。计数来自已保存方案，不是模型估计。",
  };
}

function compareBar(rows: { project: CenterProject; scenario: CenterScenario }[]): ChartBlock {
  return {
    type: "chart",
    chartType: "bar",
    title: "月收入 / 月利润对比",
    categories: rows.map((row) => shortName(row.project.projectName)),
    series: [
      { name: "月收入", values: rows.map((row) => num(row.scenario.metrics?.monthlyRevenue) || 0) },
      { name: "月利润", values: rows.map((row) => num(row.scenario.metrics?.monthlyProfit) || 0) },
    ],
    note: "柱值为各项目最新 Calculation Result，单位：元。",
  };
}

function cashflowLine(project: CenterProject, scenario: CenterScenario): ChartBlock | null {
  const flows = (scenario.cashFlows || []).filter((row) => row.isProjectMonth !== false).slice(0, 12);
  if (flows.length < 2) return null;
  return {
    type: "chart",
    chartType: "line",
    title: `${shortName(project.projectName)}经营月现金流入`,
    categories: flows.map((row) => `${row.monthIndex}月`),
    series: [{ name: "现金流入", values: flows.map((row) => num(row.revenueCashIn) || 0) }],
    note: "来自该方案现金流结果中的 revenueCashIn，不是另行估算的利润趋势。",
  };
}

function costPie(project: CenterProject, scenario: CenterScenario): ChartBlock | null {
  const metrics = scenario.metrics;
  if (!metrics) return null;
  const slices = [
    { name: "固定成本", value: num(metrics.monthlyFixedCost) || 0 },
    { name: "变动成本", value: num(metrics.monthlyVariableCost) || 0 },
    { name: "财务成本", value: num(metrics.monthlyFinanceCost) || 0 },
    { name: "税费", value: num(metrics.monthlyTaxCost) || 0 },
  ].filter((slice) => slice.value > 0);
  if (!slices.length) return null;
  return {
    type: "chart",
    chartType: "pie",
    title: `${shortName(project.projectName)}月成本结构`,
    slices,
    note: "四项均来自已保存测算结果，单位：元。",
  };
}

function openActions(project?: CenterProject, scenario?: CenterScenario | null): AIAction[] {
  const actions: AIAction[] = [
    { id: "compare", label: "方案对比", kind: "picker", picker: "compare" },
    { id: "report", label: "生成分析报告", kind: "ask", ask: "生成本月项目经营分析报告" },
    { id: "export", label: "导出数据报表", kind: "export" },
  ];
  if (project && scenario) {
    actions.unshift(
      { id: "detail", label: "查看项目详情", kind: "navigate", href: `/projects/${project.projectId}`, projectId: project.projectId },
      {
        id: "continue",
        label: "继续测算",
        kind: "navigate",
        href: `/projects/${project.projectId}/calculation/${scenario.id}`,
        projectId: project.projectId,
        scenarioId: scenario.id,
      },
      {
        id: "sensitivity",
        label: "敏感性分析",
        kind: "ask",
        ask: `如果${project.projectName}电价上涨10%，利润会怎么样？`,
        projectId: project.projectId,
        scenarioId: scenario.id,
      },
    );
  }
  return actions;
}

function emptyProjects(intent: AIResponse["intent"]): AIResponse {
  return {
    intent,
    message: "当前还没有可读取的测算项目。可以先新建测算，或切回传统列表关联已有项目。测算引擎本身不受影响。",
    blocks: [],
    actions: [
      { id: "create", label: "新建测算", kind: "ask", ask: "帮我测算一个新的运输项目" },
      { id: "manual", label: "手动输入", kind: "navigate", href: "/calculation/manual" },
      { id: "list", label: "进入传统测算", kind: "navigate", href: "view:list" },
    ],
  };
}

function buildAnalysis(projects: CenterProject[]): AIResponse {
  if (!projects.length) return emptyProjects("PROJECT_ANALYSIS");
  const stats = portfolio(projects);
  const top = [...stats.latest].sort(
    (a, b) => (num(b.scenario.metrics?.monthlyProfit) || 0) - (num(a.scenario.metrics?.monthlyProfit) || 0),
  )[0];
  const line = top ? cashflowLine(top.project, top.scenario) : null;
  const risks = riskItems(projects);
  const items = [
    `当前 ${projects.length} 个测算项目、${stats.schemeCount} 个方案。其中 ${stats.latest.length} 个项目已有引擎结果，预计月收入合计 ${formatEngineMoney(stats.revenue)} 元，平均利润率 ${formatEnginePercent(stats.avgMargin)}。`,
    top
      ? `${top.project.projectName}当前月利润最高，为 ${formatEngineMoney(top.scenario.metrics?.monthlyProfit)} 元。`
      : "还没有已保存的测算结果，暂时无法给出利润结论。",
    stats.risky
      ? `${stats.risky} 个项目存在月利润为负的方案，建议先看风险清单。`
      : "已测算方案里没有月利润为负的项目。",
    `待完善测算 ${stats.incomplete} 个。可继续做电价或货量敏感性，数字仍由测算引擎重算。`,
  ];
  const blocks: AIBlock[] = [
    { type: "kpi", data: analysisKpis(projects) },
    compareBar(stats.latest.length ? stats.latest : []),
    statusPie(projects),
  ];
  if (line) blocks.push(line);
  if (stats.latest.length) {
    blocks.push({ type: "table", title: "最近测算项目", columns: PROJECT_COLUMNS, rows: projectRows(projects) });
  }
  if (risks.length) blocks.push({ type: "risk", data: risks });
  blocks.push({ type: "conclusion", title: "AI 结论与建议", items });
  return {
    intent: "PROJECT_ANALYSIS",
    message: "我按已保存的测算结果整理了当前项目经营情况。下面的金额都来自 Calculation Engine，不是模型估算。",
    blocks: blocks.filter((block) => block.type !== "chart" || block.chartType !== "bar" || (block.series?.[0]?.values.length || 0) > 0),
    actions: openActions(top?.project, top?.scenario),
    context: top ? { projectId: top.project.projectId, schemeId: top.scenario.id } : undefined,
  };
}

function riskItems(projects: CenterProject[]): RiskItem[] {
  return projects
    .map((project): RiskItem | null => {
      const scenario = latestScenario(project);
      const profit = num(scenario?.metrics?.monthlyProfit);
      const margin = num(scenario?.metrics?.profitMargin);
      if (!scenario?.metrics || profit === null) {
        if (project.scenarios.some((s) => !s.metrics || s.status === "draft")) {
          return {
            name: project.projectName,
            level: "中" as const,
            evidence: "尚无完整测算结果，或仍有草稿方案未测算。",
            projectId: project.projectId,
            scenarioId: scenario?.id,
          };
        }
        return null;
      }
      if (profit < 0) {
        return {
          name: project.projectName,
          level: "高" as const,
          evidence: `最新方案「${scenario.name}」月利润 ${formatEngineMoney(profit)} 元，利润率 ${formatEnginePercent(margin)}。`,
          projectId: project.projectId,
          scenarioId: scenario.id,
        };
      }
      if (margin != null && margin < 0.08) {
        return {
          name: project.projectName,
          level: "中" as const,
          evidence: `最新方案月利润为正，但利润率 ${formatEnginePercent(margin)}，低于 8% 的对照线。`,
          projectId: project.projectId,
          scenarioId: scenario.id,
        };
      }
      return null;
    })
    .filter((item): item is RiskItem => Boolean(item))
    .sort((a, b) => (a.level === "高" ? -1 : 1) - (b.level === "高" ? -1 : 1));
}

function buildCompare(question: string, projects: CenterProject[]): AIResponse {
  const matched = matchProjects(question, projects);
  if (matched.length < 2) {
    return {
      intent: "PROJECT_COMPARE",
      message: matched.length
        ? `只识别到「${matched[0].projectName}」。请再选至少 1 个项目，我会用已保存结果做对比。`
        : "请至少选择 2 个已测算项目。我不会在未点名时用猜测数字做对比。",
      blocks: [],
      actions: [{ id: "pick", label: "选择项目", kind: "picker", picker: "compare" }],
    };
  }
  const rows = matched
    .map((project) => ({ project, scenario: latestScenario(project) }))
    .filter((row): row is { project: CenterProject; scenario: CenterScenario } => Boolean(row.scenario?.metrics));
  if (rows.length < 2) {
    return {
      intent: "PROJECT_COMPARE",
      message: "选中的项目里，至少有一个还没有测算结果。请先完成测算，再对比收入、成本和利润。",
      blocks: [{ type: "table", title: "项目状态", columns: PROJECT_COLUMNS, rows: projectRows(matched) }],
      actions: openActions(matched[0], latestScenario(matched[0])),
      context: { projectId: matched[0].projectId },
    };
  }
  const [left, right] = [...rows].sort(
    (a, b) => (num(b.scenario.metrics?.monthlyProfit) || 0) - (num(a.scenario.metrics?.monthlyProfit) || 0),
  );
  const profitGap = (num(left.scenario.metrics?.monthlyProfit) || 0) - (num(right.scenario.metrics?.monthlyProfit) || 0);
  const costPieBlock = costPie(left.project, left.scenario);
  const blocks: AIBlock[] = [
    compareBar(rows),
    {
      type: "chart",
      chartType: "horizontalBar",
      title: "月利润对比",
      categories: rows.map((row) => shortName(row.project.projectName)),
      series: [{ name: "月利润", values: rows.map((row) => num(row.scenario.metrics?.monthlyProfit) || 0) }],
      note: "按已保存月利润排序，单位：元。",
    },
  ];
  if (costPieBlock) blocks.push(costPieBlock);
  blocks.push(
    { type: "table", title: "项目核心指标", columns: PROJECT_COLUMNS, rows: projectRows(matched) },
    {
      type: "conclusion",
      title: "AI 结论与建议",
      items: [
        `${left.project.projectName}月利润更高，为 ${formatEngineMoney(left.scenario.metrics?.monthlyProfit)} 元；${right.project.projectName}为 ${formatEngineMoney(right.scenario.metrics?.monthlyProfit)} 元，差额 ${formatEngineMoney(profitGap)} 元。`,
        `利润率分别为 ${formatEnginePercent(left.scenario.metrics?.profitMargin)} 与 ${formatEnginePercent(right.scenario.metrics?.profitMargin)}。车辆数以各方案结果为准。`,
        "成本结构图只展示月利润较高一方的已保存成本分项。若要看另一方可进入该项目继续测算。",
      ],
    },
  );
  return {
    intent: "PROJECT_COMPARE",
    message: `已对比 ${rows.map((row) => row.project.projectName).join("、")} 的最新测算结果。`,
    blocks,
    actions: openActions(left.project, left.scenario),
    context: { projectId: left.project.projectId, schemeId: left.scenario.id },
  };
}

function buildSchemeCompare(question: string, projects: CenterProject[], focusProjectId?: string): AIResponse {
  const matched = matchProjects(question, projects);
  const project =
    matched[0] || projects.find((item) => item.projectId === focusProjectId) || projects.find((item) => item.scenarios.length > 1) || projects[0];
  if (!project) return emptyProjects("SCHEME_COMPARE");
  const ready = project.scenarios.filter((s) => s.metrics);
  if (ready.length < 2) {
    return {
      intent: "SCHEME_COMPARE",
      message: `「${project.projectName}」目前不足两个已测算方案，无法对比。可以先复制方案或继续测算。`,
      blocks: [],
      actions: openActions(project, ready[0] || null),
      context: { projectId: project.projectId, schemeId: ready[0]?.id },
    };
  }
  const rows = ready.map((scenario) => ({
    scheme: scenario.name,
    revenue: formatEngineMoney(scenario.metrics?.monthlyRevenue),
    cost: formatEngineMoney(scenario.metrics?.monthlyTotalCost),
    profit: formatEngineMoney(scenario.metrics?.monthlyProfit),
    margin: formatEnginePercent(scenario.metrics?.profitMargin),
    fleet: scenario.metrics?.fleetSize != null ? String(scenario.metrics.fleetSize) : "—",
    status: scenario.status === "baseline" ? "基准" : scenario.status === "calculated" ? "已测算" : scenario.status,
    profitRaw: num(scenario.metrics?.monthlyProfit),
    projectId: project.projectId,
    scenarioId: scenario.id,
  }));
  const sorted = [...ready].sort((a, b) => (num(b.metrics?.monthlyProfit) || 0) - (num(a.metrics?.monthlyProfit) || 0));
  return {
    intent: "SCHEME_COMPARE",
    message: `「${project.projectName}」共 ${ready.length} 个已测算方案，下面按引擎结果对比。`,
    blocks: [
      {
        type: "chart",
        chartType: "bar",
        title: "方案月利润",
        categories: ready.map((s) => shortName(s.name)),
        series: [{ name: "月利润", values: ready.map((s) => num(s.metrics?.monthlyProfit) || 0) }],
        note: "单位：元。同一项目内的方案结果。",
      },
      {
        type: "table",
        title: "方案对比",
        columns: [
          { key: "scheme", label: "方案" },
          { key: "revenue", label: "月收入", align: "right", numeric: true },
          { key: "cost", label: "月成本", align: "right", numeric: true },
          { key: "profit", label: "月利润", align: "right", numeric: true, signed: true },
          { key: "margin", label: "利润率", align: "right", numeric: true },
          { key: "fleet", label: "车辆数", align: "right", numeric: true },
          { key: "status", label: "状态" },
        ],
        rows,
      },
      {
        type: "conclusion",
        title: "AI 结论与建议",
        items: [
          `月利润较高的是「${sorted[0].name}」，${formatEngineMoney(sorted[0].metrics?.monthlyProfit)} 元。`,
          `月利润较低的是「${sorted[sorted.length - 1].name}」，${formatEngineMoney(sorted[sorted.length - 1].metrics?.monthlyProfit)} 元。`,
          "差异来自各方案已保存结果，如需改参数请进入方案后重新测算。",
        ],
      },
    ],
    actions: openActions(project, sorted[0]),
    context: { projectId: project.projectId, schemeId: sorted[0].id },
  };
}

function parseChange(question: string): { variable: string | null; variableName: string; unsupported: string | null; change: number } {
  if (/空驶/.test(question)) {
    return { variable: null, variableName: "空驶率", unsupported: "空驶率", change: 0 };
  }
  if (/利用率/.test(question)) {
    return { variable: null, variableName: "车辆利用率", unsupported: "车辆利用率", change: 0 };
  }
  const spec = VARIABLE_SPECS.find((item) => item.test.test(question));
  const matched = question.match(/([+-]?\d+(?:\.\d+)?)\s*[%％]/);
  let change = matched ? Number(matched[1]) : 10;
  if (!Number.isFinite(change)) change = 10;
  const down = /下降|下跌|降低|减少/.test(question);
  const up = /上涨|上升|提高|增加/.test(question);
  if (down && change > 0) change = -change;
  if (up && change < 0) change = Math.abs(change);
  if (!down && !up && !matched) change = 10;
  return {
    variable: spec?.code || null,
    variableName: spec?.name || "",
    unsupported: null,
    change,
  };
}

function closestPoint(points: SensitivityPoint[], change: number): SensitivityPoint | undefined {
  return [...points].sort(
    (a, b) => Math.abs(Number(a.parameterChange) - change) - Math.abs(Number(b.parameterChange) - change),
  )[0];
}

function buildSensitivity(
  question: string,
  projects: CenterProject[],
  runSensitivity: SensitivityRunner | undefined,
  focusProjectId?: string,
): AIResponse {
  const parsed = parseChange(question);
  if (parsed.unsupported) {
    return {
      intent: "SENSITIVITY_ANALYSIS",
      message: `当前测算引擎没有「${parsed.unsupported}」这个敏感性变量，所以我不会编造利润变化。`,
      blocks: [
        {
          type: "text",
          text: `可以直接重算的变量是：${SUPPORTED_VARIABLES}。例如「电价上涨10%」或「货量下降15%」。`,
        },
      ],
      actions: [{ id: "elec", label: "看电价 +10%", kind: "ask", ask: "如果电价上涨10%，利润会怎么样？" }],
    };
  }
  if (!parsed.variable) {
    return {
      intent: "SENSITIVITY_ANALYSIS",
      message: `请说明要变动的参数。当前支持：${SUPPORTED_VARIABLES}。`,
      blocks: [],
      actions: [],
    };
  }
  const matched = matchProjects(question, projects);
  const project = matched[0] || projects.find((item) => item.projectId === focusProjectId) || projects.find((item) => latestScenario(item)?.inputs);
  const scenario = project ? latestScenario(project) : null;
  if (!project || !scenario?.metrics || !scenario.inputs) {
    return {
      intent: "SENSITIVITY_ANALYSIS",
      message: "没有找到带测算输入的项目，无法调用引擎做敏感性分析。",
      blocks: [],
      actions: [{ id: "list", label: "进入传统测算", kind: "navigate", href: "view:list" }],
    };
  }
  if (!runSensitivity) {
    return {
      intent: "SENSITIVITY_ANALYSIS",
      message: "测算引擎的敏感性接口不可用，已停止分析，避免用不实数字回答。",
      blocks: [],
      actions: [{ id: "continue", label: "继续测算", kind: "navigate", href: `/projects/${project.projectId}/calculation/${scenario.id}` }],
      context: { projectId: project.projectId, schemeId: scenario.id },
    };
  }

  let points: SensitivityPoint[] = [];
  try {
    points = runSensitivity({
      input: scenario.inputs,
      variable: parsed.variable,
      changeMode: "PERCENT",
      minChange: String(Math.min(-20, parsed.change)),
      maxChange: String(Math.max(20, parsed.change)),
      step: "5",
    });
  } catch (err) {
    return {
      intent: "SENSITIVITY_ANALYSIS",
      message: `测算引擎未能完成敏感性分析：${err instanceof Error ? err.message : "未知错误"}。原方案结果未改动。`,
      blocks: [],
      actions: openActions(project, scenario),
      context: { projectId: project.projectId, schemeId: scenario.id },
    };
  }

  const next = closestPoint(points, parsed.change);
  if (!next) {
    return {
      intent: "SENSITIVITY_ANALYSIS",
      message: "引擎没有返回敏感性结果，本次不展示推测数字。",
      blocks: [],
      actions: openActions(project, scenario),
      context: { projectId: project.projectId, schemeId: scenario.id },
    };
  }

  const beforeProfit = num(scenario.metrics.monthlyProfit);
  const afterProfit = num(next.monthlyProfit);
  const beforeMargin = num(scenario.metrics.profitMargin);
  const afterMargin = num(next.profitMargin);
  const fleet = scenario.metrics.fleetSize && scenario.metrics.fleetSize > 0 ? scenario.metrics.fleetSize : null;
  const beforePer = fleet && beforeProfit != null ? beforeProfit / fleet : num(scenario.metrics.profitPerVehicle);
  const afterPer = fleet && afterProfit != null ? afterProfit / fleet : null;
  const sign = parsed.change > 0 ? "+" : "";
  const items: CalculationCompareItem[] = [
    {
      label: "月利润",
      before: formatEngineMoney(beforeProfit),
      after: formatEngineMoney(afterProfit),
      delta: moneyDelta(beforeProfit, afterProfit),
      afterRaw: afterProfit,
      deltaRaw: beforeProfit != null && afterProfit != null ? afterProfit - beforeProfit : null,
    },
    {
      label: "利润率",
      before: formatEnginePercent(beforeMargin),
      after: formatEnginePercent(afterMargin),
      delta: percentDelta(beforeMargin, afterMargin),
      afterRaw: afterMargin,
      deltaRaw: beforeMargin != null && afterMargin != null ? afterMargin - beforeMargin : null,
    },
    {
      label: "单车月利润",
      before: formatEngineMoney(beforePer),
      after: formatEngineMoney(afterPer),
      delta: moneyDelta(beforePer, afterPer),
      afterRaw: afterPer,
      deltaRaw: beforePer != null && afterPer != null ? afterPer - beforePer : null,
    },
  ];
  const highlightIndex = Math.max(0, points.findIndex((point) => point === next));
  return {
    intent: "SENSITIVITY_ANALYSIS",
    message: `已用测算引擎重算「${project.projectName}」在${parsed.variableName} ${sign}${parsed.change}% 时的结果。解释只针对这次重算，不替换原方案。`,
    blocks: [
      {
        type: "calculation",
        title: "原方案 vs 敏感性重算",
        beforeLabel: scenario.name,
        afterLabel: `${parsed.variableName} ${sign}${parsed.change}%`,
        items,
      },
      {
        type: "chart",
        chartType: "sensitivity",
        title: `${parsed.variableName}变化对月利润的影响`,
        categories: points.map((point) => `${Number(point.parameterChange) > 0 ? "+" : ""}${point.parameterChange}%`),
        series: [{ name: "月利润", values: points.map((point) => num(point.monthlyProfit) || 0) }],
        highlightIndex,
        note: "每个点都是 Calculation Engine 的敏感性结果，单位：元。",
      },
      {
        type: "conclusion",
        title: "AI 结论与建议",
        items: [
          `${parsed.variableName}调整 ${sign}${parsed.change}% 后，月利润由 ${formatEngineMoney(beforeProfit)} 元变为 ${formatEngineMoney(afterProfit)} 元（${moneyDelta(beforeProfit, afterProfit)} 元）。`,
          afterProfit != null && afterProfit < 0
            ? "该情景下月利润为负，需要回头看能源或运价假设。"
            : "该情景下月利润仍不为负。若要落成正式方案，请进入项目后另存并重新测算。",
          "单车月利润按该情景月利润除以当前方案车辆数，口径与结果页一致。",
        ],
      },
    ],
    actions: openActions(project, scenario),
    context: { projectId: project.projectId, schemeId: scenario.id },
  };
}

function buildExplain(question: string, projects: CenterProject[], focusProjectId?: string): AIResponse {
  const matched = matchProjects(question, projects);
  const project = matched[0] || projects.find((item) => item.projectId === focusProjectId) || projects.find((item) => latestScenario(item)?.metrics);
  const scenario = project ? latestScenario(project) : null;
  if (!project || !scenario?.metrics) {
    return {
      intent: "CALCULATION_EXPLAIN",
      message: "还没有可解释的测算结果。请先完成一次测算。",
      blocks: [],
      actions: [{ id: "create", label: "新建测算", kind: "ask", ask: "帮我测算一个新的运输项目" }],
    };
  }
  const metrics = scenario.metrics;
  const parts = [
    { name: "固定成本", value: num(metrics.monthlyFixedCost) || 0 },
    { name: "变动成本", value: num(metrics.monthlyVariableCost) || 0 },
    { name: "财务成本", value: num(metrics.monthlyFinanceCost) || 0 },
    { name: "税费", value: num(metrics.monthlyTaxCost) || 0 },
  ].filter((part) => part.value > 0);
  const largest = [...parts].sort((a, b) => b.value - a.value)[0];
  const pie = costPie(project, scenario);
  const blocks: AIBlock[] = [];
  if (pie) blocks.push(pie);
  blocks.push({
    type: "table",
    title: scenario.name,
    columns: PROJECT_COLUMNS,
    rows: projectRows([project]),
  });
  blocks.push({
    type: "conclusion",
    title: "AI 结论与建议",
    items: [
      `「${project.projectName} / ${scenario.name}」月收入 ${formatEngineMoney(metrics.monthlyRevenue)} 元，月成本 ${formatEngineMoney(metrics.monthlyTotalCost)} 元，月利润 ${formatEngineMoney(metrics.monthlyProfit)} 元，利润率 ${formatEnginePercent(metrics.profitMargin)}。`,
      largest ? `已保存成本里金额最大的是${largest.name}，${formatEngineMoney(largest.value)} 元。` : "当前结果没有可拆开的成本分项。",
      metrics.fleetSize != null ? `该方案车辆数 ${metrics.fleetSize} 台，单车月利润 ${formatEngineMoney(metrics.profitPerVehicle)} 元。` : "车辆数未写入结果快照。",
    ],
  });
  return {
    intent: "CALCULATION_EXPLAIN",
    message: `下面只解释「${project.projectName}」已经算出来的结果。`,
    blocks,
    actions: openActions(project, scenario),
    context: { projectId: project.projectId, schemeId: scenario.id },
  };
}

function buildRisk(projects: CenterProject[]): AIResponse {
  if (!projects.length) return emptyProjects("RISK_ANALYSIS");
  const items = riskItems(projects);
  const ranked = [...projects]
    .map((project) => ({ project, scenario: latestScenario(project) }))
    .filter((row): row is { project: CenterProject; scenario: CenterScenario } => Boolean(row.scenario?.metrics))
    .sort((a, b) => (num(a.scenario.metrics?.monthlyProfit) || 0) - (num(b.scenario.metrics?.monthlyProfit) || 0));
  const blocks: AIBlock[] = [];
  if (ranked.length) {
    blocks.push({
      type: "chart",
      chartType: "horizontalBar",
      title: "按月利润从低到高",
      categories: ranked.map((row) => shortName(row.project.projectName)),
      series: [{ name: "月利润", values: ranked.map((row) => num(row.scenario.metrics?.monthlyProfit) || 0) }],
      note: "只按已保存月利润排序，不另设风险评分。单位：元。",
    });
  }
  blocks.push({ type: "table", title: "项目测算结果", columns: PROJECT_COLUMNS, rows: projectRows(projects) });
  if (items.length) blocks.push({ type: "risk", data: items });
  blocks.push({
    type: "conclusion",
    title: "AI 结论与建议",
    items: items.length
      ? items.slice(0, 3).map((item) => `${item.name}：${item.evidence}`)
      : ["按月利润和待完善状态，当前没有需要单独标出的风险项目。"],
  });
  const first = ranked[0];
  return {
    intent: "RISK_ANALYSIS",
    message: "风险判断只依据已保存的月利润、利润率和方案是否已测算，没有额外打分模型。",
    blocks,
    actions: openActions(first?.project, first?.scenario),
    context: first ? { projectId: first.project.projectId, schemeId: first.scenario.id } : undefined,
  };
}

function buildReport(projects: CenterProject[]): AIResponse {
  const analysis = buildAnalysis(projects);
  return {
    ...analysis,
    intent: "GENERATE_REPORT",
    message: "本月项目经营分析报告已按当前测算结果生成。导出文件使用同一套数字。",
    blocks: [
      { type: "text", text: "报告范围：当前可见测算项目的最新方案。以下为正文。" },
      ...analysis.blocks,
    ],
  };
}

function buildCreate(): AIResponse {
  return {
    intent: "CREATE_CALCULATION",
    message: "可以。不必一次填完所有字段，先选一种方式收集关键条件。",
    blocks: [
      {
        type: "text",
        text: "① 上传项目资料，我按现有解析流程识别参数。② 手动告诉我关键条件。③ 从已有项目复制方案后再改。确认前不会写入测算结果。",
      },
    ],
    actions: [
      { id: "upload", label: "上传资料", kind: "import" },
      { id: "manual", label: "手动输入", kind: "navigate", href: "/calculation/manual" },
      { id: "copy", label: "复制已有项目", kind: "picker", picker: "copy" },
    ],
  };
}

export function buildCenterResponse(params: {
  question: string;
  projects: CenterProject[];
  intent?: AIResponse["intent"];
  runSensitivity?: SensitivityRunner;
  focusProjectId?: string;
}): AIResponse {
  const intent = params.intent || detectIntentFromQuestion(params.question);
  switch (intent) {
    case "PROJECT_ANALYSIS":
      return buildAnalysis(params.projects);
    case "PROJECT_COMPARE":
      return buildCompare(params.question, params.projects);
    case "SCHEME_COMPARE":
      return buildSchemeCompare(params.question, params.projects, params.focusProjectId);
    case "RISK_ANALYSIS":
      return buildRisk(params.projects);
    case "SENSITIVITY_ANALYSIS":
      return buildSensitivity(params.question, params.projects, params.runSensitivity, params.focusProjectId);
    case "CALCULATION_EXPLAIN":
      return buildExplain(params.question, params.projects, params.focusProjectId);
    case "GENERATE_REPORT":
      return buildReport(params.projects);
    case "CREATE_CALCULATION":
      return buildCreate();
    case "IMPORT_CALCULATION":
      return {
        intent,
        message: "把 Excel、PDF、Word 或图片发过来。我会先识别参数，确认后才调用测算引擎。",
        blocks: [],
        actions: [
          { id: "upload", label: "上传资料", kind: "import" },
          { id: "sample", label: "使用演示资料", kind: "ask", ask: "请用演示资料识别项目参数" },
        ],
      };
    default:
      return {
        intent: "GENERAL_CHAT",
        message: "我可以帮你新建测算、看经营结果、对比项目、做敏感性和解释已算出的数字。直接点右侧问题，或说你想分析的项目。",
        blocks: [
          {
            type: "text",
            text: "财务数字只来自测算引擎和已保存结果。如果只是闲聊，我不会生成收入或利润。",
          },
        ],
        actions: [
          { id: "analysis", label: "看经营情况", kind: "ask", ask: "分析最近的测算项目经营情况" },
          { id: "create", label: "新建测算", kind: "ask", ask: "帮我测算一个新的运输项目" },
        ],
      };
  }
}

function detectIntentFromQuestion(question: string): AIResponse["intent"] {
  if (/演示资料识别|用演示资料/.test(question)) return "IMPORT_CALCULATION";
  return detectIntent(question);
}

export function buildImportPreview(fileName: string, parameters: ImportParamView[]): AIResponse {
  const recognized = parameters.filter((item) => item.value != null && item.value !== "" && item.status !== "MISSING");
  const pending = parameters.filter((item) => item.status === "MISSING" || item.status === "CONFLICT" || item.status === "NEED_CONFIRMATION" || item.status === "INFERRED");
  const rows: TableRow[] = parameters.slice(0, 24).map((item) => ({
    project: item.group || "参数",
    scheme: item.label,
    revenue: item.value == null || item.value === "" ? "—" : `${item.value}${item.unit ? ` ${item.unit}` : ""}`,
    status: statusLabel(item.status),
  }));
  return {
    intent: "IMPORT_CALCULATION",
    message: `已上传：${fileName}`,
    blocks: [
      { type: "text", text: `AI 已识别 ${recognized.length} 个项目参数。未确认项不会直接参与测算。` },
      {
        type: "table",
        title: "识别结果",
        columns: [
          { key: "project", label: "分组" },
          { key: "scheme", label: "参数" },
          { key: "revenue", label: "识别值" },
          { key: "status", label: "状态" },
        ],
        rows,
      },
      {
        type: "conclusion",
        title: "需要你确认",
        items: pending.length
          ? pending.slice(0, 6).map((item) => `${item.label}${item.value != null && item.value !== "" ? `：${item.value}${item.unit ? ` ${item.unit}` : ""}` : "：资料中没有可靠取值"}`)
          : ["必填参数已齐。确认后将调用测算引擎生成结果，不会在对话里手算利润。"],
      },
    ],
    actions: [
      { id: "confirm", label: "确认并开始测算", kind: "import-confirm" },
      { id: "edit", label: "修改参数", kind: "import-edit" },
    ],
  };
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    EXTRACTED: "已识别",
    MISSING: "待确认",
    CONFLICT: "冲突",
    NEED_CONFIRMATION: "待确认",
    INFERRED: "推断待确认",
    CONFIRMED: "已确认",
    MANUAL: "手工",
  };
  return map[status] || status;
}
