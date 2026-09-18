import { FIELD_GROUPS, FIELD_LABELS, REQUIRED_IMPORT_FIELDS, type ExtractedParameter, type ImportFieldKey, type ParameterSource } from "../types";
import { mergeExtractedParameters, type ParseFileResult } from "../parser-adapter";
import { createId } from "../../utils";
import type { DocumentChunk } from "./chunks";
import { extractDocumentChunks } from "./chunks";
import { createLlmDocumentExtractor } from "./ai-provider";
import {
  DeterministicContentExtractor,
  chunkMentionsInjection,
  validateExtractItems,
  type AiDocumentExtractor,
  type ExtractItem,
  type ExtractUsage,
  type LlmConfig,
} from "./extractor";
import { mergeRuleAndLlm } from "./merger";
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
  usage?: ExtractUsage;
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
  const evidence = item.evidenceText || chunk?.text;
  const status = item.fact === "INFERRED"
    ? "INFERRED"
    : item.valueRange
      ? "NEED_CONFIRMATION"
      : "EXTRACTED";
  const source = sourceFrom(chunk, fileName, fileId, evidence);
  const alternatives = item.valueRange
    ? rangeChoices(item.valueRange, item.unit || def.canonicalUnit, source)
    : undefined;
  return {
    field,
    label: FIELD_LABELS[field],
    value: item.valueRange ? null : item.rawValue,
    normalizedValue: item.valueRange || item.unitUnresolved ? null : (item.normalizedValue ?? item.rawValue),
    unit: item.unit || def.canonicalUnit,
    originalUnit: item.rawUnit,
    originalText: evidence,
    status,
    confidence: item.confidence,
    sources: [source],
    alternatives,
    required: REQUIRED_IMPORT_FIELDS.includes(field),
    group: FIELD_GROUPS[field],
    inferReason: item.fact === "INFERRED" ? item.derivation || item.reason : undefined,
    qualifier: item.qualifier,
    valueRange: item.valueRange,
    timeContext: item.timeContext,
    derivation: item.derivation,
    unitUnresolved: item.unitUnresolved,
    valueOrigin: item.fact === "INFERRED" ? "INFERRED" : "DOCUMENT",
  };
}

function rangeChoices(
  range: { min: number; max: number },
  unit: string | undefined,
  source: ParameterSource,
): ExtractedParameter["alternatives"] {
  const mid = Math.round(((range.min + range.max) / 2) * 1000) / 1000;
  return [
    { value: range.min, unit, source, qualifier: "区间下限" },
    { value: mid, unit, source, qualifier: "区间中值（需点选，系统不自动采用）" },
    { value: range.max, unit, source, qualifier: "区间上限" },
  ];
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

async function parsePreparedChunks(
  files: RealFileInput[],
  chunksByFile: Map<string, DocumentChunk[]>,
  options: {
    projects?: ProjectCatalogItem[];
    extractor?: AiDocumentExtractor;
    llm?: LlmConfig;
  },
  presetStatuses: RealParseFileStatus[] = [],
  presetFailed: ParseFileResult[] = [],
): Promise<RealParseOutcome> {
  const stages = ["资料上传成功", "读取文件", "识别测算参数", "合并资料", "解析完成"];
  const fileStatuses = [...presetStatuses];
  const batches: ParseFileResult[] = [...presetFailed];
  const allChunks: DocumentChunk[] = [];
  let rejectedFields: string[] = [];
  let ai: RealParseOutcome["ai"] = "deterministic";
  let usage: ExtractUsage | undefined;

  for (const file of files) {
    const chunks = chunksByFile.get(file.fileId);
    if (!chunks) continue;
    if (!fileStatuses.some((status) => status.fileId === file.fileId)) {
      fileStatuses.push({ fileId: file.fileId, fileName: file.fileName, status: "PARSED", warnings: [], parserMode: "real" });
    }
    allChunks.push(...chunks);
    const base = new DeterministicContentExtractor();
    const request = {
      chunks,
      fields: PARAMETER_REGISTRY.map((d) => ({ field: d.field, label: d.label, aliases: d.aliases })),
    };
    const deterministic = validateExtractItems((await base.extract(request)).items, chunks);
    rejectedFields = rejectedFields.concat(deterministic.rejected);
    let items = deterministic.items;
    const extra = options.extractor;
    const llm = !extra && options.llm?.apiKey ? createLlmDocumentExtractor(options.llm) : extra;
    if (llm) {
      try {
        const remote = await llm.extract(request);
        if (remote.usage) {
          usage = {
            promptTokens: (usage?.promptTokens || 0) + remote.usage.promptTokens,
            completionTokens: (usage?.completionTokens || 0) + remote.usage.completionTokens,
            totalTokens: (usage?.totalTokens || 0) + remote.usage.totalTokens,
            requests: (usage?.requests || 0) + remote.usage.requests,
            failures: (usage?.failures || 0) + remote.usage.failures,
          };
        }
        const merged = mergeRuleAndLlm(items, remote.items || [], chunks);
        rejectedFields = rejectedFields.concat(merged.rejected);
        items = merged.items;
        ai = merged.llmAccepted > 0 && !remote.degraded ? "llm" : "llm_failed_deterministic";
      } catch {
        ai = "llm_failed_deterministic";
      }
    }

    const parameters: ExtractedParameter[] = [];
    const chunkById = new Map(chunks.map((c) => [c.id, c]));
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

  const parameters = offerDefaults(mergeExtractedParameters(batches));
  const name = parameters.find((p) => p.field === "projectName" && p.status !== "CONFLICT" && p.status !== "NEED_CONFIRMATION");
  const customer = parameters.find((p) => p.field === "customer" && p.status !== "CONFLICT" && p.status !== "NEED_CONFIRMATION");
  const region = parameters.find((p) => p.field === "region" && p.status !== "CONFLICT" && p.status !== "NEED_CONFIRMATION");
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
    usage,
  };
}

export async function parseRealDocuments(
  files: RealFileInput[],
  options: {
    projects?: ProjectCatalogItem[];
    extractor?: AiDocumentExtractor;
    llm?: LlmConfig;
  } = {},
): Promise<RealParseOutcome> {
  const chunksByFile = new Map<string, DocumentChunk[]>();
  const fileStatuses: RealParseFileStatus[] = [];
  const failed: ParseFileResult[] = [];
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
      failed.push({ fileId: file.fileId, ok: false, mode: "real", errorMessage: extracted.errorMessage, parameters: [] });
      continue;
    }
    fileStatuses.push({
      fileId: file.fileId,
      fileName: file.fileName,
      status: "PARSED",
      warnings: extracted.warnings,
      parserMode: "real",
    });
    chunksByFile.set(file.fileId, extracted.chunks);
  }
  const outcome = await parsePreparedChunks(files, chunksByFile, options, fileStatuses, failed);
  return outcome;
}

/** 验收用：同一套规则 + 模型合并，输入为已分块的纯文本，不走文件解析。 */
export async function parseTextDocuments(
  files: { fileId: string; fileName: string; text: string }[],
  options: {
    extractor?: AiDocumentExtractor;
    llm?: LlmConfig;
  } = {},
): Promise<RealParseOutcome> {
  const asFiles: RealFileInput[] = files.map((file) => ({
    fileId: file.fileId,
    fileName: file.fileName,
    bytes: new Uint8Array(),
  }));
  const chunksByFile = new Map<string, DocumentChunk[]>();
  for (const file of files) {
    chunksByFile.set(file.fileId, [
      {
        id: createId("CHK"),
        fileId: file.fileId,
        fileName: file.fileName,
        documentType: file.fileName.toLowerCase().endsWith(".pdf") ? "pdf" : file.fileName.toLowerCase().endsWith(".xlsx") ? "excel" : "docx",
        text: file.text,
        location: file.fileName.toLowerCase().endsWith(".pdf") ? { page: 1 } : { paragraph: 1 },
      },
    ]);
  }
  return parsePreparedChunks(asFiles, chunksByFile, options);
}
