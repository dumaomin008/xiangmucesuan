import { AI_PROJECT_EXTRACT_SCHEMA_VERSION } from "./versions";
import { FIELD_BY_CODE } from "./field-dictionary";
import type { AiExtractResult, ParameterRecord, ValidationResult } from "./types";

const FIELD_STATUSES = new Set(["confirmed", "extracted", "reference", "missing", "conflict"]);
const SOURCE_TYPES = new Set(["due_diligence", "meeting", "chat", "system", "reference", "free_text", "user"]);

export function validateAiExtractResult(input: unknown): ValidationResult {
  const errors: Array<{ path: string; message: string }> = [];
  if (!input || typeof input !== "object") {
    return { ok: false, schema_version: AI_PROJECT_EXTRACT_SCHEMA_VERSION, errors: [{ path: "", message: "结果不是对象" }] };
  }
  const data = input as Partial<AiExtractResult>;
  if (data.schema_version !== AI_PROJECT_EXTRACT_SCHEMA_VERSION) {
    errors.push({ path: "schema_version", message: `必须为 ${AI_PROJECT_EXTRACT_SCHEMA_VERSION}` });
  }
  if (!data.project || typeof data.project !== "object") {
    errors.push({ path: "project", message: "缺少 project" });
  }
  if (!Array.isArray(data.routes)) errors.push({ path: "routes", message: "routes 必须是数组" });
  if (!Array.isArray(data.parameters)) errors.push({ path: "parameters", message: "parameters 必须是数组" });
  if (!Array.isArray(data.conflicts)) errors.push({ path: "conflicts", message: "conflicts 必须是数组" });
  if (!Array.isArray(data.missing_items)) errors.push({ path: "missing_items", message: "missing_items 必须是数组" });
  if (!Array.isArray(data.questions)) errors.push({ path: "questions", message: "questions 必须是数组" });
  if (!Array.isArray(data.reference_candidates)) {
    errors.push({ path: "reference_candidates", message: "reference_candidates 必须是数组" });
  }
  if (!data.calculation_request || typeof data.calculation_request !== "object") {
    errors.push({ path: "calculation_request", message: "缺少 calculation_request" });
  } else if (data.calculation_request.engine_mapped_fields_only !== true) {
    errors.push({ path: "calculation_request.engine_mapped_fields_only", message: "测算请求只能包含已映射引擎字段" });
  }
  if (data.analysis !== null && data.analysis !== undefined) {
    errors.push({ path: "analysis", message: "解析阶段不得带入测算分析；分析 Prompt 尚未冻结" });
  }
  if (data.risks && Array.isArray(data.risks) && data.risks.length > 0) {
    errors.push({ path: "risks", message: "风险规则尚未冻结，解析结果不得包含风险项" });
  }

  for (const [index, param] of (data.parameters ?? []).entries()) {
    validateParameter(param, `parameters[${index}]`, errors);
  }

  return { ok: errors.length === 0, schema_version: AI_PROJECT_EXTRACT_SCHEMA_VERSION, errors };
}

function validateParameter(param: ParameterRecord, path: string, errors: Array<{ path: string; message: string }>) {
  if (!param || typeof param !== "object") {
    errors.push({ path, message: "参数不是对象" });
    return;
  }
  if (!param.field_code || !FIELD_BY_CODE[param.field_code]) {
    errors.push({ path: `${path}.field_code`, message: `未知字段 ${param.field_code ?? ""}，不在冻结字典中` });
  }
  if (param.status && !FIELD_STATUSES.has(param.status)) {
    errors.push({ path: `${path}.status`, message: "非法 status" });
  }
  if (param.source_type && !SOURCE_TYPES.has(param.source_type)) {
    errors.push({ path: `${path}.source_type`, message: "非法 source_type" });
  }
  if (param.status === "reference" && !param.reference_meta) {
    errors.push({ path: `${path}.reference_meta`, message: "参考值必须带 source metadata" });
  }
  if (param.status === "confirmed" && param.source_type === "reference") {
    errors.push({ path: `${path}.status`, message: "参考值不得伪装成已确认值" });
  }
}
