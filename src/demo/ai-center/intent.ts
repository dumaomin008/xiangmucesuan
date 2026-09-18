import type { AIIntent } from "./types";

const NAME_TOKENS = ["临港", "杭州", "盐田", "洋山", "嘉兴", "深圳", "宁波", "鄂尔多斯", "成渝", "沪甬", "沪杭"];

export const WELCOME_QUESTIONS = [
  "帮我测算一个新的运输项目",
  "分析最近测算项目经营情况",
  "对比两个项目的盈利能力",
  "哪些项目存在较大风险？",
] as const;

export const DEFAULT_QUESTIONS = [
  "分析最近的测算项目经营情况",
  "对比杭州和临港项目的盈利能力",
  "哪些项目存在较大风险，原因是什么？",
  "帮我测算一个新的运输项目",
  "生成本月项目经营分析报告",
] as const;

export const PROJECT_QUESTIONS = [
  "这个项目最大的成本是什么？",
  "电价上涨10%会怎么样？",
  "货量下降15%还赚钱吗？",
  "需要多少台车？",
  "这个方案和基准方案有什么区别？",
] as const;

export function detectIntent(question: string): AIIntent {
  const text = question.replace(/\s+/g, "");

  if (/上传|导入资料|导入测算|识别参数|识别项目参数/.test(text)) return "IMPORT_CALCULATION";

  if (
    /(电价|运价|货量|趟次|运量|能耗|电耗|租金|月租|空驶|利用率)/.test(text) &&
    /(上涨|上升|提高|增加|下降|下跌|降低|减少|敏感|怎么样|会怎样|变化|%|％)/.test(text)
  ) {
    return "SENSITIVITY_ANALYSIS";
  }

  if (/报告/.test(text)) return "GENERATE_REPORT";
  if (/风险/.test(text)) return "RISK_ANALYSIS";

  if (/方案/.test(text) && /(对比|比较|区别|差异|基准)/.test(text)) return "SCHEME_COMPARE";
  if (/对比|比较/.test(text) || (/哪个/.test(text) && /盈利|利润|成本/.test(text))) return "PROJECT_COMPARE";

  if (/新建测算|测算一个新|新的运输项目|新项目测算|帮我测算一个/.test(text)) return "CREATE_CALCULATION";

  if (/为什么|最大的成本|成本结构|多少台车|利润这么低|利润低|解释测算|解释一下结果/.test(text)) {
    return "CALCULATION_EXPLAIN";
  }

  if (/经营|分析最近|最近测算|测算项目|盈利能力|经营情况/.test(text)) return "PROJECT_ANALYSIS";

  if (NAME_TOKENS.some((token) => text.includes(token)) && /利润|成本|收入|测算/.test(text)) {
    return "CALCULATION_EXPLAIN";
  }

  return "GENERAL_CHAT";
}

export function suggestedQuestions(ctx?: { projectId?: string; projectName?: string }): string[] {
  if (ctx?.projectId) {
    return PROJECT_QUESTIONS.map((q) => q);
  }
  return DEFAULT_QUESTIONS.map((q) => q);
}
