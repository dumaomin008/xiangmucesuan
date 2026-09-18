export function yuanText(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 10000) {
    const wan = value / 10000;
    const rounded = Math.round(wan * 10) / 10;
    const text = Math.abs(rounded - Math.round(rounded)) < 0.05 ? String(Math.round(rounded)) : rounded.toFixed(1);
    return `${text}万元`;
  }
  return `${Math.round(value).toLocaleString("zh-CN")}元`;
}

export function percentText(ratio: number | null): string {
  if (ratio === null || !Number.isFinite(ratio)) return "待确认";
  return `${(ratio * 100).toFixed(1)}%`;
}

export function writeSummary(input: {
  profit: number;
  revenue: number;
  cost: number;
  margin: number | null;
  topCost: string | null;
  topParameter: string | null;
  highRisks: string[];
  question?: string;
}): { conclusion: string; highlights: string[] } {
  const profitTone =
    input.profit < 0 ? "当前方案低于盈亏平衡" : input.margin !== null && input.margin < 0.08 ? "项目有盈利空间，但利润偏薄" : "项目具备盈利空间";
  const focus = [
    input.topParameter ? `${input.topParameter}对收益影响较大` : "",
    input.topCost ? `${input.topCost}是最大成本项` : "",
  ]
    .filter(Boolean)
    .join("，");
  const prefix = input.question && /如果|下降|上涨|提高|降低/.test(input.question) ? "以下为测算引擎按当前场景重算后的结果。" : "";
  const conclusion = `${prefix}当前基准方案月利润 ${yuanText(input.profit)}，${profitTone}。${focus ? `${focus}。` : ""}建议进一步核实日均趟次、有效运营安排及实际能源价格。以上数字均来自测算引擎。`;

  const highlights = [
    `月营业收入 ${yuanText(input.revenue)}，月运营成本 ${yuanText(input.cost)}，月利润 ${yuanText(input.profit)}，利润率 ${percentText(input.margin)}。`,
    input.topCost ? `成本结构最大项是${input.topCost}。` : "成本结构明细暂缺，未估算占比。",
    input.topParameter ? `敏感度最高的参数是${input.topParameter}，变化幅度来自引擎重算。` : "敏感性重算暂不可用。",
    input.highRisks.length ? `需关注：${input.highRisks.join("、")}。` : "按当前敏感性规则，暂无高等级风险。",
  ].slice(0, 4);

  return { conclusion, highlights };
}
