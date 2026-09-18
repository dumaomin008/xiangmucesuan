export const AI_ANALYSIS_REPORT_SCHEMA_VERSION = "ai_analysis_report_v1" as const;
export const AI_PROJECT_EXTRACT_SCHEMA_VERSION = "ai_project_extract_v1" as const;
export const CALCULATION_REQUEST_SCHEMA_VERSION = "calculation_request_v1" as const;
export const CALCULATION_RESULT_SCHEMA_VERSION = "calculation_result_v1" as const;

export const AI_PROMPT_VERSION = "extract_v1";
export const AI_RISK_RULE_VERSION = "demo_risk_v1";
export const AI_REFERENCE_RULE_VERSION = "demo_reference_v1";

export type SchemaVersion =
  | typeof AI_ANALYSIS_REPORT_SCHEMA_VERSION
  | typeof AI_PROJECT_EXTRACT_SCHEMA_VERSION
  | typeof CALCULATION_REQUEST_SCHEMA_VERSION
  | typeof CALCULATION_RESULT_SCHEMA_VERSION;
