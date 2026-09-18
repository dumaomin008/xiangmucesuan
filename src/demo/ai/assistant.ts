import type { DemoRepositories } from "../bootstrap";
import type { DemoCalcScenario, DemoProjectContext } from "../types";
import { analyzeScenarioLocal } from "./analyze";
import { parseAssistantIntent, type AssistantIntent } from "./intent";
import {
  areSegmentValuesEqual,
  countSegments,
  defaultScopeForField,
  describePatches,
  fieldScopeLevel,
  FIELD_META,
  findRouteByHint,
  findSegmentByHint,
  formatScopeLabel,
  listSegmentParamLocations,
  validatePatches,
  type AssistantParamKey,
  type ParamPatch,
  type ParamScope,
} from "./params";
import {
  calculateAndSaveTool,
  compareScenariosTool,
  formatMetricAnswer,
  generateReportTool,
  getCalculationResultTool,
  getParameterScopeTool,
  getProjectContextTool,
  getRoutesTool,
  getScenarioTool,
  getSensitivityAnalysisTool,
  localDiagnoseTool,
  type ScenarioCompareRow,
  type ToolTrace,
  updateScenarioInputTool,
} from "./tools";

export type AssistantPageContext = "project" | "input" | "results" | "compare";

export type PendingAssistantAction = {
  type: "modify" | "create_scenario" | "await_scope" | "await_abnormal_confirm";
  patches: ParamPatch[];
  scenarioName?: string;
  baseScenarioId: string;
  projectId: string;
  previewText: string;
  changes: {
    label: string;
    from: string;
    to: string;
    unit: string;
    scope?: ParamScope;
    scopeLabel?: string;
  }[];
  scope?: ParamScope;
  scopeLabel?: string;
  createNewScenario: boolean;
  willRecalculate: boolean;
  warnings?: string[];
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
  source: "local_engine" | "tools" | "llm_intent";
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
    if (a?.results && b?.results && a.projectId === projectId && b.projectId === projectId) return { a, b };
  }

  const baseline = list.find((s) => s.status === "baseline") || list.find((s) => s.id === currentId) || list[0];
  const peer = list.find((s) => s.id !== baseline.id) || list[1];
  if (!baseline || !peer) return null;
  return { a: baseline, b: peer };
}

function applyScopeToPatches(
  patches: ParamPatch[],
  scope: ParamScope,
  ids?: { routeId?: string; segmentId?: string },
): ParamPatch[] {
  return patches.map((p) => {
    if (fieldScopeLevel(p.field) === "vehicle") {
      return { ...p, scope: "vehicle", routeId: undefined, segmentId: undefined };
    }
    return {
      ...p,
      scope,
      routeId: scope === "route" || scope === "segment" ? ids?.routeId : undefined,
      segmentId: scope === "segment" ? ids?.segmentId : undefined,
    };
  });
}

function resolveScopeFromHint(
  scenario: DemoCalcScenario,
  intent: AssistantIntent,
): { ok: true; patches: ParamPatch[] } | { ok: false; reply: string } {
  const patches = intent.patches.map((p) => ({ ...p }));
  const hint = intent.scopeHint;

  const allVehicle = patches.every((p) => fieldScopeLevel(p.field) === "vehicle");
  if (allVehicle) {
    return { ok: true, patches: applyScopeToPatches(patches, "vehicle") };
  }

  const segFields = patches.filter((p) => fieldScopeLevel(p.field) === "segment");
  const segCount = countSegments(scenario.inputs);

  if (hint?.scope === "all_routes") {
    return { ok: true, patches: applyScopeToPatches(patches, "all_routes") };
  }
  if (hint?.scope === "route") {
    const found = hint.routeHint ? findRouteByHint(scenario.inputs, hint.routeHint) : null;
    if (!found) {
      const routes = getRoutesTool(scenario.inputs);
      return {
        ok: false,
        reply: `请指定线路。可选：${routes.routes.map((r) => r.routeName).join("、") || "无"}。可回复「指定线路：线路名」。`,
      };
    }
    return { ok: true, patches: applyScopeToPatches(patches, "route", { routeId: found.id }) };
  }
  if (hint?.scope === "segment") {
    const found = hint.segmentHint ? findSegmentByHint(scenario.inputs, hint.segmentHint) : null;
    if (!found) {
      const segs = getParameterScopeTool(scenario.inputs, segFields[0]?.field || "electricityPrice");
      return {
        ok: false,
        reply: `请指定路段。当前路段：${segs.locations.map((l) => `${l.routeName}/${l.segmentName}`).join("、") || "无"}。`,
      };
    }
    return {
      ok: true,
      patches: applyScopeToPatches(patches, "segment", { routeId: found.routeId, segmentId: found.segmentId }),
    };
  }

  if (segCount <= 1) {
    const locs = listSegmentParamLocations(scenario.inputs, segFields[0]?.field || "electricityPrice");
    const only = locs[0];
    return {
      ok: true,
      patches: applyScopeToPatches(patches, only ? "segment" : "all_routes", {
        routeId: only?.routeId,
        segmentId: only?.segmentId,
      }),
    };
  }

  return { ok: true, patches };
}

function needsScopeClarification(scenario: DemoCalcScenario, patches: ParamPatch[]): boolean {
  const segPatches = patches.filter((p) => fieldScopeLevel(p.field) === "segment");
  if (!segPatches.length) return false;
  if (countSegments(scenario.inputs) <= 1) return false;
  // 已明确 scope（含用户选择的 all_routes）则不再追问
  if (segPatches.every((p) => p.scope === "route" || p.scope === "segment" || p.scope === "all_routes")) {
    return false;
  }
  return segPatches.some((p) => !areSegmentValuesEqual(scenario.inputs, p.field));
}

function fieldLabel(field: AssistantParamKey) {
  return FIELD_META[field].label;
}

function buildScopeClarifyPending(
  type: "modify" | "create_scenario",
  ctx: {
    patches: ParamPatch[];
    scenario: DemoCalcScenario;
    projectId: string;
    scenarioName?: string;
  },
): PendingAssistantAction {
  const field = ctx.patches.find((p) => fieldScopeLevel(p.field) === "segment")?.field || ctx.patches[0].field;
  const locs = listSegmentParamLocations(ctx.scenario.inputs, field);
  const lines = locs.map((l) => `- ${l.routeName}/${l.segmentName}：${l.value ?? "—"}`).join("\n");
  const previewText = [
    `检测到「${fieldLabel(field)}」在各路段取值不一致，不能直接按模糊指令批量修改。`,
    `当前各路段值：\n${lines}`,
    `请选择作用范围后继续：`,
    `1. 全部路段统一修改`,
    `2. 指定线路（回复：指定线路：线路名）`,
    `3. 指定路段（回复：指定路段：路段名）`,
  ].join("\n");

  return {
    type: "await_scope",
    patches: ctx.patches,
    scenarioName: ctx.scenarioName,
    baseScenarioId: ctx.scenario.id,
    projectId: ctx.projectId,
    previewText,
    changes: [],
    createNewScenario: type === "create_scenario",
    willRecalculate: true,
  };
}

function buildPending(
  type: "modify" | "create_scenario",
  ctx: {
    patches: ParamPatch[];
    scenario: DemoCalcScenario;
    projectId: string;
    scenarioName?: string;
    warnings?: string[];
  },
): PendingAssistantAction {
  const updated = updateScenarioInputTool(ctx.scenario.inputs, ctx.patches);
  const scope = ctx.patches[0]?.scope || defaultScopeForField(ctx.patches[0]?.field || "electricityPrice");
  const scopeLabel = ctx.patches[0] ? formatScopeLabel(ctx.scenario.inputs, ctx.patches[0]) : "项目/车辆级";
  const changeLines = updated.changes
    .map((c) => `${c.label}：${c.from} → ${c.to}${c.unit ? ` ${c.unit}` : ""}（${c.scopeLabel}）`)
    .join("；");
  const warnText = ctx.warnings?.length ? `\n注意：${ctx.warnings.join("；")}` : "";
  const previewText =
    type === "create_scenario"
      ? `将基于「${ctx.scenario.name}」创建「${ctx.scenarioName || "AI模拟方案"}」，并应用：${changeLines || "无参数变更"}。作用范围：${scopeLabel}。确认后将调用 Calculation Engine 重新测算。是否确认？${warnText}`
      : `已识别参数调整：${changeLines}。作用范围：${scopeLabel}。确认后将更新当前方案并调用 Calculation Engine 重新测算。是否确认？${warnText}`;

  return {
    type,
    patches: ctx.patches,
    scenarioName: ctx.scenarioName,
    baseScenarioId: ctx.scenario.id,
    projectId: ctx.projectId,
    previewText,
    changes: updated.changes.map((c) => ({
      label: c.label,
      from: c.from,
      to: c.to,
      unit: c.unit,
      scope: c.scope,
      scopeLabel: c.scopeLabel,
    })),
    scope,
    scopeLabel,
    createNewScenario: type === "create_scenario",
    willRecalculate: true,
    warnings: ctx.warnings,
  };
}

function isolationFailure(session: AssistantSession, intent: AssistantIntent, traces: ToolTrace[]): AssistantTurnResult {
  return {
    reply: "当前方案不属于打开的项目，已拒绝写操作，避免跨项目串改。",
    intent,
    pending: null,
    session: { ...session, pending: null },
    traces,
    source: "tools",
    confirmRequired: false,
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

  if (base.scenario.projectId !== pending.projectId) {
    return isolationFailure(session, { kind: "modify", title: "隔离拒绝", patches: [], parser: "rule" }, traces);
  }

  const validation = validatePatches(base.scenario.inputs, pending.patches);
  if (validation.errors.length) {
    session.pending = null;
    return {
      reply: `参数非法，已拦截，未修改方案、未调用引擎：${validation.errors.map((e) => e.message).join("；")}`,
      intent: { kind: "modify", title: "校验失败", patches: pending.patches, parser: "rule" },
      pending: null,
      session,
      traces,
      source: "tools",
      confirmRequired: false,
    };
  }

  const updated = updateScenarioInputTool(base.scenario.inputs, pending.patches);
  traces.push(updated.trace);

  const createNew = pending.type === "create_scenario" || pending.createNewScenario;
  const name = createNew ? pending.scenarioName || "AI模拟方案" : base.scenario.name;

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

  const changeLines = pending.changes
    .map((c) => `${c.label}：${c.from} → ${c.to}${c.unit ? ` ${c.unit}` : ""}${c.scopeLabel ? `（${c.scopeLabel}）` : ""}`)
    .join("\n");
  const reply = [
    createNew
      ? `已创建方案「${calc.scenario.name}」（${calc.scenario.id}）并完成真实测算。`
      : `已应用参数并调用 Calculation Engine 重新测算。`,
    changeLines ? `变更：\n${changeLines}` : "",
    pending.scopeLabel ? `作用范围：${pending.scopeLabel}` : "",
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

function prepareModifyOrCreate(
  intent: AssistantIntent,
  scenario: DemoCalcScenario,
  projectId: string,
  session: AssistantSession,
  traces: ToolTrace[],
  source: AssistantTurnResult["source"],
): AssistantTurnResult {
  const type = intent.kind === "create_scenario" ? "create_scenario" : "modify";

  if (!intent.patches.length && type === "create_scenario") {
    const pending = buildPending("create_scenario", {
      patches: [],
      scenario,
      projectId,
      scenarioName: intent.scenarioName,
    });
    session.pending = pending;
    return { reply: pending.previewText, intent, pending, session, traces, source, confirmRequired: true };
  }

  if (!intent.patches.length) {
    return {
      reply: "已识别到修改意图，但未解析出具体参数值。请例如：「把电价改成0.65元」。",
      intent,
      pending: null,
      session,
      traces,
      source,
      confirmRequired: false,
    };
  }

  const scoped = resolveScopeFromHint(scenario, intent);
  if (!scoped.ok) {
    return { reply: scoped.reply, intent, pending: null, session, traces, source, confirmRequired: false };
  }

  let patches = scoped.patches;

  if (needsScopeClarification(scenario, patches)) {
    const pending = buildScopeClarifyPending(type, {
      patches,
      scenario,
      projectId,
      scenarioName: intent.scenarioName,
    });
    session.pending = pending;
    return { reply: pending.previewText, intent, pending, session, traces, source, confirmRequired: true };
  }

  patches = patches.map((p) => {
    if (fieldScopeLevel(p.field) === "vehicle") return { ...p, scope: "vehicle" as const };
    if (!p.scope) return { ...p, scope: "all_routes" as const };
    return p;
  });

  const validation = validatePatches(scenario.inputs, patches);
  if (validation.errors.length) {
    return {
      reply: `参数非法，已拦截，不会写入方案也不会调用引擎：${validation.errors.map((e) => e.message).join("；")}`,
      intent,
      pending: null,
      session,
      traces,
      source,
      confirmRequired: false,
    };
  }

  if (validation.warnings.length) {
    const pending = buildPending(type, {
      patches,
      scenario,
      projectId,
      scenarioName: intent.scenarioName,
      warnings: validation.warnings.map((w) => w.message),
    });
    pending.type = "await_abnormal_confirm";
    pending.previewText = `${validation.warnings.map((w) => w.message).join("；")}。\n${pending.previewText}\n回复「确认」继续，或「取消」放弃。`;
    session.pending = pending;
    return { reply: pending.previewText, intent, pending, session, traces, source, confirmRequired: true };
  }

  const pending = buildPending(type, {
    patches,
    scenario,
    projectId,
    scenarioName: intent.scenarioName,
  });
  session.pending = pending;
  return { reply: pending.previewText, intent, pending, session, traces, source, confirmRequired: true };
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
  /** 可选：LLM 已校验的结构化意图，优先于规则解析 */
  parsedIntent?: AssistantIntent;
}): AssistantTurnResult {
  const session = params.session
    ? { ...params.session, recentScenarioIds: [...params.session.recentScenarioIds] }
    : createAssistantSession();
  session.pending = params.session?.pending ? { ...params.session.pending } : null;

  const intent = params.parsedIntent || parseAssistantIntent(params.message);
  const traces: ToolTrace[] = [];
  const source: AssistantTurnResult["source"] = params.parsedIntent?.parser === "llm" ? "llm_intent" : "tools";

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
      source,
      confirmRequired: false,
    };
  }

  if (scenario.projectId !== params.projectId) {
    return isolationFailure(session, intent, traces);
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
        source,
        confirmRequired: false,
      };
    }
    if (session.pending.type === "await_scope") {
      return {
        reply: "请先选择作用范围（全部路段 / 指定线路 / 指定路段），再确认测算。",
        intent,
        pending: session.pending,
        session,
        traces,
        source,
        confirmRequired: true,
      };
    }
    if (session.pending.type === "await_abnormal_confirm") {
      session.pending = {
        ...session.pending,
        type: session.pending.createNewScenario ? "create_scenario" : "modify",
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
      source,
      confirmRequired: false,
    };
  }

  if (intent.kind === "scope_choice" && session.pending?.type === "await_scope") {
    const basePending = session.pending;
    let patches = basePending.patches;
    if (intent.scopeChoice?.mode === "all_routes") {
      patches = applyScopeToPatches(patches, "all_routes");
    } else if (intent.scopeChoice?.mode === "route") {
      const hint = intent.scopeChoice.routeHint || params.message;
      const found = findRouteByHint(scenario.inputs, hint);
      if (!found) {
        const routes = getRoutesTool(scenario.inputs);
        return {
          reply: `未匹配到线路。可选：${routes.routes.map((r) => r.routeName).join("、")}。请回复「指定线路：线路名」。`,
          intent,
          pending: session.pending,
          session,
          traces,
          source,
          confirmRequired: true,
        };
      }
      patches = applyScopeToPatches(patches, "route", { routeId: found.id });
    } else if (intent.scopeChoice?.mode === "segment") {
      const hint = intent.scopeChoice.segmentHint || params.message;
      const found = findSegmentByHint(scenario.inputs, hint);
      if (!found) {
        return {
          reply: "未匹配到路段。请回复「指定路段：路段名」。",
          intent,
          pending: session.pending,
          session,
          traces,
          source,
          confirmRequired: true,
        };
      }
      patches = applyScopeToPatches(patches, "segment", {
        routeId: found.routeId,
        segmentId: found.segmentId,
      });
    }

    const nextIntent: AssistantIntent = {
      kind: basePending.createNewScenario ? "create_scenario" : "modify",
      title: "已明确作用范围",
      patches,
      scenarioName: basePending.scenarioName,
      parser: intent.parser,
    };
    return prepareModifyOrCreate(nextIntent, scenario, params.projectId, session, traces, source);
  }

  if (intent.kind === "modify" || intent.kind === "create_scenario") {
    return prepareModifyOrCreate(intent, scenario, params.projectId, session, traces, source);
  }

  if (intent.kind === "query") {
    getCalculationResultTool(scenario);
    const count = params.repos.scenarios.listScenarios(params.projectId).length;
    const reply = formatMetricAnswer(scenario, intent.queryTarget || "general", count);
    return { reply, intent, pending: session.pending, session, traces, source, confirmRequired: false };
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
        source,
        confirmRequired: false,
      };
    }
    const cmp = compareScenariosTool(pair.a, pair.b);
    traces.push(cmp.trace);
    return {
      reply:
        cmp.summary +
        (cmp.rows.length
          ? `\n\n${cmp.rows.map((r) => `${r.label}：${r.a} → ${r.b}（Δ ${r.delta}，变化率 ${r.changeRate}）`).join("\n")}`
          : ""),
      intent,
      pending: session.pending,
      session,
      compareRows: cmp.rows,
      traces,
      source,
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
      source,
      confirmRequired: false,
    };
  }

  if (intent.kind === "report") {
    const report = generateReportTool({ project, scenario });
    traces.push(report.trace);
    return { reply: report.text, intent, pending: session.pending, session, traces, source, confirmRequired: false };
  }

  if (intent.kind === "advice" || intent.kind === "diagnose") {
    const diag = localDiagnoseTool({ scenario, project, question: params.message });
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
  if (params.session.pending.type === "await_scope") {
    return {
      reply: "请先选择作用范围后再确认。",
      intent: { kind: "confirm", title: "待选范围", patches: [], parser: "rule" },
      pending: params.session.pending,
      session: params.session,
      traces: [],
      source: "tools",
      confirmRequired: true,
    };
  }
  const pending =
    params.session.pending.type === "await_abnormal_confirm"
      ? {
          ...params.session.pending,
          type: (params.session.pending.createNewScenario ? "create_scenario" : "modify") as PendingAssistantAction["type"],
        }
      : params.session.pending;
  return executePending(params.repos, pending, {
    ...params.session,
    recentScenarioIds: [...params.session.recentScenarioIds],
  });
}

export function describePendingPatches(patches: ParamPatch[], scenario: DemoCalcScenario) {
  return describePatches(patches, scenario.inputs);
}
