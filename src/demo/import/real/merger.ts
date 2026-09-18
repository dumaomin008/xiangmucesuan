/**
 * 规则候选与模型候选合并。模型不能无痕覆盖规则结果。
 */
import type { DocumentChunk } from "./chunks";
import { validateExtractItems, type ExtractItem } from "./extractor";

export type MergeResult = {
  items: ExtractItem[];
  rejected: string[];
  llmAccepted: number;
};

function compact(text: string): string {
  return text.replace(/\s+/g, "");
}

function valueKey(item: ExtractItem): string {
  if (item.valueRange) return `range:${item.valueRange.min}~${item.valueRange.max}`;
  return String(item.normalizedValue ?? item.rawValue ?? "");
}

function sameSemantic(a: ExtractItem, b: ExtractItem): boolean {
  const qa = a.qualifier || "";
  const qb = b.qualifier || "";
  if (qa && qb && qa !== qb) return false;
  const ta = a.timeContext || "";
  const tb = b.timeContext || "";
  if (ta && tb && ta !== tb) return false;
  return valueKey(a) === valueKey(b);
}

function evidenceInChunk(item: ExtractItem, chunks: DocumentChunk[]): boolean {
  if (!item.chunkId || !item.evidenceText?.trim()) return false;
  const chunk = chunks.find((part) => part.id === item.chunkId);
  if (!chunk) return false;
  const evidence = compact(item.evidenceText);
  if (evidence.length < 2) return false;
  return compact(chunk.text).includes(evidence.slice(0, Math.min(evidence.length, 40)));
}

export function mergeRuleAndLlm(ruleItems: ExtractItem[], llmItems: ExtractItem[], chunks: DocumentChunk[]): MergeResult {
  const checked = validateExtractItems(llmItems, chunks);
  const rejected = [...checked.rejected];
  const merged = ruleItems.map((item) => ({ ...item, source: item.source || ("rule" as const) }));
  let llmAccepted = 0;

  for (const raw of checked.items) {
    if (!raw.evidenceText?.trim() || !raw.chunkId) {
      rejected.push(`${raw.field}:no-evidence`);
      continue;
    }
    if (!evidenceInChunk(raw, chunks)) {
      rejected.push(`${raw.field}:evidence-mismatch`);
      continue;
    }
    const roundTrip = /往返/.test(`${raw.qualifier || ""}${raw.evidenceText || ""}`);
    const oneWay = /单程|单边/.test(raw.qualifier || "");
    if (raw.field === "distanceKm" && roundTrip && !oneWay) {
      rejected.push("distanceKm:round-trip");
      continue;
    }
    if (raw.field === "tripsPerVehicleMonth") {
      const daily = /每(?:天|日)(?:[^0-9趟]{0,12})?(\d+(?:\.\d+)?)\s*趟/.exec(raw.evidenceText || "");
      if (daily && Math.abs(Number(raw.normalizedValue) - Number(daily[1])) < 0.001) {
        rejected.push("tripsPerVehicleMonth:daily-as-month");
        continue;
      }
    }
    if (!raw.valueRange && raw.evidenceText) {
      const ranged = raw.evidenceText.match(/(\d+(?:\.\d+)?)\s*[~～]\s*(\d+(?:\.\d+)?)/);
      const picked = Number(raw.normalizedValue);
      if (ranged && (picked === Number(ranged[1]) || picked === Number(ranged[2]))) {
        rejected.push(`${raw.field}:range-endpoint`);
        continue;
      }
    }
    if (raw.valueRange && raw.normalizedValue != null && raw.normalizedValue !== "") {
      rejected.push(`${raw.field}:range-collapsed`);
      raw.normalizedValue = null;
    }

    const twin = merged.find((item) => item.field === raw.field && sameSemantic(item, raw));
    if (twin) {
      twin.confidence = Math.min(0.99, Math.max(twin.confidence || 0, raw.confidence || 0) + 0.04);
      twin.evidenceText = twin.evidenceText || raw.evidenceText;
      twin.qualifier = twin.qualifier || raw.qualifier;
      twin.timeContext = twin.timeContext || raw.timeContext;
      twin.reason = [twin.reason, "规则与模型同值同语义，已合并来源"].filter(Boolean).join("；");
      twin.source = "rule";
      llmAccepted += 1;
      continue;
    }

    merged.push({
      ...raw,
      source: "llm",
      normalizedValue: raw.valueRange ? null : raw.normalizedValue,
      reason: raw.fact === "INFERRED"
        ? raw.reason || "模型推断，需人工确认"
        : [raw.reason, "模型候选，未覆盖规则结果"].filter(Boolean).join("；"),
    });
    llmAccepted += 1;
  }

  return { items: merged, rejected, llmAccepted };
}
