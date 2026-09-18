import type { AssistantParamKey, ParamPatch, ParamScope } from "./params";
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
  | "scope_choice"
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

export type ScopeChoice =
  | { mode: "all_routes" }
  | { mode: "route"; routeHint?: string }
  | { mode: "segment"; segmentHint?: string };

export type AssistantIntent = {
  kind: AssistantIntentKind;
  title: string;
  queryTarget?: QueryTarget;
  patches: ParamPatch[];
  scenarioName?: string;
  compareHint?: "last_two" | "baseline_peer" | "named";
  namedScenarioHints?: string[];
  scopeChoice?: ScopeChoice;
  scopeHint?: { scope: ParamScope; routeHint?: string; segmentHint?: string };
  parser: "rule" | "llm";
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

/** 提取带符号数值（支持负数，供校验拦截） */
function signedNumMatch(q: string, patterns: RegExp[]): number | null {
  return numMatch(q, patterns);
}

function patch(
  field: AssistantParamKey,
  operation: ParamPatch["operation"],
  value: number,
  scopeHint?: ParamPatch["scope"],
): ParamPatch {
  const meta = FIELD_META[field];
  return {
    field,
    label: meta.label,
    operation,
    value,
    unit: meta.unit,
    scope: scopeHint,
  };
}

function detectScopeHint(q: string): AssistantIntent["scopeHint"] | undefined {
  if (/全部路段|所有路段|全部线路|所有线路|统一修改|全部修改/.test(q)) {
    return { scope: "all_routes" };
  }
  const routeNamed = q.match(/(?:线路|路线)[「『]?([^」』，,。；;\s]{1,20})/);
  if (routeNamed) return { scope: "route", routeHint: routeNamed[1] };
  const segNamed = q.match(/(?:路段)[「『]?([^」』，,。；;\s]{1,20})/);
  if (segNamed) return { scope: "segment", segmentHint: segNamed[1] };
  if (/指定线路|某一线路|某条线路/.test(q)) return { scope: "route" };
  if (/指定路段|某一路段|某个路段/.test(q)) return { scope: "segment" };
  return undefined;
}

function collectPatches(q: string): ParamPatch[] {
  const patches: ParamPatch[] = [];

  // —— 电价 ——
  const elecPctUp = numMatch(q, [/电价[^0-9\-]{0,8}(?:上涨|上调|提高|增加)(-?\d+(?:\.\d+)?)\s*%/]);
  const elecPctDown = numMatch(q, [/电价[^0-9\-]{0,8}(?:下降|下调|降低|降)(-?\d+(?:\.\d+)?)\s*%/]);
  if (elecPctUp != null) patches.push(patch("electricityPrice", "multiply", 1 + elecPctUp / 100));
  else if (elecPctDown != null) patches.push(patch("electricityPrice", "multiply", 1 - elecPctDown / 100));
  else {
    const elecTo = signedNumMatch(q, [
      /电价[^0-9\-]{0,12}(?:降到|降为|改为|改成|调整为|调到|按照|按|设为)(-?\d+(?:\.\d+)?)/,
      /电价.*?降到(-?\d+(?:\.\d+)?)/,
    ]);
    if (elecTo != null && /电价/.test(q)) {
      patches.push(patch("electricityPrice", "set", elecTo));
    } else if (/电价/.test(q) && /下降|降低|降了|降电价/.test(q) && !/降到|降为|改为|改成/.test(q) && !/%/.test(q)) {
      const drop = signedNumMatch(q, [/下降(-?\d+(?:\.\d+)?)元?/, /降低(-?\d+(?:\.\d+)?)元?/, /降(?:了)?(-?\d+(?:\.\d+)?)元?/]) ?? 0.1;
      patches.push(patch("electricityPrice", "add", -Math.abs(drop)));
    } else if (/电价/.test(q) && /上涨|上调|提高/.test(q) && !/%/.test(q)) {
      const up = signedNumMatch(q, [/上涨(-?\d+(?:\.\d+)?)/, /上调(-?\d+(?:\.\d+)?)/, /提高(-?\d+(?:\.\d+)?)/]);
      if (up != null) patches.push(patch("electricityPrice", "add", Math.abs(up)));
    } else if (/电价/.test(q) && /改成|改为|调整为|设为|把电价/.test(q)) {
      const n = signedNumMatch(q, [/(-?\d+(?:\.\d+)?)/]);
      if (n != null) patches.push(patch("electricityPrice", "set", n));
    } else {
      const elecSet = signedNumMatch(q, [/电价[^0-9\-]{0,8}(?:为|是|=)(-?\d+(?:\.\d+)?)/]);
      if (elecSet != null) patches.push(patch("electricityPrice", "set", elecSet));
    }
  }

  // —— 车辆数 ——
  const fleetSet = numMatch(q, [/车辆(?:数|配置)?[^0-9]{0,6}(?:改成|改为|调整为|设为|调整到)?(\d+)\s*台?/]);
  if (fleetSet != null && /车辆/.test(q) && !/增加|减少|加|少/.test(q)) {
    patches.push(patch("fleetSize", "set", fleetSet));
  }
  const fleetAdd = numMatch(q, [/车辆[^0-9]{0,8}增加(\d+)/, /增加(\d+)\s*台/, /车辆增加(\d+)/]);
  if (fleetAdd != null) patches.push(patch("fleetSize", "add", fleetAdd));
  const fleetSub = numMatch(q, [/车辆[^0-9]{0,8}减少(\d+)/, /减少(\d+)\s*台/, /车辆减少(\d+)/]);
  if (fleetSub != null) patches.push(patch("fleetSize", "add", -fleetSub));

  // —— 运价 ——
  const freightPctDown = numMatch(q, [/运价[^0-9]{0,8}(?:下降|下调|降低|降)(\d+(?:\.\d+)?)\s*%/]);
  const freightPctUp = numMatch(q, [/运价[^0-9]{0,8}(?:上涨|上调|提高|升)(\d+(?:\.\d+)?)\s*%/]);
  if (freightPctDown != null) patches.push(patch("freightPrice", "multiply", 1 - freightPctDown / 100));
  else if (freightPctUp != null) patches.push(patch("freightPrice", "multiply", 1 + freightPctUp / 100));
  else {
    const freightSet = numMatch(q, [/运价[^0-9]{0,8}(?:改成|改为|调整为|调到|设为)?(\d+(?:\.\d+)?)/]);
    if (freightSet != null && /运价/.test(q)) {
      patches.push(patch("freightPrice", "set", freightSet));
    }
  }

  // —— 单车月趟次 ——
  const tripsPctDown = numMatch(q, [/(?:趟次|单车月趟次)[^0-9\-]{0,8}(?:下降|下调|降低|降)(-?\d+(?:\.\d+)?)\s*%/]);
  const tripsPctUp = numMatch(q, [/(?:趟次|单车月趟次)[^0-9\-]{0,8}(?:上涨|上调|提高|升)(-?\d+(?:\.\d+)?)\s*%/]);
  if (tripsPctDown != null) patches.push(patch("tripsPerVehicleMonth", "multiply", 1 - tripsPctDown / 100));
  else if (tripsPctUp != null) patches.push(patch("tripsPerVehicleMonth", "multiply", 1 + tripsPctUp / 100));
  else if (/趟次|趟/.test(q) && /减少|增加/.test(q)) {
    const tripsSub = numMatch(q, [/趟次[^0-9\-]{0,6}减少(-?\d+(?:\.\d+)?)/, /减少(-?\d+(?:\.\d+)?)趟/]);
    if (tripsSub != null) patches.push(patch("tripsPerVehicleMonth", "add", -Math.abs(tripsSub)));
    const tripsAdd = numMatch(q, [/趟次[^0-9\-]{0,6}增加(-?\d+(?:\.\d+)?)/, /增加(-?\d+(?:\.\d+)?)趟/]);
    if (tripsAdd != null && !/台/.test(q)) patches.push(patch("tripsPerVehicleMonth", "add", Math.abs(tripsAdd)));
  } else {
    const tripsSet = signedNumMatch(q, [
      /(?:单车月趟次|月趟次|趟次)[^0-9\-]{0,8}(?:改成|改为|调整为|调整到|调到|设为)?(-?\d+(?:\.\d+)?)/,
      /调整到(-?\d+(?:\.\d+)?)趟/,
    ]);
    if (tripsSet != null && /趟/.test(q)) {
      patches.push(patch("tripsPerVehicleMonth", "set", tripsSet));
    }
  }

  // —— 里程 ——
  const distSet = numMatch(q, [
    /(?:运输)?里程[^0-9]{0,8}(?:改成|改为|调整为|调到|设为)?(\d+(?:\.\d+)?)/,
    /改成(\d+(?:\.\d+)?)(?:公里|千米|km)/i,
  ]);
  if (distSet != null && (/里程/.test(q) || /公里|千米|km/i.test(q))) {
    patches.push(patch("distanceKm", "set", distSet));
  }

  // —— 载重 ——
  const loadSet = numMatch(q, [/(?:载重|吨位)[^0-9]{0,8}(?:改成|改为|调整为|按|按照)?(\d+(?:\.\d+)?)/, /按(\d+(?:\.\d+)?)吨/]);
  if (loadSet != null && (/载重|吨位/.test(q) || /按\d/.test(q) && /吨/.test(q))) {
    patches.push(patch("loadTon", "set", loadSet));
  }

  // —— 重载能耗 ——
  const energySet = numMatch(q, [
    /(?:重载)?能耗[^0-9]{0,8}(?:改成|改为|调整为|调整到|调到|设为)?(\d+(?:\.\d+)?)/,
  ]);
  if (energySet != null && /能耗/.test(q)) {
    patches.push(patch("loadedEnergyConsumption", "set", energySet));
  }

  // —— 司机单趟成本 ——
  const driverSet = numMatch(q, [
    /司机(?:单趟)?(?:成本)?[^0-9]{0,8}(?:改成|改为|调整为|调到|设为)?(\d+(?:\.\d+)?)/,
  ]);
  if (driverSet != null && /司机/.test(q)) {
    patches.push(patch("driverCostPerTrip", "set", driverSet));
  }

  // —— 单车月租 ——
  const rent = numMatch(q, [/(?:单车)?月租[^0-9]{0,8}(?:改成|改为|调整为|调到|设为)?(\d+(?:\.\d+)?)/]);
  if (rent != null && /月租/.test(q)) {
    patches.push(patch("monthlyRentPerVehicle", "set", rent));
  }

  return patches;
}

/** 规则意图识别：优先确定性业务映射，不依赖 LLM 算数 */
export function parseAssistantIntent(question: string): AssistantIntent {
  const raw = question.trim();
  const q = compact(raw);

  if (!q) {
    return { kind: "unmatched", title: "空问题", patches: [], parser: "rule" };
  }

  if (/^(确认|确认并测算|应用并测算|好的|执行|同意|仍然确认|继续修改)$/.test(q) || /确认并.*测算/.test(q)) {
    return { kind: "confirm", title: "确认修改并测算", patches: [], parser: "rule" };
  }
  if (/^(取消|不要|算了|放弃)$/.test(q)) {
    return { kind: "cancel", title: "取消修改", patches: [], parser: "rule" };
  }

  // 作用域选择（多路段不一致后的二次交互）
  if (/^(1|全部|全部路段|所有路段|统一修改|全部修改)$/.test(q) || /全部\d*个?路段/.test(q)) {
    return { kind: "scope_choice", title: "选择全部路段", patches: [], scopeChoice: { mode: "all_routes" }, parser: "rule" };
  }
  if (/^(2|指定线路)/.test(q) || /选(择)?线路/.test(q)) {
    const hint = raw.match(/线路[：:\s]*([^\s，,。]+)/)?.[1];
    return { kind: "scope_choice", title: "选择指定线路", patches: [], scopeChoice: { mode: "route", routeHint: hint }, parser: "rule" };
  }
  if (/^(3|指定路段)/.test(q) || /选(择)?路段/.test(q)) {
    const hint = raw.match(/路段[：:\s]*([^\s，,。]+)/)?.[1];
    return { kind: "scope_choice", title: "选择指定路段", patches: [], scopeChoice: { mode: "segment", segmentHint: hint }, parser: "rule" };
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

  const createName =
    (raw.match(/做[一个]?(?:个)?(.+?)方案/) || raw.match(/创建(.+?)方案/) || raw.match(/低电价方案/))?.[1];
  const isCreate = /做[一个]?|创建|新建|生成.+方案|低电价方案/.test(q) && /方案/.test(q);

  const patches = collectPatches(q);
  const scopeHint = detectScopeHint(q);

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
      scopeHint,
      parser: "rule",
    };
  }

  if (patches.length) {
    return {
      kind: "modify",
      title: "修改测算参数",
      patches,
      scopeHint,
      parser: "rule",
    };
  }

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
