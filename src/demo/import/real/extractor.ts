import type { DocumentChunk } from "./chunks";
import { PARAMETER_REGISTRY, REGISTRY_BY_FIELD, isBlockedField } from "./registry";
import { extractSemanticCandidates } from "./semantic-rules";
import { normalizeByField } from "./unit-normalizer";
import type { ImportFieldKey } from "../types";

export type ExtractFact = "EXPLICIT" | "INFERRED" | "NOT_FOUND";

export type ExtractTimeContext = "current" | "historical" | "planned" | "unknown";

export type ExtractItem = {
  field: string;
  fact: ExtractFact;
  rawValue: string | number | null;
  rawUnit?: string;
  normalizedValue?: string | number | null;
  unit?: string;
  unitUnresolved?: boolean;
  freightPriceUnit?: "PER_TON" | "PER_TRIP" | "PER_TON_KM";
  chunkId?: string;
  evidenceText?: string;
  confidence?: number;
  reason?: string;
  qualifier?: string;
  valueRange?: { min: number; max: number };
  timeContext?: ExtractTimeContext;
  derivation?: string;
  source?: "rule" | "llm";
};

export type ExtractUsage = {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  requests: number;
  failures: number;
};

export type ExtractRequest = {
  chunks: DocumentChunk[];
  fields: { field: string; label: string; aliases: string[] }[];
};

export type ExtractResponse = {
  items: ExtractItem[];
  unresolved?: string[];
  degraded?: boolean;
  usage?: ExtractUsage;
};

export interface AiDocumentExtractor {
  extract(input: ExtractRequest): Promise<ExtractResponse>;
}

const INJECTION_HINT = /忽略.{0,8}规则|monthlyProfit|月利润|调用\s*Tool|ignore previous|自动确认/i;

function escapeReg(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findExplicit(text: string, alias: string): { value: number; unit?: string } | null {
  const prefix = /[A-Za-z]/.test(alias)
    ? `(?:^|[^A-Za-z0-9])${escapeReg(alias)}(?![A-Za-z0-9])`
    : escapeReg(alias);
  const re = new RegExp(`${prefix}\\s*[:：=]?\\s*(-?\\d+(?:\\.\\d+)?)\\s*([^\\s,，;；。\\n]{0,16})?`, "i");
  const matched = re.exec(text);
  if (!matched) return null;
  const value = Number(matched[1]);
  if (!Number.isFinite(value)) return null;
  const unit = (matched[2] || "").replace(/[，,。.;；].*$/, "");
  return { value, unit: unit || undefined };
}

function findString(text: string, alias: string): string | null {
  const re = new RegExp(`${escapeReg(alias)}\\s*[:：]?\\s*([^\\n,，;；]{2,40})`);
  const matched = re.exec(text);
  const value = matched?.[1]?.trim();
  if (!value || /^-?\d+(?:\.\d+)?/.test(value)) return null;
  const cleaned = value.split(/\s{2,}/)[0]?.trim() || null;
  if (!cleaned || /^(不变|同上|同前|待定|未知|暂无|见上|按之前|之前方案)/.test(cleaned)) return null;
  return cleaned;
}

export class DeterministicContentExtractor implements AiDocumentExtractor {
  async extract(input: ExtractRequest): Promise<ExtractResponse> {
    const items: ExtractItem[] = [];
    const seen = new Set<string>();
    for (const def of PARAMETER_REGISTRY) {
      if (!input.fields.some((f) => f.field === def.field)) continue;
      for (const part of input.chunks) {
        if (!part.text.trim()) continue;
        if (def.dataType === "string") {
        for (const alias of [...def.aliases].sort((a, b) => b.length - a.length)) {
          const value = findString(part.text, alias);
          if (!value) continue;
          const key = `${def.field}|${part.id}|${value}`;
          if (seen.has(key)) continue;
          seen.add(key);
          items.push({
            field: def.field,
            fact: "EXPLICIT",
            rawValue: value,
            normalizedValue: value,
            chunkId: part.id,
            confidence: 0.9,
          });
          break;
        }
          continue;
        }
        for (const alias of [...def.aliases].sort((a, b) => b.length - a.length)) {
          const hit = findExplicit(part.text, alias);
          if (!hit) continue;
          const norm = normalizeByField(def.field, hit.value, hit.unit);
          if (def.min != null && norm.ok && typeof norm.normalizedValue === "number" && norm.normalizedValue < def.min) continue;
          if (def.max != null && norm.ok && typeof norm.normalizedValue === "number" && norm.normalizedValue > def.max) continue;
          const key = `${def.field}|${part.id}|${hit.value}|${hit.unit || ""}`;
          if (seen.has(key)) continue;
          seen.add(key);
          items.push({
            field: def.field,
            fact: "EXPLICIT",
            rawValue: hit.value,
            rawUnit: hit.unit,
            normalizedValue: norm.ok ? norm.normalizedValue : null,
            unit: norm.unit,
            unitUnresolved: !norm.ok,
            freightPriceUnit: norm.freightPriceUnit,
            chunkId: part.id,
            confidence: 0.92,
            reason: norm.reason,
          });
          break;
        }
      }
    }

    const hasMonths = items.some((i) => i.field === "operatingMonthsYear" && i.fact === "EXPLICIT");
    if (!hasMonths) {
      for (const part of input.chunks) {
        if (/每周运营\s*6\s*天/.test(part.text) && /全年/.test(part.text)) {
          items.push({
            field: "operatingMonthsYear",
            fact: "INFERRED",
            rawValue: null,
            normalizedValue: 12,
            unit: "月",
            chunkId: part.id,
            confidence: 0.55,
            reason: "资料只写每周运营 6 天、全年基本不停，推断年运营月数为 12，需人工确认",
          });
          break;
        }
      }
    }
    const semantic = extractSemanticCandidates(input.chunks, new Set(input.fields.map((field) => field.field)));
    for (const extra of semantic.items) {
      const same = items.find(
        (item) =>
          item.field === extra.field &&
          item.chunkId === extra.chunkId &&
          !item.valueRange &&
          !extra.valueRange &&
          String(item.normalizedValue ?? item.rawValue) === String(extra.normalizedValue ?? extra.rawValue),
      );
      if (same) {
        same.qualifier = same.qualifier || extra.qualifier;
        same.timeContext = same.timeContext || extra.timeContext;
        same.evidenceText = same.evidenceText || extra.evidenceText;
        same.derivation = same.derivation || extra.derivation;
        continue;
      }
      items.push(extra);
    }
    return { items, unresolved: semantic.unresolved };
  }
}

export function validateExtractItems(items: ExtractItem[], chunks: DocumentChunk[]): { items: ExtractItem[]; rejected: string[] } {
  const rejected: string[] = [];
  const chunkIds = new Set(chunks.map((c) => c.id));
  const kept: ExtractItem[] = [];
  for (const item of items) {
    if (isBlockedField(item.field) || item.field === "projectId") {
      rejected.push(item.field);
      continue;
    }
    if (item.fact !== "EXPLICIT" && item.fact !== "INFERRED" && item.fact !== "NOT_FOUND") {
      rejected.push(item.field);
      continue;
    }
    if (item.fact === "NOT_FOUND") continue;
    if (item.chunkId && !chunkIds.has(item.chunkId)) {
      rejected.push(`${item.field}:bad-source`);
      continue;
    }
    const def = REGISTRY_BY_FIELD.get(item.field as ImportFieldKey);
    if (!def) {
      rejected.push(item.field);
      continue;
    }
    if (item.fact === "INFERRED" && (item.normalizedValue == null || item.normalizedValue === "")) {
      rejected.push(`${item.field}:empty-infer`);
      continue;
    }
    kept.push(item);
  }
  return { items: kept, rejected };
}

export function chunkMentionsInjection(chunks: DocumentChunk[]): boolean {
  return chunks.some((c) => INJECTION_HINT.test(c.text));
}

const BATCH_CHARS = 3500;

export function batchChunks(chunks: DocumentChunk[], options: { maxChars?: number; maxChunks?: number } = {}): DocumentChunk[][] {
  const maxChars = options.maxChars ?? BATCH_CHARS;
  const maxChunks = options.maxChunks ?? 8;
  const batches: DocumentChunk[][] = [];
  let cur: DocumentChunk[] = [];
  let size = 0;
  for (const part of chunks) {
    const overflow = (size + part.text.length > maxChars || cur.length >= maxChunks) && cur.length > 0;
    if (overflow) {
      batches.push(cur);
      cur = [];
      size = 0;
    }
    cur.push(part);
    size += part.text.length;
  }
  if (cur.length) batches.push(cur);
  return batches;
}

export type LlmConfig = { apiKey: string; baseUrl: string; model: string };
