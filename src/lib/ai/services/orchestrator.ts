import { extractFromText, hitsToParameters } from "../extract/heuristic";
import { buildCalculationRequest, buildMissingAndQuestions, emptyExtract, mergeParameterCandidates, parametersFromRoute } from "../extract/missing";
import { buildExtractUserPrompt, EXTRACT_PROMPT_VERSION, EXTRACT_SYSTEM_PROMPT } from "../extract/prompts";
import { FIELD_DICTIONARY } from "../schema/field-dictionary";
import { validateAiExtractResult } from "../schema/validator";
import { AI_PROJECT_EXTRACT_SCHEMA_VERSION } from "../schema/versions";
import type { AiExtractResult, AiRouteDraft, ParameterRecord, SourceType } from "../schema/types";
import { completeStructuredJson, getLlmGatewayConfig, isLlmConfigured, LlmNotConfiguredError } from "./llm-gateway";
import { listDemoAndSystemReferences } from "./reference-service";

function routeKey(route: AiRouteDraft) {
  return `${(route.origin_name || "").trim()}|${(route.destination_name || "").trim()}`;
}

function mergeRoutes(routes: AiRouteDraft[]) {
  const map = new Map<string, AiRouteDraft>();
  const unnamed: AiRouteDraft[] = [];
  for (const route of routes) {
    const key = routeKey(route);
    if (key === "|") {
      unnamed.push(route);
      continue;
    }
    const current = map.get(key);
    if (!current) {
      map.set(key, { ...route });
      continue;
    }
    map.set(key, { ...current, ...Object.fromEntries(Object.entries(route).filter(([, v]) => v != null && v !== "")) });
  }
  return [...map.values(), ...unnamed].map((route, index) => ({
    ...route,
    sort_no: index + 1,
    id: route.id || `tmp-${index + 1}`,
    status: route.status || "pending",
    enabled: route.enabled !== false,
  }));
}

function hydrate(extract: Partial<AiExtractResult>, project: { projectName: string; customerName: string }, references: AiExtractResult["reference_candidates"]): AiExtractResult {
  const routes = mergeRoutes(extract.routes || []);
  const rawParams = [
    ...(extract.parameters || []),
    ...routes.flatMap((route) => parametersFromRoute(route)),
  ] as ParameterRecord[];
  const { parameters, conflicts } = mergeParameterCandidates([
    ...rawParams,
    ...(extract.conflicts || []).flatMap((c) =>
      (c.candidates || []).map((cand) => ({
        field_code: c.field_code,
        value: cand.value,
        unit: cand.unit,
        raw_value: cand.raw_value,
        source_type: cand.source_type,
        source_ref: cand.source_ref,
        confidence: 0.6,
        status: "extracted" as const,
        editable: true,
        reference_meta: null,
        updated_by: "AI" as const,
        route_id: c.route_id,
      })),
    ),
  ]);
  const fleet = parameters.find((item) => item.field_code === "vehicle.fleet_size")?.value ?? null;
  const { missing, questions, dueDiligence } = buildMissingAndQuestions({
    routes,
    parameters,
    projectFleetSize: fleet,
    references,
  });
  return {
    schema_version: AI_PROJECT_EXTRACT_SCHEMA_VERSION,
    project: extract.project || { name: project.projectName, customer: project.customerName, region: null },
    routes,
    parameters,
    conflicts: extract.conflicts && extract.conflicts.length ? extract.conflicts : conflicts,
    missing_items: missing,
    questions,
    reference_candidates: references,
    calculation_request: buildCalculationRequest(routes, questions, parameters, fleet),
    analysis: null,
    risks: [],
    due_diligence_next: dueDiligence,
  };
}

function heuristicExtract(input: {
  documents: Array<{ id: string; contentText: string; sourceType: SourceType; fileName: string | null }>;
  project: { projectName: string; customerName: string };
  references: AiExtractResult["reference_candidates"];
}) {
  const texts = input.documents.filter((doc) => doc.contentText.trim());
  if (!texts.length) return emptyExtract({ name: input.project.projectName, customer: input.project.customerName, region: null });
  const extracts = texts.map((doc) => extractFromText(doc.contentText, doc.fileName || `${doc.sourceType}:${doc.id}`, doc.sourceType));
  const routes = mergeRoutes(extracts.flatMap((item) => item.routes));
  const parametersRaw: ParameterRecord[] = extracts.flatMap((item) => {
    const ids = item.routes.map((route) => routes.find((r) => routeKey(r) === routeKey(route))?.id);
    return hitsToParameters(item, ids);
  });
  const { parameters, conflicts } = mergeParameterCandidates(parametersRaw);
  return hydrate({ project: { name: input.project.projectName, customer: input.project.customerName, region: null }, routes, parameters, conflicts }, input.project, input.references);
}

export async function orchestrateParse(input: {
  documents: Array<{ id: string; contentText: string; sourceType: SourceType; fileName: string | null }>;
  project: { projectName: string; customerName: string };
}) {
  const references = await listDemoAndSystemReferences();
  const heuristic = heuristicExtract({ ...input, references });
  const llmConfig = getLlmGatewayConfig();
  const texts = input.documents.filter((doc) => doc.contentText.trim());
  if (!texts.length) {
    return {
      extract: heuristic,
      validation: validateAiExtractResult(heuristic),
      extractorKind: "heuristic" as const,
      modelName: null as string | null,
      promptVersion: null as string | null,
      fallbackNotice: null as string | null,
    };
  }

  if (!isLlmConfigured()) {
    return {
      extract: heuristic,
      validation: validateAiExtractResult(heuristic),
      extractorKind: "heuristic" as const,
      modelName: null,
      promptVersion: llmConfig.promptVersion,
      fallbackNotice: "未配置大模型密钥，已使用基础解析。可继续编辑参数并测算。",
    };
  }

  const userContent = buildExtractUserPrompt({
    projectName: input.project.projectName,
    customerName: input.project.customerName,
    documents: texts.map((doc) => ({
      sourceRef: doc.fileName || doc.id,
      sourceType: doc.sourceType,
      text: doc.contentText,
    })),
    fieldCodes: FIELD_DICTIONARY.map((item) => item.fieldCode),
  });

  const runLlm = async () => {
    const raw = await completeStructuredJson<Partial<AiExtractResult>>({
      systemPrompt: EXTRACT_SYSTEM_PROMPT,
      userContent,
    });
    const extract = hydrate(raw, input.project, references);
    return { extract, validation: validateAiExtractResult(extract) };
  };

  try {
    let result = await runLlm();
    if (!result.validation.ok) {
      result = await runLlm();
    }
    if (result.validation.ok) {
      return {
        extract: result.extract,
        validation: result.validation,
        extractorKind: "llm" as const,
        modelName: llmConfig.model,
        promptVersion: EXTRACT_PROMPT_VERSION,
        fallbackNotice: null,
      };
    }
    return {
      extract: heuristic,
      validation: validateAiExtractResult(heuristic),
      extractorKind: "heuristic" as const,
      modelName: llmConfig.model,
      promptVersion: EXTRACT_PROMPT_VERSION,
      fallbackNotice: "AI解析失败，已切换基础解析模式，可继续编辑参数和测算。",
    };
  } catch (err) {
    if (err instanceof LlmNotConfiguredError) {
      return {
        extract: heuristic,
        validation: validateAiExtractResult(heuristic),
        extractorKind: "heuristic" as const,
        modelName: null,
        promptVersion: llmConfig.promptVersion,
        fallbackNotice: "未配置大模型密钥，已使用基础解析。",
      };
    }
    return {
      extract: heuristic,
      validation: validateAiExtractResult(heuristic),
      extractorKind: "heuristic" as const,
      modelName: llmConfig.model,
      promptVersion: EXTRACT_PROMPT_VERSION,
      fallbackNotice: "AI服务响应较慢或失败，已切换基础解析模式，可继续编辑参数和测算。",
    };
  }
}
