import type { AssistantParamKey, ParamPatch } from "./params";
import { FIELD_META } from "./params";

export type AssistantIntentKind =
  | "query"
  | "diagnose"
  | "modify"
  | "create_scenario"
  | "compare"
  | "sensitivity"
  | "advice"
  | "report"
  | "confirm"
  | "cancel"
  | "unmatched";

export type QueryTarget =
  | "monthlyProfit"
  | "monthlyRevenue"
  | "monthlyTotalCost"
  | "profitMargin"
  | "irr"
  | "fleetSize"
  | "topCost"
  | "scenarioCount"
  | "params"
  | "general";

export type AssistantIntent = {
  kind: AssistantIntentKind;
  title: string;
  queryTarget?: QueryTarget;
  patches: ParamPatch[];
  scenarioName?: string;
  compareHint?: "last_two" | "baseline_peer" | "named";
  namedScenarioHints?: string[];
  parser: "rule";
};

function compact(q: string) {
  return q.replace(/\s+/g, "");
}

function numMatch(q: string, patterns: RegExp[]): number | null {
  for (const re of patterns) {
    const m = q.match(re);
    if (m) {
      const n = Number(m[1]);
      if (Number.isFinite(n)) return n;
    }
  }
  return null;
}

function patch(
  field: AssistantParamKey,
  operation: ParamPatch["operation"],
  value: number,
): ParamPatch {
  const meta = FIELD_META[field];
  return { field, label: meta.label, operation, value, unit: meta.unit };
}

/** 规则意图识别：优先确定性业务映射，不依赖 LLM 算数 */
export function parseAssistantIntent(question: string): AssistantIntent {
  const raw = question.trim();
  const q = compact(raw);

  if (!q) {
    return { kind: "unmatched", title: "空问题", patches: [], parser: "rule" };
  }

  if (/^(确认|确认并测算|应用并测算|好的|执行|同意)$/.test(q) || /确认并.*测算/.test(q)) {
    return { kind: "confirm", title: "确认修改并测算", patches: [], parser: "rule" };
  }
  if (/^(取消|不要|算了|放弃)$/.test(q)) {
    return { kind: "cancel", title: "取消修改", patches: [], parser: "rule" };
  }

  if (/汇报|给领导|经营结论|汇报结论|项目结论/.test(q)) {
    return { kind: "report", title: "生成汇报结论", patches: [], parser: "rule" };
  }

  if (/为什么.*利润|利润.*低|利润.*不高|利润比较低|成本结构|有什么风险|项目风险|诊断|分析一下.*项目|分析.*为什么|项目情况怎么样|参数.*异常|检查.*参数/.test(q)) {
    return { kind: "diagnose", title: "业务诊断", patches: [], parser: "rule" };
  }

  if (/(比较|对比).*(方案|指标)|两个方案|方案差异|有什么区别|哪个更好|指标变化/.test(q) || /帮我比较/.test(q)) {
    return {
      kind: "compare",
      title: "方案对比",
      patches: [],
      compareHint: /刚才|两个方案|刚创建/.test(q) ? "last_two" : "baseline_peer",
      parser: "rule",
    };
  }

  if (/最影响|敏感性|哪个参数|参数.*敏感|敏感分析/.test(q)) {
    return { kind: "sensitivity", title: "敏感性解释", patches: [], parser: "rule" };
  }

  if (/经营建议|怎么优化|优化方向|怎么改善/.test(q)) {
    return { kind: "advice", title: "经营建议", patches: [], parser: "rule" };
  }

  // 创建方案（可带参数变更）
  const createName =
    (raw.match(/做[一个]?(?:个)?(.+?)方案/) || raw.match(/创建(.+?)方案/) || raw.match(/低电价方案/))?.[1];
  const isCreate = /做[一个]?|创建|新建|生成.+方案|低电价方案/.test(q) && /方案/.test(q);

  // 参数修改识别
  const patches: ParamPatch[] = [];

  const elecTo = numMatch(q, [
    /电价[^0-9]{0,12}(?:降到|降为|改为|改成|调整为|调到|按照|按)(\d+(?:\.\d+)?)/,
    /电价.*?降到(\d+(?:\.\d+)?)/,
  ]);
  if (elecTo != null && /电价/.test(q)) {
    patches.push(patch("electricityPrice", "set", elecTo));
  } else if (/电价/.test(q) && /下降|降低|降了|降电价/.test(q) && !/降到|降为|改为|改成/.test(q)) {
    const drop = numMatch(q, [/下降(\d+(?:\.\d+)?)元?/, /降低(\d+(?:\.\d+)?)元?/, /降(?:了)?(\d+(?:\.\d+)?)元?/]) ?? 0.1;
    patches.push(patch("electricityPrice", "add", -Math.abs(drop)));
  } else if (/电价/.test(q) && /改成|改为|调整为|设为|把电价/.test(q)) {
    const n = numMatch(q, [/(\d+(?:\.\d+)?)/]);
    if (n != null) patches.push(patch("electricityPrice", "set", n));
  } else {
    const elecSet = numMatch(q, [/电价[^0-9]{0,8}(?:为|是|=)(\d+(?:\.\d+)?)/]);
    if (elecSet != null) patches.push(patch("electricityPrice", "set", elecSet));
  }

  const fleetSet = numMatch(q, [/车辆(?:数|配置)?[^0-9]{0,6}(?:改成|改为|调整为|设为)?(\d+)\s*台?/]);
  if (fleetSet != null && /车辆/.test(q) && !/增加|减少|加|少/.test(q)) {
    patches.push(patch("fleetSize", "set", fleetSet));
  }
  const fleetAdd = numMatch(q, [/车辆[^0-9]{0,8}增加(\d+)/, /增加(\d+)\s*台/, /车辆增加(\d+)/]);
  if (fleetAdd != null) patches.push(patch("fleetSize", "add", fleetAdd));
  const fleetSub = numMatch(q, [/车辆[^0-9]{0,8}减少(\d+)/, /减少(\d+)\s*台/, /车辆减少(\d+)/]);
  if (fleetSub != null) patches.push(patch("fleetSize", "add", -fleetSub));

  const freightPct = numMatch(q, [/运价[^0-9]{0,8}(?:下降|下调|降低|降)(\d+(?:\.\d+)?)\s*%/]);
  if (freightPct != null) {
    patches.push(patch("freightPrice", "multiply", 1 - freightPct / 100));
  }
  const freightSet = numMatch(q, [/运价[^0-9]{0,6}(?:改成|改为|调整为)?(\d+(?:\.\d+)?)/]);
  if (freightSet != null && /运价/.test(q) && freightPct == null) {
    patches.push(patch("freightPrice", "set", freightSet));
  }

  const rent = numMatch(q, [/月租[^0-9]{0,6}(?:改成|改为|调整为)?(\d+(?:\.\d+)?)/]);
  if (rent != null) patches.push(patch("monthlyRentPerVehicle", "set", rent));

  if (isCreate || (patches.length && /方案|情景|模拟/.test(q) && /做|创建|新建|生成|帮我/.test(q))) {
    const name =
      createName && createName.length < 20
        ? createName.includes("方案")
          ? createName
          : `${createName}方案`
        : patches.some((p) => p.field === "electricityPrice")
          ? "低电价方案"
          : patches.some((p) => p.field === "fleetSize")
            ? "车辆调整方案"
            : "AI模拟方案";
    return {
      kind: "create_scenario",
      title: `创建${name}`,
      patches,
      scenarioName: name,
      parser: "rule",
    };
  }

  if (patches.length) {
    return {
      kind: "modify",
      title: "修改测算参数",
      patches,
      parser: "rule",
    };
  }

  // 查询类
  if (/几个测算方案|有多少方案|方案数量/.test(q)) {
    return { kind: "query", title: "查询方案数量", queryTarget: "scenarioCount", patches: [], parser: "rule" };
  }
  if (/月利润|一个月能赚|赚多少|利润多少/.test(q)) {
    return { kind: "query", title: "查询月利润", queryTarget: "monthlyProfit", patches: [], parser: "rule" };
  }
  if (/月收入|收入是多少|营收/.test(q)) {
    return { kind: "query", title: "查询月收入", queryTarget: "monthlyRevenue", patches: [], parser: "rule" };
  }
  if (/总成本|成本多少|月成本/.test(q) && !/最大成本|成本结构|最高/.test(q)) {
    return { kind: "query", title: "查询月成本", queryTarget: "monthlyTotalCost", patches: [], parser: "rule" };
  }
  if (/利润率/.test(q)) {
    return { kind: "query", title: "查询利润率", queryTarget: "profitMargin", patches: [], parser: "rule" };
  }
  if (/\bIRR\b|内部收益率|irr/.test(raw) || /IRR|内部收益率/.test(q)) {
    return { kind: "query", title: "查询IRR", queryTarget: "irr", patches: [], parser: "rule" };
  }
  if (/车辆配置|车辆多少|几台车|车辆数/.test(q)) {
    return { kind: "query", title: "查询车辆数", queryTarget: "fleetSize", patches: [], parser: "rule" };
  }
  if (/最大成本|成本最高|哪个成本/.test(q)) {
    return { kind: "query", title: "查询最大成本项", queryTarget: "topCost", patches: [], parser: "rule" };
  }
  if (/核心参数|当前参数|有哪些参数/.test(q)) {
    return { kind: "query", title: "查询核心参数", queryTarget: "params", patches: [], parser: "rule" };
  }
  if (/当前项目|项目情况|怎么样/.test(q)) {
    return { kind: "diagnose", title: "项目概况", patches: [], parser: "rule" };
  }

  return { kind: "unmatched", title: "未识别", patches: [], parser: "rule" };
}
