import { extractFromText, hitsToParameters } from "../extract/heuristic";
import { buildCalculationRequest, buildMissingAndQuestions, emptyExtract, mergeParameterCandidates } from "../extract/missing";
import { validateAiExtractResult } from "../schema/validator";
import { AI_PROJECT_EXTRACT_SCHEMA_VERSION } from "../schema/versions";
import type { AiExtractResult, AiRouteDraft, ParameterRecord, SourceType } from "../schema/types";
import { getLlmGatewayConfig } from "./llm-gateway";
import { getReferenceValue } from "./reference-service";

function routeKey(route: AiRouteDraft) {
  return `${route.origin_name.trim()}|${route.destination_name.trim()}`;
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
    map.set(key, {
      ...current,
      distance_km: current.distance_km || route.distance_km,
      volume_value: current.volume_value || route.volume_value,
      volume_unit: current.volume_unit || route.volume_unit,
      trips_per_day: current.trips_per_day || route.trips_per_day,
      trips_per_vehicle_month: current.trips_per_vehicle_month || route.trips_per_vehicle_month,
      vehicle_count: current.vehicle_count || route.vehicle_count,
      cargo_name: current.cargo_name || route.cargo_name,
      freight_price: current.freight_price || route.freight_price,
      freight_price_unit: current.freight_price_unit || route.freight_price_unit,
      load_ton: current.load_ton || route.load_ton,
    });
  }
  const merged = [...map.values(), ...unnamed].map((route, index) => ({
    ...route,
    sort_no: index + 1,
    id: `tmp-${index + 1}`,
  }));
  return merged;
}

async function loadReferenceCandidates(fieldCodes: string[]) {
  const unique = Array.from(new Set(fieldCodes));
  const rows = await Promise.all(unique.map((code) => getReferenceValue(code)));
  return rows.flatMap((row) => row.candidates);
}

export async function orchestrateParse(input: {
  documents: Array<{ id: string; contentText: string; sourceType: SourceType; fileName: string | null }>;
  project: { projectName: string; customerName: string };
}) {
  const texts = input.documents.filter((doc) => doc.contentText.trim());
  if (texts.length === 0) {
    const empty = emptyExtract({ name: input.project.projectName, customer: input.project.customerName, region: null });
    return {
      extract: empty,
      validation: validateAiExtractResult(empty),
      extractorKind: "heuristic" as const,
      modelName: null as string | null,
      promptVersion: null as string | null,
    };
  }

  const extracts = texts.map((doc) =>
    extractFromText(doc.contentText, doc.fileName || `${doc.sourceType}:${doc.id}`, doc.sourceType),
  );
  const routes = mergeRoutes(extracts.flatMap((item) => item.routes));
  const parametersRaw: ParameterRecord[] = extracts.flatMap((item) => {
    const ids = item.routes.map((route) => routes.find((r) => routeKey(r) === routeKey(route))?.id);
    return hitsToParameters(item, ids);
  });
  const { parameters, conflicts } = mergeParameterCandidates(parametersRaw);
  const fleet = parameters.find((item) => item.field_code === "vehicle.fleet_size")?.value ?? null;
  routes.forEach((route) => {
    if (fleet && !route.vehicle_count) route.vehicle_count = fleet;
  });

  const references = await loadReferenceCandidates([
    "energy.loaded_consumption",
    "energy.empty_consumption",
    "energy.electricity_price",
    "ops.trips_per_vehicle_month",
    "ops.loading_duration",
    "cargo.load_ton",
  ]);

  const { missing, questions, dueDiligence } = buildMissingAndQuestions({
    routes,
    parameters,
    projectFleetSize: fleet,
    references,
  });

  const extract: AiExtractResult = {
    schema_version: AI_PROJECT_EXTRACT_SCHEMA_VERSION,
    project: {
      name: input.project.projectName,
      customer: input.project.customerName,
      region: parameters.find((item) => item.field_code === "project.region")?.value ?? null,
    },
    routes,
    parameters,
    conflicts,
    missing_items: missing,
    questions,
    reference_candidates: references,
    calculation_request: buildCalculationRequest(routes, questions),
    analysis: null,
    risks: [],
    due_diligence_next: dueDiligence,
  };

  const llm = getLlmGatewayConfig();
  return {
    extract,
    validation: validateAiExtractResult(extract),
    extractorKind: "heuristic" as const,
    modelName: llm.provider,
    promptVersion: llm.promptVersion,
  };
}
