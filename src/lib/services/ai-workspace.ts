import { prisma } from "@/lib/db";
import { EngineError } from "@/lib/engine/decimal";
import { validateSchemeInput } from "@/lib/engine/validate";
import { createBlankScheme, executeCalculation, loadCalculationInput, audit } from "@/lib/services/scheme";
import { buildCalculationRequest, buildMissingAndQuestions, completeness, freightUnitLabel } from "@/lib/ai/extract/missing";
import { mapWorkspaceToEngineInput } from "@/lib/ai/map/to-engine";
import { toCalculationResultV1 } from "@/lib/ai/map/from-engine";
import { parseSourceInput } from "@/lib/ai/services/document-parser";
import { orchestrateParse } from "@/lib/ai/services/orchestrator";
import { evaluateRisks } from "@/lib/ai/services/risk-engine";
import { FIELD_BY_CODE } from "@/lib/ai/schema/field-dictionary";
import { AI_PROJECT_EXTRACT_SCHEMA_VERSION, CALCULATION_RESULT_SCHEMA_VERSION } from "@/lib/ai/schema/versions";
import type { AiExtractResult, AiRouteDraft, CreateMode, ParameterRecord, SourceType } from "@/lib/ai/schema/types";

const workspaceInclude = {
  documents: { orderBy: { uploadedAt: "desc" as const } },
  tasks: { orderBy: { createdAt: "desc" as const }, take: 5 },
  parameters: true,
  routes: { orderBy: { sortNo: "asc" as const } },
  conflicts: true,
  questions: true,
  referenceCandidates: true,
  dueDiligenceItems: true,
  analysisResults: { orderBy: { createdAt: "desc" as const }, take: 1 },
  riskResults: { orderBy: { createdAt: "desc" as const }, take: 1 },
  scenarios: { orderBy: { createdAt: "desc" as const }, take: 3 },
} as const;

async function requireWorkspace(id: string) {
  const workspace = await prisma.aiWorkspace.findUnique({ where: { id }, include: workspaceInclude });
  if (!workspace) throw new EngineError("NOT_FOUND", "workspace", "AI 测算草稿不存在");
  return workspace;
}

function toRouteDraft(route: {
  id: string;
  sortNo: number;
  routeName: string;
  originName: string;
  destinationName: string;
  distanceKm: string | null;
  volumeValue: string | null;
  volumeUnit: string | null;
  tripsPerDay: string | null;
  tripsPerVehicleMonth: string | null;
  vehicleCount: string | null;
  cargoName: string | null;
  freightPrice: string | null;
  freightPriceUnit: string | null;
  loadTon: string | null;
  status: string;
  enabled: boolean;
}): AiRouteDraft {
  return {
    id: route.id,
    sort_no: route.sortNo,
    route_name: route.routeName,
    origin_name: route.originName,
    destination_name: route.destinationName,
    distance_km: route.distanceKm,
    volume_value: route.volumeValue,
    volume_unit: route.volumeUnit,
    trips_per_day: route.tripsPerDay,
    trips_per_vehicle_month: route.tripsPerVehicleMonth,
    vehicle_count: route.vehicleCount,
    cargo_name: route.cargoName,
    freight_price: route.freightPrice,
    freight_price_unit: route.freightPriceUnit,
    load_ton: route.loadTon,
    status: route.status as AiRouteDraft["status"],
    enabled: route.enabled,
  };
}

function toParameter(row: {
  id: string;
  fieldCode: string;
  routeId: string | null;
  value: string | null;
  unit: string | null;
  rawValue: string | null;
  sourceType: string;
  sourceRef: string | null;
  confidence: number | null;
  status: string;
  editable: boolean;
  referenceMetaJson: string | null;
  updatedBy: string;
}): ParameterRecord {
  return {
    id: row.id,
    field_code: row.fieldCode,
    route_id: row.routeId,
    value: row.value,
    unit: row.unit,
    raw_value: row.rawValue,
    source_type: row.sourceType as ParameterRecord["source_type"],
    source_ref: row.sourceRef,
    confidence: row.confidence,
    status: row.status as ParameterRecord["status"],
    editable: row.editable,
    reference_meta: row.referenceMetaJson ? (JSON.parse(row.referenceMetaJson) as ParameterRecord["reference_meta"]) : null,
    updated_by: row.updatedBy as ParameterRecord["updated_by"],
  };
}

export function serializeWorkspace(workspace: Awaited<ReturnType<typeof requireWorkspace>>) {
  const routes = workspace.routes.map(toRouteDraft);
  const parameters = workspace.parameters.map(toParameter);
  const questions = workspace.questions.map((q) => ({
    id: q.id,
    priority: q.priority as "P0" | "P1" | "P2",
    field_code: q.fieldCode,
    route_id: q.routeId,
    question: q.question,
    reason: q.reason,
    impact_metrics: JSON.parse(q.impactMetrics || "[]") as string[],
    has_reference: q.hasReference,
    answer_action: q.answerAction as "fill" | "adopt_reference" | "skip" | null,
    answer_value: q.answerValue,
    status: q.status as "open" | "answered" | "skipped",
  }));
  const request = buildCalculationRequest(routes, questions);
  return {
    id: workspace.id,
    projectId: workspace.projectId,
    title: workspace.title,
    status: workspace.status,
    createMode: workspace.createMode,
    schemaVersion: workspace.schemaVersion,
    schemeId: workspace.schemeId,
    inputVersionNo: workspace.inputVersionNo,
    createdBy: workspace.createdBy,
    updatedAt: workspace.updatedAt,
    completeness: completeness(parameters, questions),
    calculation_request: request,
    documents: workspace.documents,
    tasks: workspace.tasks,
    routes,
    parameters,
    conflicts: workspace.conflicts.map((item) => ({
      id: item.id,
      field_code: item.fieldCode,
      route_id: item.routeId,
      candidates: JSON.parse(item.candidatesJson || "[]"),
      resolved_value: item.resolvedValue,
      status: item.status,
    })),
    questions,
    reference_candidates: workspace.referenceCandidates.map((item) => ({
      id: item.id,
      field_code: item.fieldCode,
      route_id: item.routeId,
      suggested_value: item.suggestedValue,
      range_min: item.rangeMin,
      range_max: item.rangeMax,
      source_level: item.sourceLevel,
      sample_size: item.sampleSize,
      statistic_method: item.statisticMethod,
      source_updated_at: item.sourceUpdatedAt?.toISOString() ?? null,
      applicable_condition: item.applicableCondition,
      confidence_level: item.confidenceLevel,
      status: item.status,
    })),
    due_diligence_next: workspace.dueDiligenceItems.map((item) => ({
      id: item.id,
      priority: item.priority,
      item: item.item,
      reason: item.reason,
      current_assumption: item.currentAssumption,
      impact_metrics: JSON.parse(item.impactMetrics || "[]"),
      sensitivity: item.sensitivity,
      suggested_method: item.suggestedMethod,
      completion_status: item.completionStatus,
    })),
    analysis: workspace.analysisResults[0] ?? { status: "not_configured", schemaVersion: "ai_analysis_v0", analysisJson: "{}" },
    risks: workspace.riskResults[0] ?? { status: "rules_not_configured", payloadJson: "[]" },
    latestTask: workspace.tasks[0] ?? null,
  };
}

export async function listWorkspaces(projectId: string) {
  const rows = await prisma.aiWorkspace.findMany({
    where: { projectId },
    include: { documents: true, questions: true, routes: true, scheme: { select: { id: true, status: true } } },
    orderBy: { updatedAt: "desc" },
  });
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    status: row.status,
    createMode: row.createMode,
    schemeId: row.schemeId,
    schemeStatus: row.scheme?.status ?? null,
    documentCount: row.documents.length,
    routeCount: row.routes.length,
    p0Open: row.questions.filter((q) => q.priority === "P0" && q.status === "open").length,
    updatedAt: row.updatedAt,
    createdBy: row.createdBy,
  }));
}

export async function createWorkspace(projectId: string, actor: string, body: { title?: string; createMode?: CreateMode }) {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) throw new EngineError("NOT_FOUND", "project", "项目不存在");
  const workspace = await prisma.aiWorkspace.create({
    data: {
      projectId,
      title: body.title || `${project.projectName} · AI测算草稿`,
      status: "collecting",
      createMode: body.createMode || "AI_IMPORT",
      schemaVersion: AI_PROJECT_EXTRACT_SCHEMA_VERSION,
      createdBy: actor,
      updatedBy: actor,
    },
    include: workspaceInclude,
  });
  await audit("AI_CREATE_WORKSPACE", "AiWorkspace", workspace.id, actor, { projectId });
  return serializeWorkspace(workspace);
}

export async function getWorkspace(id: string) {
  return serializeWorkspace(await requireWorkspace(id));
}

export async function addSource(
  workspaceId: string,
  actor: string,
  body: { sourceType: SourceType; fileName?: string | null; mimeType?: string | null; text?: string | null },
) {
  await requireWorkspace(workspaceId);
  const parsed = parseSourceInput(body);
  const doc = await prisma.aiSourceDocument.create({
    data: {
      workspaceId,
      sourceType: parsed.sourceType,
      fileName: parsed.fileName,
      mimeType: parsed.mimeType,
      contentHash: parsed.contentHash,
      contentText: parsed.contentText,
      byteSize: parsed.byteSize,
      parseStatus: parsed.parseStatus,
      parseMessage: parsed.parseMessage,
      uploadedBy: actor,
    },
  });
  await prisma.aiWorkspace.update({ where: { id: workspaceId }, data: { updatedBy: actor, status: "collecting" } });
  await audit("AI_ADD_SOURCE", "AiSourceDocument", doc.id, actor, { workspaceId, sourceType: parsed.sourceType });
  return doc;
}

export async function deleteSource(workspaceId: string, sourceId: string, actor: string) {
  const doc = await prisma.aiSourceDocument.findFirst({ where: { id: sourceId, workspaceId } });
  if (!doc) throw new EngineError("NOT_FOUND", "source", "资料不存在");
  await prisma.aiSourceDocument.delete({ where: { id: sourceId } });
  await prisma.aiWorkspace.update({ where: { id: workspaceId }, data: { updatedBy: actor } });
  return { ok: true };
}

async function persistExtract(workspaceId: string, extract: AiExtractResult, actor: string) {
  await prisma.$transaction([
    prisma.aiParameter.deleteMany({ where: { workspaceId } }),
    prisma.aiRoute.deleteMany({ where: { workspaceId } }),
    prisma.aiConflict.deleteMany({ where: { workspaceId } }),
    prisma.aiQuestion.deleteMany({ where: { workspaceId } }),
    prisma.aiReferenceCandidate.deleteMany({ where: { workspaceId } }),
    prisma.aiDueDiligenceItem.deleteMany({ where: { workspaceId } }),
  ]);

  const idMap = new Map<string, string>();
  for (const route of extract.routes) {
    const created = await prisma.aiRoute.create({
      data: {
        workspaceId,
        sortNo: route.sort_no,
        routeName: route.route_name,
        originName: route.origin_name,
        destinationName: route.destination_name,
        distanceKm: route.distance_km,
        volumeValue: route.volume_value,
        volumeUnit: route.volume_unit,
        tripsPerDay: route.trips_per_day,
        tripsPerVehicleMonth: route.trips_per_vehicle_month,
        vehicleCount: route.vehicle_count,
        cargoName: route.cargo_name,
        freightPrice: route.freight_price,
        freightPriceUnit: route.freight_price_unit,
        loadTon: route.load_ton,
        status: "pending",
        enabled: true,
      },
    });
    if (route.id) idMap.set(route.id, created.id);
  }

  const remap = (id?: string | null) => (id ? idMap.get(id) ?? null : null);

  if (extract.parameters.length) {
    await prisma.aiParameter.createMany({
      data: extract.parameters.map((item) => ({
        workspaceId,
        routeId: remap(item.route_id),
        fieldCode: item.field_code,
        value: item.value,
        unit: item.unit,
        rawValue: item.raw_value,
        sourceType: item.source_type,
        sourceRef: item.source_ref,
        confidence: item.confidence,
        status: item.status,
        editable: item.editable,
        referenceMetaJson: item.reference_meta ? JSON.stringify(item.reference_meta) : null,
        updatedBy: actor === "系统" ? "AI" : "AI",
      })),
    });
  }
  if (extract.conflicts.length) {
    await prisma.aiConflict.createMany({
      data: extract.conflicts.map((item) => ({
        workspaceId,
        fieldCode: item.field_code,
        routeId: remap(item.route_id),
        candidatesJson: JSON.stringify(item.candidates),
        status: "open",
      })),
    });
  }
  if (extract.reference_candidates.length) {
    await prisma.aiReferenceCandidate.createMany({
      data: extract.reference_candidates.map((item) => ({
        workspaceId,
        fieldCode: item.field_code,
        suggestedValue: item.suggested_value,
        rangeMin: item.range_min,
        rangeMax: item.range_max,
        sourceLevel: item.source_level,
        sampleSize: item.sample_size,
        statisticMethod: item.statistic_method,
        sourceUpdatedAt: item.source_updated_at ? new Date(item.source_updated_at) : null,
        applicableCondition: item.applicable_condition,
        confidenceLevel: item.confidence_level,
        status: "unused",
        sourceMetaJson: JSON.stringify({ source_level: item.source_level }),
      })),
    });
  }

  const workspace = await requireWorkspace(workspaceId);
  const routes = workspace.routes.map(toRouteDraft);
  const parameters = workspace.parameters.map(toParameter);
  const references = workspace.referenceCandidates.map((item) => ({
    field_code: item.fieldCode,
    suggested_value: item.suggestedValue,
    range_min: item.rangeMin,
    range_max: item.rangeMax,
    source_level: item.sourceLevel,
    sample_size: item.sampleSize,
    statistic_method: item.statisticMethod,
    source_updated_at: item.sourceUpdatedAt?.toISOString() ?? null,
    applicable_condition: item.applicableCondition,
    confidence_level: item.confidenceLevel,
    status: item.status as "unused" | "adopted" | "dismissed",
  }));
  const fleet = parameters.find((item) => item.field_code === "vehicle.fleet_size")?.value ?? null;
  const built = buildMissingAndQuestions({ routes, parameters, projectFleetSize: fleet, references });
  if (built.questions.length) {
    await prisma.aiQuestion.createMany({
      data: built.questions.map((item) => ({
        workspaceId,
        priority: item.priority,
        fieldCode: item.field_code,
        routeId: item.route_id,
        question: item.question,
        reason: item.reason,
        impactMetrics: JSON.stringify(item.impact_metrics),
        hasReference: item.has_reference,
        status: "open",
      })),
    });
  }
  if (built.dueDiligence.length) {
    await prisma.aiDueDiligenceItem.createMany({
      data: built.dueDiligence.map((item) => ({
        workspaceId,
        priority: item.priority,
        item: item.item,
        reason: item.reason,
        currentAssumption: item.current_assumption,
        impactMetrics: JSON.stringify(item.impact_metrics),
        sensitivity: null,
        suggestedMethod: item.suggested_method,
        completionStatus: item.completion_status,
      })),
    });
  }
}

export async function parseWorkspace(workspaceId: string, actor: string) {
  const workspace = await requireWorkspace(workspaceId);
  const project = await prisma.project.findUnique({ where: { id: workspace.projectId } });
  if (!project) throw new EngineError("NOT_FOUND", "project", "项目不存在");

  await prisma.aiWorkspace.update({ where: { id: workspaceId }, data: { status: "parsing", updatedBy: actor } });
  const task = await prisma.aiExtractionTask.create({
    data: {
      workspaceId,
      status: "processing",
      extractorKind: "heuristic",
      schemaVersion: AI_PROJECT_EXTRACT_SCHEMA_VERSION,
      startedAt: new Date(),
    },
  });

  try {
    const pipeline = await orchestrateParse({
      documents: workspace.documents.map((doc) => ({
        id: doc.id,
        contentText: doc.contentText,
        sourceType: doc.sourceType as SourceType,
        fileName: doc.fileName,
      })),
      project,
    });
    if (!pipeline.validation.ok) {
      throw new EngineError("AI_SCHEMA_INVALID", "extract", pipeline.validation.errors.map((e) => e.message).join("；"));
    }
    await persistExtract(workspaceId, pipeline.extract, actor);
    await prisma.aiExtractionTask.update({
      where: { id: task.id },
      data: {
        status: "succeeded",
        extractorKind: pipeline.extractorKind,
        modelName: pipeline.modelName,
        promptVersion: pipeline.promptVersion,
        schemaVersion: pipeline.extract.schema_version,
        rawResponseJson: JSON.stringify({ extractor: pipeline.extractorKind, note: "heuristic_v1_no_prompt" }),
        validationResultJson: JSON.stringify(pipeline.validation),
        extractPayloadJson: JSON.stringify(pipeline.extract),
        finishedAt: new Date(),
      },
    });
    await prisma.aiWorkspace.update({ where: { id: workspaceId }, data: { status: "preview", updatedBy: actor } });
    await audit("AI_PARSE", "AiWorkspace", workspaceId, actor, { taskId: task.id });
    return getWorkspace(workspaceId);
  } catch (err) {
    const message = err instanceof Error ? err.message : "解析失败";
    await prisma.aiExtractionTask.update({
      where: { id: task.id },
      data: { status: "retryable", errorMessage: message, finishedAt: new Date() },
    });
    await prisma.aiWorkspace.update({ where: { id: workspaceId }, data: { status: "failed", updatedBy: actor } });
    throw err;
  }
}

async function refreshQuestions(workspaceId: string) {
  const workspace = await requireWorkspace(workspaceId);
  const routes = workspace.routes.map(toRouteDraft);
  const parameters = workspace.parameters.map(toParameter);
  const references = workspace.referenceCandidates.map((item) => ({
    field_code: item.fieldCode,
    suggested_value: item.suggestedValue,
    range_min: item.rangeMin,
    range_max: item.rangeMax,
    source_level: item.sourceLevel,
    sample_size: item.sampleSize,
    statistic_method: item.statisticMethod,
    source_updated_at: item.sourceUpdatedAt?.toISOString() ?? null,
    applicable_condition: item.applicableCondition,
    confidence_level: item.confidenceLevel,
    status: item.status as "unused" | "adopted" | "dismissed",
  }));
  const fleet = parameters.find((item) => item.field_code === "vehicle.fleet_size")?.value ?? null;
  const built = buildMissingAndQuestions({ routes, parameters, projectFleetSize: fleet, references });
  const answered = new Map(workspace.questions.filter((q) => q.status !== "open").map((q) => [`${q.fieldCode}:${q.routeId ?? ""}`, q]));
  await prisma.aiQuestion.deleteMany({ where: { workspaceId } });
  if (built.questions.length) {
    await prisma.aiQuestion.createMany({
      data: built.questions.map((item) => {
        const prev = answered.get(`${item.field_code}:${item.route_id ?? ""}`);
        return {
          workspaceId,
          priority: item.priority,
          fieldCode: item.field_code,
          routeId: item.route_id,
          question: item.question,
          reason: item.reason,
          impactMetrics: JSON.stringify(item.impact_metrics),
          hasReference: item.has_reference,
          answerAction: prev?.answerAction,
          answerValue: prev?.answerValue,
          status: prev?.status ?? "open",
        };
      }),
    });
  }
}

export async function updateRoute(workspaceId: string, routeId: string, actor: string, patch: Partial<AiRouteDraft> & { confirm?: boolean }) {
  const route = await prisma.aiRoute.findFirst({ where: { id: routeId, workspaceId } });
  if (!route) throw new EngineError("NOT_FOUND", "route", "线路不存在");
  const data = {
    routeName: patch.route_name ?? route.routeName,
    originName: patch.origin_name ?? route.originName,
    destinationName: patch.destination_name ?? route.destinationName,
    distanceKm: patch.distance_km !== undefined ? patch.distance_km : route.distanceKm,
    volumeValue: patch.volume_value !== undefined ? patch.volume_value : route.volumeValue,
    volumeUnit: patch.volume_unit !== undefined ? patch.volume_unit : route.volumeUnit,
    tripsPerDay: patch.trips_per_day !== undefined ? patch.trips_per_day : route.tripsPerDay,
    tripsPerVehicleMonth: patch.trips_per_vehicle_month !== undefined ? patch.trips_per_vehicle_month : route.tripsPerVehicleMonth,
    vehicleCount: patch.vehicle_count !== undefined ? patch.vehicle_count : route.vehicleCount,
    cargoName: patch.cargo_name !== undefined ? patch.cargo_name : route.cargoName,
    freightPrice: patch.freight_price !== undefined ? patch.freight_price : route.freightPrice,
    freightPriceUnit: patch.freight_price_unit !== undefined ? patch.freight_price_unit : route.freightPriceUnit,
    loadTon: patch.load_ton !== undefined ? patch.load_ton : route.loadTon,
    status: patch.confirm ? "confirmed" : patch.status ?? route.status,
    enabled: patch.enabled ?? route.enabled,
  };
  if (!data.routeName && data.originName && data.destinationName) data.routeName = `${data.originName}-${data.destinationName}`;
  await prisma.aiRoute.update({ where: { id: routeId }, data });

  const fieldMap: Array<[string, string | null | undefined]> = [
    ["route.origin", data.originName],
    ["route.destination", data.destinationName],
    ["route.distance_km", data.distanceKm],
    ["cargo.daily_volume_ton", data.volumeValue],
    ["cargo.load_ton", data.loadTon],
    ["ops.trips_per_day", data.tripsPerDay],
    ["ops.trips_per_vehicle_month", data.tripsPerVehicleMonth],
    ["revenue.freight_price", data.freightPrice],
    ["revenue.freight_price_unit", data.freightPriceUnit],
    ["cargo.name", data.cargoName],
  ];
  for (const [fieldCode, value] of fieldMap) {
    if (value == null) continue;
    await upsertParameter(workspaceId, fieldCode, routeId, String(value), actor, "user");
  }
  await prisma.aiWorkspace.update({ where: { id: workspaceId }, data: { updatedBy: actor, status: "preview" } });
  await refreshQuestions(workspaceId);
  return getWorkspace(workspaceId);
}

async function upsertParameter(
  workspaceId: string,
  fieldCode: string,
  routeId: string | null,
  value: string,
  actor: string,
  sourceType: SourceType,
  extra?: { status?: ParameterRecord["status"]; referenceMetaJson?: string | null; unit?: string | null },
) {
  const existing = await prisma.aiParameter.findFirst({ where: { workspaceId, fieldCode, routeId } });
  const def = FIELD_BY_CODE[fieldCode];
  const data = {
    value,
    unit: extra?.unit ?? def?.unit ?? existing?.unit ?? null,
    rawValue: value,
    sourceType,
    sourceRef: existing?.sourceRef ?? "用户确认",
    status: extra?.status ?? "confirmed",
    updatedBy: "用户",
    referenceMetaJson: extra?.referenceMetaJson ?? (extra?.status === "reference" ? existing?.referenceMetaJson : null),
    editable: true,
  };
  if (existing) {
    await prisma.aiParameter.update({ where: { id: existing.id }, data });
  } else {
    await prisma.aiParameter.create({
      data: { workspaceId, fieldCode, routeId, confidence: null, ...data },
    });
  }
  void actor;
}

export async function addRoute(workspaceId: string, actor: string) {
  const count = await prisma.aiRoute.count({ where: { workspaceId } });
  await prisma.aiRoute.create({
    data: {
      workspaceId,
      sortNo: count + 1,
      routeName: `线路 ${count + 1}`,
      originName: "",
      destinationName: "",
      status: "pending",
      enabled: true,
    },
  });
  await prisma.aiWorkspace.update({ where: { id: workspaceId }, data: { updatedBy: actor } });
  await refreshQuestions(workspaceId);
  return getWorkspace(workspaceId);
}

export async function deleteRoute(workspaceId: string, routeId: string, actor: string) {
  const route = await prisma.aiRoute.findFirst({ where: { id: routeId, workspaceId } });
  if (!route) throw new EngineError("NOT_FOUND", "route", "线路不存在");
  await prisma.aiRoute.delete({ where: { id: routeId } });
  await prisma.aiParameter.deleteMany({ where: { workspaceId, routeId } });
  await prisma.aiWorkspace.update({ where: { id: workspaceId }, data: { updatedBy: actor } });
  await refreshQuestions(workspaceId);
  return getWorkspace(workspaceId);
}

export async function splitRoute(workspaceId: string, routeId: string, actor: string) {
  const route = await prisma.aiRoute.findFirst({ where: { id: routeId, workspaceId } });
  if (!route) throw new EngineError("NOT_FOUND", "route", "线路不存在");
  const count = await prisma.aiRoute.count({ where: { workspaceId } });
  const { id: _id, ...data } = route;
  await prisma.aiRoute.create({
    data: {
      ...data,
      workspaceId,
      sortNo: count + 1,
      routeName: `${route.routeName}（拆分）`,
      status: "pending",
    },
  });
  await refreshQuestions(workspaceId);
  void actor;
  return getWorkspace(workspaceId);
}

export async function mergeRoutes(workspaceId: string, routeIds: string[], actor: string) {
  if (routeIds.length < 2) throw new EngineError("CALC_PARAMETER_INVALID", "routes", "合并至少需要两条线路");
  const routes = await prisma.aiRoute.findMany({ where: { workspaceId, id: { in: routeIds } }, orderBy: { sortNo: "asc" } });
  if (routes.length < 2) throw new EngineError("NOT_FOUND", "routes", "待合并线路不存在");
  const keep = routes[0];
  const drop = routes.slice(1);
  await prisma.aiRoute.update({
    where: { id: keep.id },
    data: {
      routeName: drop.reduce((name, item) => `${name}/${item.routeName}`, keep.routeName),
      destinationName: drop[drop.length - 1].destinationName || keep.destinationName,
      status: "pending",
    },
  });
  for (const item of drop) {
    await prisma.aiParameter.deleteMany({ where: { workspaceId, routeId: item.id } });
    await prisma.aiRoute.delete({ where: { id: item.id } });
  }
  await prisma.aiWorkspace.update({ where: { id: workspaceId }, data: { updatedBy: actor } });
  await refreshQuestions(workspaceId);
  return getWorkspace(workspaceId);
}

export async function confirmAllRoutes(workspaceId: string, actor: string) {
  const routes = await prisma.aiRoute.findMany({ where: { workspaceId } });
  for (const route of routes) {
    if (!route.originName.trim()) {
      throw new EngineError("CALC_PARAMETER_INVALID", "route.origin", `线路「${route.routeName}」缺少起点，不能确认`);
    }
  }
  await prisma.aiRoute.updateMany({ where: { workspaceId }, data: { status: "confirmed" } });
  await prisma.aiWorkspace.update({ where: { id: workspaceId }, data: { updatedBy: actor } });
  return getWorkspace(workspaceId);
}

export async function answerQuestion(
  workspaceId: string,
  questionId: string,
  actor: string,
  body: { action: "fill" | "adopt_reference" | "skip"; value?: string },
) {
  const question = await prisma.aiQuestion.findFirst({ where: { id: questionId, workspaceId } });
  if (!question) throw new EngineError("NOT_FOUND", "question", "问题不存在");
  if (body.action === "skip") {
    if (question.priority === "P0") {
      throw new EngineError("CALC_PARAMETER_INVALID", question.fieldCode, "P0 问题不能跳过，必须填写或确认");
    }
    await prisma.aiQuestion.update({
      where: { id: questionId },
      data: { status: "skipped", answerAction: "skip", answerValue: null },
    });
    return getWorkspace(workspaceId);
  }
  if (body.action === "adopt_reference") {
    const ref = await prisma.aiReferenceCandidate.findFirst({
      where: { workspaceId, fieldCode: question.fieldCode, status: { in: ["unused", "adopted"] } },
    });
    if (!ref?.suggestedValue) {
      throw new EngineError("NOT_FOUND", "reference", "该字段暂无可用参考值（历史规则尚未配置）");
    }
    const meta = {
      source_level: ref.sourceLevel,
      sample_size: ref.sampleSize,
      statistic_method: ref.statisticMethod,
      range_min: ref.rangeMin,
      range_max: ref.rangeMax,
      suggested_value: ref.suggestedValue,
      applicable_condition: ref.applicableCondition,
      confidence_level: ref.confidenceLevel,
      updated_at: ref.sourceUpdatedAt?.toISOString() ?? null,
    };
    await upsertParameter(workspaceId, question.fieldCode, question.routeId, ref.suggestedValue, actor, "reference", {
      status: "reference",
      referenceMetaJson: JSON.stringify(meta),
      unit: FIELD_BY_CODE[question.fieldCode]?.unit ?? null,
    });
    await prisma.aiReferenceCandidate.update({ where: { id: ref.id }, data: { status: "adopted" } });
    await applyRouteField(workspaceId, question.routeId, question.fieldCode, ref.suggestedValue);
    await prisma.aiQuestion.update({
      where: { id: questionId },
      data: { status: "answered", answerAction: "adopt_reference", answerValue: ref.suggestedValue },
    });
    return getWorkspace(workspaceId);
  }
  const value = String(body.value ?? "").trim();
  if (!value) throw new EngineError("CALC_PARAMETER_INVALID", question.fieldCode, "请填写实际值");
  await upsertParameter(workspaceId, question.fieldCode, question.routeId, value, actor, "user", { status: "confirmed" });
  await applyRouteField(workspaceId, question.routeId, question.fieldCode, value);
  await prisma.aiQuestion.update({
    where: { id: questionId },
    data: { status: "answered", answerAction: "fill", answerValue: value },
  });
  await prisma.aiWorkspace.update({ where: { id: workspaceId }, data: { updatedBy: actor } });
  return getWorkspace(workspaceId);
}

async function applyRouteField(workspaceId: string, routeId: string | null, fieldCode: string, value: string) {
  if (fieldCode === "vehicle.fleet_size") {
    await prisma.aiRoute.updateMany({ where: { workspaceId }, data: { vehicleCount: value } });
    return;
  }
  if (!routeId) return;
  const patch: Record<string, string> = {};
  if (fieldCode === "route.origin") patch.originName = value;
  if (fieldCode === "route.destination") patch.destinationName = value;
  if (fieldCode === "route.distance_km") patch.distanceKm = value;
  if (fieldCode === "cargo.daily_volume_ton") patch.volumeValue = value;
  if (fieldCode === "cargo.load_ton") patch.loadTon = value;
  if (fieldCode === "ops.trips_per_day") patch.tripsPerDay = value;
  if (fieldCode === "ops.trips_per_vehicle_month") patch.tripsPerVehicleMonth = value;
  if (fieldCode === "revenue.freight_price") patch.freightPrice = value;
  if (fieldCode === "revenue.freight_price_unit") patch.freightPriceUnit = value;
  if (fieldCode === "cargo.name") patch.cargoName = value;
  if (fieldCode === "vehicle.fleet_size") patch.vehicleCount = value;
  if (Object.keys(patch).length) await prisma.aiRoute.update({ where: { id: routeId }, data: patch });
}

export async function resolveConflict(workspaceId: string, conflictId: string, actor: string, value: string) {
  const conflict = await prisma.aiConflict.findFirst({ where: { id: conflictId, workspaceId } });
  if (!conflict) throw new EngineError("NOT_FOUND", "conflict", "冲突不存在");
  if (!value.trim()) throw new EngineError("CALC_PARAMETER_INVALID", conflict.fieldCode, "必须选择一个候选值，不能静默覆盖");
  await prisma.aiConflict.update({ where: { id: conflictId }, data: { status: "resolved", resolvedValue: value } });
  await upsertParameter(workspaceId, conflict.fieldCode, conflict.routeId, value, actor, "user", { status: "confirmed" });
  await applyRouteField(workspaceId, conflict.routeId, conflict.fieldCode, value);
  await refreshQuestions(workspaceId);
  return getWorkspace(workspaceId);
}

export async function confirmAndCalculate(workspaceId: string, actor: string, mode: "draft" | "calculate") {
  const workspace = await requireWorkspace(workspaceId);
  const serialized = serializeWorkspace(workspace);
  if (mode === "calculate") {
    if (!serialized.calculation_request.routes_confirmed) {
      throw new EngineError("CALC_PARAMETER_INVALID", "routes", "线路未确认前，不能生成正式测算版本");
    }
    if (serialized.calculation_request.blocking_p0.length) {
      throw new EngineError("CALC_PARAMETER_INVALID", "p0", `P0 未解决：${serialized.calculation_request.blocking_p0.join("、")}`);
    }
    if (serialized.conflicts.some((item) => item.status === "open")) {
      throw new EngineError("CALC_PARAMETER_INVALID", "conflicts", "存在未解决的字段冲突，不能静默覆盖");
    }
  }

  const mapped = mapWorkspaceToEngineInput({
    title: workspace.title,
    routes: serialized.routes,
    parameters: serialized.parameters,
    projectFleetSize: serialized.parameters.find((item) => item.field_code === "vehicle.fleet_size")?.value ?? null,
  });

  let schemeId = workspace.schemeId;
  if (schemeId) {
    const existing = await prisma.calculationScheme.findUnique({ where: { id: schemeId } });
    if (existing && (existing.status === "calculated" || existing.status === "baseline" || existing.status === "archived")) {
      schemeId = null;
    }
  }
  if (!schemeId) {
    const scheme = await createBlankScheme(workspace.projectId, actor, {
      schemeName: mapped.schemeName,
      fleetSize: mapped.fleetSize,
      description: "由 AI 智能测算草稿确认生成，仅写入已映射字段",
    });
    schemeId = scheme.id;
    await prisma.aiWorkspace.update({ where: { id: workspaceId }, data: { schemeId, inputVersionNo: scheme.versionNo } });
  } else {
    await prisma.calculationScheme.update({
      where: { id: schemeId },
      data: { schemeName: mapped.schemeName, fleetSize: mapped.fleetSize, updatedBy: actor },
    });
    await prisma.vehiclePlan.update({ where: { schemeId }, data: { fleetSize: mapped.fleetSize } });
    await prisma.calculationRoute.deleteMany({ where: { schemeId } });
  }

  for (const route of mapped.routes) {
    const created = await prisma.calculationRoute.create({
      data: {
        schemeId,
        routeName: route.routeName,
        routeCode: route.routeCode,
        sortNo: route.sortNo,
        description: route.description,
        enabled: true,
      },
    });
    await prisma.calculationRouteSegment.create({
      data: {
        routeId: created.id,
        sortNo: 1,
        ...route.segment,
        operatingMonthsYear: "12",
      },
    });
  }

  await prisma.aiScenario.create({
    data: {
      workspaceId,
      schemeId,
      kind: mode === "calculate" ? "formal" : "draft",
      name: mode === "calculate" ? "正式测算输入版本" : "草稿输入版本",
      payloadJson: JSON.stringify({ mapped, unmapped: mapped.unmappedParameters.map((p) => p.field_code) }),
    },
  });

  if (mode === "draft") {
    await prisma.aiWorkspace.update({ where: { id: workspaceId }, data: { status: "draft_saved", updatedBy: actor, schemeId } });
    await audit("AI_SAVE_DRAFT", "AiWorkspace", workspaceId, actor, { schemeId });
    return { workspace: await getWorkspace(workspaceId), schemeId, calculated: false as const, engineErrors: [] as string[], result: null };
  }

  const input = await loadCalculationInput(schemeId);
  const { errors } = validateSchemeInput(input);
  if (errors.length) {
    await prisma.aiWorkspace.update({ where: { id: workspaceId }, data: { status: "confirmed", updatedBy: actor, schemeId } });
    return {
      workspace: await getWorkspace(workspaceId),
      schemeId,
      calculated: false as const,
      engineErrors: errors.map((item) => item.message),
      result: null,
    };
  }

  const output = await executeCalculation(schemeId, actor);
  const latest = await prisma.calculationResult.findFirst({ where: { schemeId }, orderBy: { calculatedAt: "desc" } });
  await prisma.aiAnalysisResult.create({
    data: {
      workspaceId,
      basedOnResultId: latest?.id,
      schemaVersion: "ai_analysis_v0",
      status: "not_configured",
      analysisJson: JSON.stringify({ message: "分析类 Prompt 尚未冻结，本轮不生成 AI 解释。" }),
    },
  });
  const risk = evaluateRisks({ resultVersionId: latest?.id });
  await prisma.aiRiskResult.create({
    data: {
      workspaceId,
      basedOnResultId: latest?.id,
      status: risk.status,
      payloadJson: JSON.stringify(risk),
    },
  });
  await prisma.aiWorkspace.update({ where: { id: workspaceId }, data: { status: "calculated", updatedBy: actor, schemeId } });
  await audit("AI_CALCULATE", "AiWorkspace", workspaceId, actor, { schemeId, resultId: latest?.id });
  return {
    workspace: await getWorkspace(workspaceId),
    schemeId,
    calculated: true as const,
    engineErrors: [] as string[],
    result: latest
      ? toCalculationResultV1({
          ruleVersion: latest.ruleVersionId,
          snapshotId: latest.snapshotId,
          resultId: latest.id,
          monthlyRevenue: latest.monthlyRevenue,
          monthlyTotalCost: latest.monthlyTotalCost,
          monthlyProfit: latest.monthlyProfit,
          profitMargin: latest.profitMargin,
          profitMarginReason: latest.profitMarginReason,
          irr: latest.irr,
          irrReason: latest.irrReason,
          monthlyVolume: latest.monthlyVolume,
          monthlyMileage: latest.monthlyMileage,
          firstPositiveMonth: latest.firstPositiveMonth,
          cumulativeCashFlow: latest.cumulativeCashFlow,
        })
      : null,
  };
}

export async function getWorkspaceResult(workspaceId: string) {
  const workspace = await requireWorkspace(workspaceId);
  if (!workspace.schemeId) return { result: null, schemeId: null, analysis: workspace.analysisResults[0] ?? null, risks: workspace.riskResults[0] ?? null };
  const latest = await prisma.calculationResult.findFirst({
    where: { schemeId: workspace.schemeId },
    orderBy: { calculatedAt: "desc" },
  });
  if (!latest) return { result: null, schemeId: workspace.schemeId, analysis: workspace.analysisResults[0] ?? null, risks: workspace.riskResults[0] ?? null };
  const payload = JSON.parse(latest.payloadJson || "{}") as { costBreakdown?: unknown[]; routes?: unknown[]; warnings?: unknown[] };
  return {
    result: toCalculationResultV1({
      ruleVersion: latest.ruleVersionId,
      snapshotId: latest.snapshotId,
      resultId: latest.id,
      monthlyRevenue: latest.monthlyRevenue,
      monthlyTotalCost: latest.monthlyTotalCost,
      monthlyProfit: latest.monthlyProfit,
      profitMargin: latest.profitMargin,
      profitMarginReason: latest.profitMarginReason,
      irr: latest.irr,
      irrReason: latest.irrReason,
      monthlyVolume: latest.monthlyVolume,
      monthlyMileage: latest.monthlyMileage,
      firstPositiveMonth: latest.firstPositiveMonth,
      cumulativeCashFlow: latest.cumulativeCashFlow,
      costBreakdown: payload.costBreakdown,
      routes: payload.routes,
      warnings: payload.warnings,
    }),
    analysis: workspace.analysisResults[0] ?? null,
    risks: workspace.riskResults[0] ?? null,
    schemeId: workspace.schemeId,
    schema_version: CALCULATION_RESULT_SCHEMA_VERSION,
  };
}

export { freightUnitLabel };
