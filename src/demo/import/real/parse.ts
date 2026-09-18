import { FIELD_GROUPS, FIELD_LABELS, REQUIRED_IMPORT_FIELDS, type ExtractedParameter, type ImportFieldKey, type ParameterSource } from "../types";
import { mergeExtractedParameters, type ParseFileResult } from "../parser-adapter";
import type { DocumentChunk } from "./chunks";
import { extractDocumentChunks } from "./chunks";
import {
  DeterministicContentExtractor,
  chunkMentionsInjection,
  createLlmDocumentExtractor,
  validateExtractItems,
  type AiDocumentExtractor,
  type ExtractItem,
  type LlmConfig,
} from "./extractor";
import { PARAMETER_REGISTRY, REGISTRY_BY_FIELD } from "./registry";

export type RealFileInput = {
  fileId: string;
  fileName: string;
  mimeType?: string;
  bytes: Uint8Array;
};

export type ProjectCatalogItem = {
  projectId: string;
  projectName: string;
  customer?: string;
  region?: string;
};

export type RealParseFileStatus = {
  fileId: string;
  fileName: string;
  status: "PARSED" | "FAILED";
  errorMessage?: string;
  warnings: string[];
  parserMode: "real";
};

export type RealParseOutcome = {
  ok: boolean;
  mode: "real";
  stages: string[];
  files: RealParseFileStatus[];
  parameters: ExtractedParameter[];
  suggestedProjectName?: string;
  projectCandidates: ProjectCatalogItem[];
  ai: "deterministic" | "llm" | "llm_failed_deterministic";
  injectionSeen: boolean;
  rejectedFields: string[];
};

function sourceFrom(chunk: DocumentChunk | undefined, fileName: string, fileId: string, originalText?: string): ParameterSource {
  return {
    fileId,
    fileName,
    sheetName: chunk?.location?.sheetName,
    page: chunk?.location?.page,
    cellRange: chunk?.location?.cellRange,
    paragraph: chunk?.location?.paragraph,
    table: chunk?.location?.table,
    originalText,
  };
}

function toParameter(item: ExtractItem, chunk: DocumentChunk | undefined, fileId: string, fileName: string): ExtractedParameter | null {
  const field = item.field as ImportFieldKey;
  const def = REGISTRY_BY_FIELD.get(field);
  if (!def) return null;
  const status = item.fact === "INFERRED" ? "INFERRED" : item.unitUnresolved ? "EXTRACTED" : "EXTRACTED";
  return {
    field,
    label: FIELD_LABELS[field],
    value: item.rawValue,
    normalizedValue: item.unitUnresolved ? null : (item.normalizedValue ?? item.rawValue),
    unit: item.unit || def.canonicalUnit,
    originalUnit: item.rawUnit,
    originalText: chunk?.text,
    status,
    confidence: item.confidence,
    sources: [sourceFrom(chunk, fileName, fileId, chunk?.text)],
    required: REQUIRED_IMPORT_FIELDS.includes(field),
    group: FIELD_GROUPS[field],
    inferReason: item.fact === "INFERRED" ? item.reason : undefined,
    unitUnresolved: item.unitUnresolved,
    valueOrigin: item.fact === "INFERRED" ? "INFERRED" : "DOCUMENT",
  };
}

export function matchProjectCandidates(
  catalog: ProjectCatalogItem[],
  extracted: { projectName?: string; customer?: string; region?: string },
): ProjectCatalogItem[] {
  const name = extracted.projectName?.trim();
  const customer = extracted.customer?.trim();
  return catalog.filter((p) => {
    if (!p.projectId || !p.projectName) return false;
    const byName =
      !!name &&
      name.length >= 4 &&
      (p.projectName === name || (p.projectName.includes(name) && name.length >= 6) || (name.includes(p.projectName) && p.projectName.length >= 6));
    const byCustomer = !!customer && !!p.customer && customer.length >= 2 && p.customer === customer && (!extracted.region || !p.region || p.region === extracted.region);
    return byName || byCustomer;
  });
}

function offerDefaults(parameters: ExtractedParameter[]): ExtractedParameter[] {
  const present = new Set(parameters.map((p) => p.field));
  const next = parameters.map((p) => ({ ...p }));
  for (const def of PARAMETER_REGISTRY) {
    if (def.systemDefault == null || present.has(def.field)) continue;
    next.push({
      field: def.field,
      label: def.label,
      value: null,
      normalizedValue: null,
      unit: def.canonicalUnit,
      status: "MISSING",
      sources: [],
      required: def.required,
      group: FIELD_GROUPS[def.field],
      offerSystemDefault: true,
      systemDefault: def.systemDefault,
    });
    present.add(def.field);
  }
  return next;
}

export async function parseRealDocuments(
  files: RealFileInput[],
  options: {
    projects?: ProjectCatalogItem[];
    extractor?: AiDocumentExtractor;
    llm?: LlmConfig;
  } = {},
): Promise<RealParseOutcome> {
  const stages = ["资料上传成功", "读取文件", "识别测算参数", "合并资料", "解析完成"];
  const fileStatuses: RealParseFileStatus[] = [];
  const batches: ParseFileResult[] = [];
  const allChunks: DocumentChunk[] = [];
  let rejectedFields: string[] = [];
  let ai: RealParseOutcome["ai"] = "deterministic";

  for (const file of files) {
    const extracted = await extractDocumentChunks(file, file.bytes);
    if (!extracted.ok) {
      fileStatuses.push({
        fileId: file.fileId,
        fileName: file.fileName,
        status: "FAILED",
        errorMessage: extracted.errorMessage,
        warnings: extracted.warnings,
        parserMode: "real",
      });
      batches.push({ fileId: file.fileId, ok: false, mode: "real", errorMessage: extracted.errorMessage, parameters: [] });
      continue;
    }
    fileStatuses.push({
      fileId: file.fileId,
      fileName: file.fileName,
      status: "PARSED",
      warnings: extracted.warnings,
      parserMode: "real",
    });
    allChunks.push(...extracted.chunks);
    const base = new DeterministicContentExtractor();
    const request = {
      chunks: extracted.chunks,
      fields: PARAMETER_REGISTRY.map((d) => ({ field: d.field, label: d.label, aliases: d.aliases })),
    };
    const deterministic = validateExtractItems((await base.extract(request)).items, extracted.chunks);
    rejectedFields = rejectedFields.concat(deterministic.rejected);
    let items = deterministic.items;
    const extra = options.extractor;
    const llm = !extra && options.llm?.apiKey ? createLlmDocumentExtractor(options.llm) : extra;
    if (llm) {
      try {
        const remote = validateExtractItems((await llm.extract(request)).items, extracted.chunks);
        rejectedFields = rejectedFields.concat(remote.rejected);
        const explicit = new Set(items.filter((i) => i.fact === "EXPLICIT").map((i) => `${i.field}|${i.normalizedValue}`));
        for (const item of remote.items) {
          if (explicit.has(`${item.field}|${item.normalizedValue}`)) continue;
          items.push(item);
        }
        ai = extra ? "llm" : "llm";
      } catch {
        ai = "llm_failed_deterministic";
      }
    }

    const parameters: ExtractedParameter[] = [];
    const chunkById = new Map(extracted.chunks.map((c) => [c.id, c]));
    for (const item of items) {
      const param = toParameter(item, item.chunkId ? chunkById.get(item.chunkId) : undefined, file.fileId, file.fileName);
      if (param) parameters.push(param);
      if (item.freightPriceUnit) {
        parameters.push({
          field: "freightPriceUnit",
          label: FIELD_LABELS.freightPriceUnit,
          value: item.freightPriceUnit,
          normalizedValue: item.freightPriceUnit,
          status: "EXTRACTED",
          sources: [sourceFrom(item.chunkId ? chunkById.get(item.chunkId) : undefined, file.fileName, file.fileId, item.rawUnit)],
          required: false,
          group: "revenue",
          valueOrigin: "DOCUMENT",
        });
      }
    }
    const project = parameters.find((p) => p.field === "projectName");
    batches.push({
      fileId: file.fileId,
      ok: true,
      mode: "real",
      parameters,
      suggestedProjectName: project ? String(project.normalizedValue || "") : undefined,
    });
  }

  let parameters = offerDefaults(mergeExtractedParameters(batches));
  const name = parameters.find((p) => p.field === "projectName" && p.status !== "CONFLICT");
  const customer = parameters.find((p) => p.field === "customer" && p.status !== "CONFLICT");
  const region = parameters.find((p) => p.field === "region" && p.status !== "CONFLICT");
  const projectCandidates = matchProjectCandidates(options.projects || [], {
    projectName: name?.normalizedValue ? String(name.normalizedValue) : undefined,
    customer: customer?.normalizedValue ? String(customer.normalizedValue) : undefined,
    region: region?.normalizedValue ? String(region.normalizedValue) : undefined,
  });

  return {
    ok: fileStatuses.some((f) => f.status === "PARSED") || files.length === 0,
    mode: "real",
    stages,
    files: fileStatuses,
    parameters,
    suggestedProjectName: name?.normalizedValue ? String(name.normalizedValue) : batches.find((b) => b.suggestedProjectName)?.suggestedProjectName,
    projectCandidates,
    ai,
    injectionSeen: chunkMentionsInjection(allChunks),
    rejectedFields,
  };
}
