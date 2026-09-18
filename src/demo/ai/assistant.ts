import type { DemoRepositories } from "../bootstrap";
import type { DemoCalcScenario, DemoProjectContext } from "../types";
import { analyzeScenarioLocal } from "./analyze";
import { parseAssistantIntent, type AssistantIntent } from "./intent";
import { describePatches, type ParamPatch } from "./params";
import {
  calculateAndSaveTool,
  compareScenariosTool,
  formatMetricAnswer,
  generateReportTool,
  getCalculationResultTool,
  getProjectContextTool,
  getScenarioTool,
  getSensitivityAnalysisTool,
  localDiagnoseTool,
  type ScenarioCompareRow,
  type ToolTrace,
  updateScenarioInputTool,
} from "./tools";

export type AssistantPageContext = "project" | "input" | "results" | "compare";

export type PendingAssistantAction = {
  type: "modify" | "create_scenario";
  patches: ParamPatch[];
  scenarioName?: string;
  baseScenarioId: string;
  projectId: string;
  previewText: string;
  changes: { label: string; from: string; to: string; unit: string }[];
};

export type AssistantSession = {
  recentScenarioIds: string[];
  pending: PendingAssistantAction | null;
};

export type AssistantMessage = {
  role: "user" | "assistant" | "system";
  content: string;
  at: string;
};

export type AssistantTurnResult = {
  reply: string;
  intent: AssistantIntent;
  pending: PendingAssistantAction | null;
  session: AssistantSession;
  compareRows?: ScenarioCompareRow[];
  scenarioId?: string;
  refreshedScenarioIds?: string[];
  traces: ToolTrace[];
  source: "local_engine" | "tools";
  confirmRequired: boolean;
};

export const ASSISTANT_SHORTCUTS: Record<AssistantPageContext, string[]> = {
  project: ["当前项目情况怎么样？", "当前项目有哪些核心参数？", "这个项目有什么风险？"],
  input: ["哪些参数最影响利润？", "当前参数是否存在明显异常？", "帮我检查一下测算参数。"],
  results: [
    "为什么这个项目利润这么低？",
    "帮我分析成本结构。",
    "哪些参数最影响利润？",
    "帮我找出项目风险。",
    "如果电价下降0.1元会怎么样？",
    "帮我生成项目汇报结论。",
  ],
  compare: ["两个方案有什么区别？", "哪些指标变化最大？", "帮我解释方案差异。"],
};

export function createAssistantSession(): AssistantSession {
  return { recentScenarioIds: [], pending: null };
}

function pushRecent(session: AssistantSession, id: string) {
  session.recentScenarioIds = [id, ...session.recentScenarioIds.filter((x) => x !== id)].slice(0, 6);
}

function resolveComparePair(
  repos: DemoRepositories,
  projectId: string,
  currentId: string,
  session: AssistantSession,
  hint?: AssistantIntent["compareHint"],
): { a: DemoCalcScenario; b: DemoCalcScenario } | null {
  const list = repos.scenarios.listScenarios(projectId).filter((s) => s.results);
  if (list.length < 2) return null;

  if (hint === "last_two" && session.recentScenarioIds.length >= 2) {
    const a = repos.scenarios.getScenario(session.recentScenarioIds[1]);
    const b = repos.scenarios.getScenario(session.recentScenarioIds[0]);
    if (a?.results && b?.results) return { a, b };
  }

  const baseline = list.find((s) => s.status === "baseline") || list.find((s) => s.id === currentId) || list[0];
  const peer = list.find((s) => s.id !== baseline.id) || list[1];
  if (!baseline || !peer) return null;
  return { a: baseline, b: peer };
}

function buildPending(
  type: PendingAssistantAction["type"],
  ctx: {
    patches: ParamPatch[];
    scenario: DemoCalcScenario;
    projectId: string;
    scenarioName?: string;
  },
): PendingAssistantAction {
  const updated = updateScenarioInputTool(ctx.scenario.inputs, ctx.patches);
  const previewText =
    type === "create_scenario"
      ? `将基于「${ctx.scenario.name}」创建「${ctx.scenarioName || "AI模拟方案"}」，并应用：${updated.changes
          .map((c) => `${c.label} ${c.from}→${c.to}${c.unit ? c.unit : ""}`)
          .join("；") || "无参数变更"}。是否确认并测算？`
      : `已识别参数调整：${updated.changes.map((c) => `${c.label}：${c.from} → ${c.to}${c.unit ? ` ${c.unit}` : ""}`).join("；")}。是否应用并重新测算？`;

  return {
    type,
    patches: ctx.patches,
    scenarioName: ctx.scenarioName,
    baseScenarioId: ctx.scenario.id,
    projectId: ctx.projectId,
    previewText,
    changes: updated.changes,
  };
}

function executePending(
  repos: DemoRepositories,
  pending: PendingAssistantAction,
  session: AssistantSession,
): AssistantTurnResult {
  const traces: ToolTrace[] = [];
  const base = getScenarioTool(repos, pending.baseScenarioId);
  traces.push(base.trace);
  if (!base.scenario) {
    return {
      reply: "原方案不存在，无法执行。",
      intent: { kind: "unmatched", title: "失败", patches: [], parser: "rule" },
      pending: null,
      session: { ...session, pending: null },
      traces,
      source: "tools",
      confirmRequired: false,
    };
  }

  const updated = updateScenarioInputTool(base.scenario.inputs, pending.patches);
  traces.push(updated.trace);

  const createNew = pending.type === "create_scenario";
  const name =
    pending.type === "create_scenario"
      ? pending.scenarioName || "AI模拟方案"
      : base.scenario.name;

  const calc = calculateAndSaveTool(repos, {
    scenarioId: createNew ? undefined : base.scenario.id,
    projectId: pending.projectId,
    name,
    inputs: updated.inputs,
    status: createNew ? "calculated" : base.scenario.status === "baseline" ? "baseline" : "calculated",
    notes: createNew ? `AI助手创建：基于 ${base.scenario.id}` : base.scenario.notes,
    createNew,
  });
  traces.push(calc.trace);
  pushRecent(session, calc.scenario.id);
  if (createNew) pushRecent(session, base.scenario.id);

  const before = base.scenario.results?.metrics;
  const after = calc.scenario.results?.metrics;
  const profitBefore = before ? Number(before.monthlyProfit) : null;
  const profitAfter = after ? Number(after.monthlyProfit) : Number(calc.liveProfit);
  const delta =
    profitBefore != null && Number.isFinite(profitBefore)
      ? (profitAfter - profitBefore).toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : "—";

  const changeLines = pending.changes.map((c) => `${c.label}：${c.from} → ${c.to}${c.unit ? ` ${c.unit}` : ""}`).join("\n");
  const reply = [
    createNew ? `已创建方案「${calc.scenario.name}」（${calc.scenario.id}）并完成真实测算。` : `已应用参数并调用 Calculation Engine 重新测算。`,
    changeLines ? `变更：\n${changeLines}` : "",
    after
      ? `新结果：月收入 ${Number(after.monthlyRevenue).toLocaleString("zh-CN", { minimumFractionDigits: 2 })} 元；月成本 ${Number(after.monthlyTotalCost).toLocaleString("zh-CN", { minimumFractionDigits: 2 })} 元；月利润 ${Number(after.monthlyProfit).toLocaleString("zh-CN", { minimumFractionDigits: 2 })} 元；利润率 ${
          after.profitMargin == null ? "—" : `${(Number(after.profitMargin) * 100).toFixed(2)}%`
        }。相对原方案月利润变化 ${delta} 元。`
      : `引擎月利润 ${Number(calc.liveProfit).toLocaleString("zh-CN", { minimumFractionDigits: 2 })} 元。`,
    "以上数字均来自计算引擎，AI 未自行计算。",
  ]
    .filter(Boolean)
    .join("\n");

  session.pending = null;
  return {
    reply,
    intent: {
      kind: createNew ? "create_scenario" : "modify",
      title: createNew ? "已创建并测算" : "已修改并测算",
      patches: pending.patches,
      parser: "rule",
    },
    pending: null,
    session,
    scenarioId: calc.scenario.id,
    refreshedScenarioIds: [calc.scenario.id],
    traces,
    source: "tools",
    confirmRequired: false,
  };
}

/**
 * AI 项目测算助手单轮执行。
 * 修改类意图只生成确认卡片；确认后才调用引擎。
 */
export function runAssistantTurn(params: {
  repos: DemoRepositories;
  projectId: string;
  scenarioId: string;
  message: string;
  session?: AssistantSession;
  project?: DemoProjectContext | null;
}): AssistantTurnResult {
  const session = params.session ? { ...params.session, recentScenarioIds: [...params.session.recentScenarioIds] } : createAssistantSession();
  session.pending = params.session?.pending ? { ...params.session.pending } : null;

  const intent = parseAssistantIntent(params.message);
  const traces: ToolTrace[] = [];

  const projectHit = getProjectContextTool(params.repos, params.projectId);
  traces.push(projectHit.trace);
  const project = params.project ?? projectHit.project;

  const scenarioHit = getScenarioTool(params.repos, params.scenarioId);
  traces.push(scenarioHit.trace);
  const scenario = scenarioHit.scenario;

  if (!scenario) {
    return {
      reply: "找不到当前测算方案，请先打开一个方案。",
      intent,
      pending: null,
      session,
      traces,
      source: "tools",
      confirmRequired: false,
    };
  }

  pushRecent(session, scenario.id);

  if (intent.kind === "confirm") {
    if (!session.pending) {
      return {
        reply: "当前没有待确认的参数修改。",
        intent,
        pending: null,
        session,
        traces,
        source: "tools",
        confirmRequired: false,
      };
    }
    return executePending(params.repos, session.pending, session);
  }

  if (intent.kind === "cancel") {
    session.pending = null;
    return {
      reply: "已取消，未修改任何参数，也未调用测算引擎。",
      intent,
      pending: null,
      session,
      traces,
      source: "tools",
      confirmRequired: false,
    };
  }

  if (intent.kind === "modify" || intent.kind === "create_scenario") {
    if (!intent.patches.length && intent.kind === "create_scenario") {
      // 允许无补丁复制创建
      const pending = buildPending("create_scenario", {
        patches: [],
        scenario,
        projectId: params.projectId,
        scenarioName: intent.scenarioName,
      });
      session.pending = pending;
      return {
        reply: pending.previewText,
        intent,
        pending,
        session,
        traces,
        source: "tools",
        confirmRequired: true,
      };
    }
    if (!intent.patches.length) {
      return {
        reply: "已识别到修改意图，但未解析出具体参数值。请例如：「把电价改成0.65元」。",
        intent,
        pending: null,
        session,
        traces,
        source: "tools",
        confirmRequired: false,
      };
    }
    const pending = buildPending(intent.kind === "create_scenario" ? "create_scenario" : "modify", {
      patches: intent.patches,
      scenario,
      projectId: params.projectId,
      scenarioName: intent.scenarioName,
    });
    session.pending = pending;
    return {
      reply: pending.previewText,
      intent,
      pending,
      session,
      traces,
      source: "tools",
      confirmRequired: true,
    };
  }

  if (intent.kind === "query") {
    getCalculationResultTool(scenario);
    const count = params.repos.scenarios.listScenarios(params.projectId).length;
    const reply = formatMetricAnswer(scenario, intent.queryTarget || "general", count);
    return {
      reply,
      intent,
      pending: session.pending,
      session,
      traces,
      source: "tools",
      confirmRequired: false,
    };
  }

  if (intent.kind === "compare") {
    const pair = resolveComparePair(params.repos, params.projectId, scenario.id, session, intent.compareHint);
    if (!pair) {
      return {
        reply: "至少需要两个已测算方案才能对比。可先让助手创建低电价方案后再比较。",
        intent,
        pending: session.pending,
        session,
        traces,
        source: "tools",
        confirmRequired: false,
      };
    }
    const cmp = compareScenariosTool(pair.a, pair.b);
    traces.push(cmp.trace);
    return {
      reply: cmp.summary + (cmp.rows.length ? `\n\n${cmp.rows.map((r) => `${r.label}：${r.a} → ${r.b}（Δ ${r.delta}）`).join("\n")}` : ""),
      intent,
      pending: session.pending,
      session,
      compareRows: cmp.rows,
      traces,
      source: "tools",
      confirmRequired: false,
    };
  }

  if (intent.kind === "sensitivity") {
    const sens = getSensitivityAnalysisTool(scenario.inputs);
    traces.push(sens.trace);
    const lines = sens.items.map((item, i) => `${i + 1}. ${item.name}：${item.evidence}`).join("\n");
    return {
      reply: `${sens.summary}\n${lines}`,
      intent,
      pending: session.pending,
      session,
      traces,
      source: "tools",
      confirmRequired: false,
    };
  }

  if (intent.kind === "report") {
    const report = generateReportTool({ project, scenario });
    traces.push(report.trace);
    return {
      reply: report.text,
      intent,
      pending: session.pending,
      session,
      traces,
      source: "tools",
      confirmRequired: false,
    };
  }

  if (intent.kind === "advice" || intent.kind === "diagnose") {
    const diag = localDiagnoseTool({
      scenario,
      project,
      question: params.message,
    });
    traces.push(diag.trace);
    const insight = diag.insight;
    const adviceExtra =
      intent.kind === "advice"
        ? `\n经营建议：\n${insight.suggestions.map((s) => `· ${s}`).join("\n")}`
        : `\n风险要点：\n${insight.risks
            .slice(0, 4)
            .map((r) => `· [${r.level}] ${r.name}：${r.evidence}`)
            .join("\n")}\n建议：\n${insight.suggestions.map((s) => `· ${s}`).join("\n")}`;
    return {
      reply: `${insight.summary}${adviceExtra}\n\n${insight.disclaimer}`,
      intent,
      pending: session.pending,
      session,
      traces,
      source: "local_engine",
      confirmRequired: false,
    };
  }

  // unmatched：降级到本地解读引擎，保证不白屏
  try {
    const fallback = analyzeScenarioLocal({ scenario, project, question: params.message });
    return {
      reply: `${fallback.summary}\n\n若要改参数，可说：「把电价改成0.65元」或「车辆增加10台」。涉及修改会先请您确认再调用引擎。`,
      intent,
      pending: session.pending,
      session,
      traces,
      source: "local_engine",
      confirmRequired: false,
    };
  } catch {
    return {
      reply: "助手暂时无法理解该问题，但测算功能不受影响。你可以问：月利润、成本结构、改电价、方案对比、汇报结论。",
      intent,
      pending: session.pending,
      session,
      traces,
      source: "local_engine",
      confirmRequired: false,
    };
  }
}

/** 供 UI 直接确认待执行动作 */
export function confirmPendingAction(params: {
  repos: DemoRepositories;
  session: AssistantSession;
}): AssistantTurnResult {
  if (!params.session.pending) {
    return {
      reply: "没有待确认操作。",
      intent: { kind: "confirm", title: "确认", patches: [], parser: "rule" },
      pending: null,
      session: params.session,
      traces: [],
      source: "tools",
      confirmRequired: false,
    };
  }
  return executePending(params.repos, params.session.pending, {
    ...params.session,
    recentScenarioIds: [...params.session.recentScenarioIds],
  });
}

export function describePendingPatches(patches: ParamPatch[], scenario: DemoCalcScenario) {
  return describePatches(patches, scenario.inputs);
}
