/**
 * Tool Calling 目录。本轮只冻结工具名与输入输出边界，不实现对话执行。
 * AI 助手不得直连数据库，也不得自行计算核心指标。
 */
export const AI_TOOLS = [
  { name: "get_project_context", input: "project_id", output: "项目基础数据/当前版本", implemented: false },
  { name: "get_reference_value", input: "field_code + 条件", output: "候选参考值、区间、来源、样本", implemented: true },
  { name: "validate_inputs", input: "input_version", output: "缺失、冲突、非法值", implemented: true },
  { name: "run_calculation", input: "input_version/scenario", output: "标准测算结果JSON", implemented: true },
  { name: "run_sensitivity_analysis", input: "变量+范围/方案", output: "多场景结果", implemented: false },
  { name: "compare_scenarios", input: "scenario_ids", output: "差异指标", implemented: false },
  { name: "get_risk_rules", input: "project_type", output: "适用风险规则", implemented: false },
  { name: "save_ai_draft", input: "structured_payload", output: "草稿ID/校验结果", implemented: true },
] as const;

export const AI_ASSISTANT_SHORTCUTS = [
  "为什么当前毛利率较低？",
  "哪三个参数对利润最敏感？",
  "如果运价下降5%会怎样？",
  "每天少0.3趟会怎样？",
  "车辆减少10台结果如何？",
  "达到目标毛利率需要什么条件？",
  "当前还有哪些数据最值得继续尽调？",
];
