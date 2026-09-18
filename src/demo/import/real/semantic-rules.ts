/**
 * 规则层语义提取：保留修饰、区间、时间口径。
 * 不计算 KPI，不在多候选里静默选值。
 */
import type { DocumentChunk } from "./chunks";
import type { ExtractItem } from "./extractor";
import { normalizeByField } from "./unit-normalizer";

export type SemanticHit = {
  items: ExtractItem[];
  unresolved: string[];
};

const NON_VALUE = /^(不变|同上|同前|待定|未知|暂无|见上|见附件|按之前|之前方案|按原方案)/;

export function isNonValuePhrase(value: string): boolean {
  return NON_VALUE.test(value.trim());
}

function sentenceOf(text: string, index: number): string {
  const start = Math.max(0, text.lastIndexOf("。", index), text.lastIndexOf("\n", index), text.lastIndexOf("；", index));
  const endCandidates = ["。", "\n", "；"].map((mark) => {
    const at = text.indexOf(mark, index);
    return at === -1 ? text.length : at;
  });
  const end = Math.min(...endCandidates);
  return text.slice(start === 0 ? 0 : start + 1, end).trim();
}

function pushUnique(items: ExtractItem[], item: ExtractItem) {
  const key = [
    item.field,
    item.chunkId,
    item.qualifier || "",
    item.timeContext || "",
    item.valueRange ? `${item.valueRange.min}~${item.valueRange.max}` : "",
    String(item.normalizedValue ?? item.rawValue),
  ].join("|");
  if (items.some((exist) => {
    const existKey = [
      exist.field,
      exist.chunkId,
      exist.qualifier || "",
      exist.timeContext || "",
      exist.valueRange ? `${exist.valueRange.min}~${exist.valueRange.max}` : "",
      String(exist.normalizedValue ?? exist.rawValue),
    ].join("|");
    return existKey === key;
  })) return;
  items.push(item);
}

function numericItem(
  chunk: DocumentChunk,
  field: string,
  value: number,
  unit: string | undefined,
  evidence: string,
  extra: Partial<ExtractItem> = {},
): ExtractItem | null {
  const norm = normalizeByField(field, value, unit);
  if (!extra.valueRange) {
    if (!norm.ok && field !== "electricityPrice") return null;
  }
  return {
    field,
    fact: extra.fact || "EXPLICIT",
    rawValue: extra.valueRange ? `${extra.valueRange.min}~${extra.valueRange.max}` : value,
    rawUnit: unit,
    normalizedValue: extra.valueRange ? null : norm.ok ? norm.normalizedValue : null,
    unit: norm.unit || unit,
    unitUnresolved: extra.valueRange ? false : !norm.ok,
    freightPriceUnit: norm.freightPriceUnit,
    chunkId: chunk.id,
    evidenceText: evidence,
    confidence: extra.confidence ?? 0.86,
    reason: extra.reason || norm.reason,
    qualifier: extra.qualifier,
    valueRange: extra.valueRange,
    timeContext: extra.timeContext,
    derivation: extra.derivation,
    source: "rule",
  };
}

export function extractSemanticCandidates(chunks: DocumentChunk[], allowed: Set<string>): SemanticHit {
  const items: ExtractItem[] = [];
  const unresolved: string[] = [];

  for (const chunk of chunks) {
    const text = chunk.text || "";
    if (!text.trim()) continue;

    if (allowed.has("fleetSize")) {
      const fleetPatterns: { re: RegExp; qualifier: string; timeContext: ExtractItem["timeContext"] }[] = [
        { re: /首批(?:计划)?(?:投入)?\s*(\d+(?:\.\d+)?)\s*(?:辆|台)/g, qualifier: "首批计划", timeContext: "current" },
        { re: /(?:后续|而后)(?:根据货量)?(?:增加|扩充)至\s*(\d+(?:\.\d+)?)\s*(?:辆|台)/g, qualifier: "后续规划", timeContext: "planned" },
        { re: /规划(?:至|为|投入)?\s*(\d+(?:\.\d+)?)\s*(?:辆|台)/g, qualifier: "规划", timeContext: "planned" },
        { re: /最大可投入\s*(\d+(?:\.\d+)?)\s*(?:辆|台)/g, qualifier: "最大可投入", timeContext: "planned" },
      ];
      for (const pattern of fleetPatterns) {
        for (const matched of text.matchAll(pattern.re)) {
          const value = Number(matched[1]);
          const evidence = sentenceOf(text, matched.index ?? 0);
          const item = numericItem(chunk, "fleetSize", value, "台", evidence, {
            qualifier: pattern.qualifier,
            timeContext: pattern.timeContext,
            reason: `识别到${pattern.qualifier}，不得静默改用其他车辆数`,
          });
          if (item) pushUnique(items, item);
        }
      }
    }

    if (allowed.has("distanceKm")) {
      for (const matched of text.matchAll(/(?:单程|单边|运距)?(?:约|大约)?\s*(\d+(?:\.\d+)?)\s*[~～\-到至]\s*(\d+(?:\.\d+)?)\s*(?:公里|km|千米)/g)) {
        const min = Number(matched[1]);
        const max = Number(matched[2]);
        if (!(max > min)) continue;
        const evidence = sentenceOf(text, matched.index ?? 0);
        const item = numericItem(chunk, "distanceKm", min, "公里", evidence, {
          qualifier: /往返/.test(evidence) ? "往返区间" : "单程",
          valueRange: { min, max },
          reason: "资料给出区间，不得取最大、最小或平均值",
          confidence: 0.9,
        });
        if (item && !/往返/.test(matched[0])) pushUnique(items, item);
      }
      for (const matched of text.matchAll(/单程(?:约|大约)?\s*(\d+(?:\.\d+)?)\s*(?:公里|km|千米)/g)) {
        const evidence = sentenceOf(text, matched.index ?? 0);
        const item = numericItem(chunk, "distanceKm", Number(matched[1]), "公里", evidence, {
          qualifier: "单程",
          timeContext: "current",
          reason: "按引擎单程里程口径提取，不采用往返",
        });
        if (item) pushUnique(items, item);
      }
      for (const matched of text.matchAll(/地图导航(?:约|大约)?\s*(\d+(?:\.\d+)?)\s*(?:公里|km|千米)?/g)) {
        const evidence = sentenceOf(text, matched.index ?? 0);
        const item = numericItem(chunk, "distanceKm", Number(matched[1]), "公里", evidence, {
          qualifier: "地图导航",
          reason: "地图导航里程，需与业务估算确认",
        });
        if (item) pushUnique(items, item);
      }
      for (const matched of text.matchAll(/业务估算(?:约|大约)?\s*(\d+(?:\.\d+)?)\s*(?:公里|km|千米)?/g)) {
        const evidence = sentenceOf(text, matched.index ?? 0);
        const item = numericItem(chunk, "distanceKm", Number(matched[1]), "公里", evidence, {
          qualifier: "业务估算",
          reason: "业务估算里程，需与地图导航确认",
        });
        if (item) pushUnique(items, item);
      }
      for (const matched of text.matchAll(/往返(?:约|大约)?\s*(\d+(?:\.\d+)?)\s*(?:公里|km|千米)/g)) {
        unresolved.push(`往返${matched[1]}公里不写入单程里程`);
      }
    }

    if (allowed.has("electricityPrice")) {
      const pricePatterns: { re: RegExp; qualifier: string }[] = [
        { re: /谷(?:段|电)(?:约|大约)?\s*(\d+(?:\.\d+)?)\s*元/g, qualifier: "谷电" },
        { re: /峰(?:段|电)(?:约|大约)?\s*(\d+(?:\.\d+)?)\s*元/g, qualifier: "峰电" },
        { re: /综合电价预计\s*(\d+(?:\.\d+)?)\s*元/g, qualifier: "综合预计" },
        { re: /电价调整为\s*(\d+(?:\.\d+)?)/g, qualifier: "调整后" },
      ];
      for (const pattern of pricePatterns) {
        for (const matched of text.matchAll(pattern.re)) {
          const evidence = sentenceOf(text, matched.index ?? 0);
          const item = numericItem(chunk, "electricityPrice", Number(matched[1]), "元/度", evidence, {
            qualifier: pattern.qualifier,
            timeContext: "current",
            reason: `${pattern.qualifier}电价，峰谷价不得覆盖综合口径`,
          });
          if (item) pushUnique(items, item);
        }
      }
    }

    if (allowed.has("freightPrice")) {
      const freightPatterns: { re: RegExp; qualifier: string; timeContext: ExtractItem["timeContext"] }[] = [
        { re: /原合同按\s*(\d+(?:\.\d+)?)\s*元\s*\/\s*吨/g, qualifier: "原合同", timeContext: "historical" },
        { re: /暂按\s*(\d+(?:\.\d+)?)\s*元\s*\/\s*吨/g, qualifier: "当前暂按", timeContext: "current" },
        { re: /目标谈判价\s*(\d+(?:\.\d+)?)\s*元/g, qualifier: "目标谈判价", timeContext: "planned" },
      ];
      for (const pattern of freightPatterns) {
        for (const matched of text.matchAll(pattern.re)) {
          const evidence = sentenceOf(text, matched.index ?? 0);
          const item = numericItem(chunk, "freightPrice", Number(matched[1]), "元/吨", evidence, {
            qualifier: pattern.qualifier,
            timeContext: pattern.timeContext,
            reason: "运价存在历史/当前/目标口径，不得静默覆盖",
          });
          if (item) pushUnique(items, item);
        }
      }
    }

    if (allowed.has("monthlyRentPerVehicle")) {
      for (const matched of text.matchAll(/(?<!不)含税(?:报价)?\s*(\d+(?:\.\d+)?)\s*元/g)) {
        const evidence = sentenceOf(text, matched.index ?? 0);
        const item = numericItem(chunk, "monthlyRentPerVehicle", Number(matched[1]), "元/车/月", evidence, {
          qualifier: "含税",
          reason: "含税与未税并存，无规则时不得代选",
        });
        if (item) pushUnique(items, item);
      }
      for (const matched of text.matchAll(/不含税(?:价格|报价)?\s*(\d+(?:\.\d+)?)\s*元/g)) {
        const evidence = sentenceOf(text, matched.index ?? 0);
        const item = numericItem(chunk, "monthlyRentPerVehicle", Number(matched[1]), "元/车/月", evidence, {
          qualifier: "未税",
          reason: "含税与未税并存，无规则时不得代选",
        });
        if (item) pushUnique(items, item);
      }
    }

    if (allowed.has("loadTon")) {
      for (const matched of text.matchAll(/通常(?:装|载重|装载)?\s*(\d+(?:\.\d+)?)\s*吨/g)) {
        const evidence = sentenceOf(text, matched.index ?? 0);
        const item = numericItem(chunk, "loadTon", Number(matched[1]), "吨", evidence, {
          qualifier: "通常",
          timeContext: "current",
          reason: "通常载重，极端值不得静默覆盖",
        });
        if (item) pushUnique(items, item);
      }
      for (const matched of text.matchAll(/极端(?:情况下)?(?:可以|可)?(?:到|达)\s*(\d+(?:\.\d+)?)\s*吨/g)) {
        const evidence = sentenceOf(text, matched.index ?? 0);
        const item = numericItem(chunk, "loadTon", Number(matched[1]), "吨", evidence, {
          qualifier: "极端",
          reason: "极端载重仅作候选",
        });
        if (item) pushUnique(items, item);
      }
    }

    if (allowed.has("tripsPerVehicleMonth")) {
      const daily = /每(?:天|日)\s*(\d+(?:\.\d+)?)\s*趟/.exec(text);
      const days = /每月(?:预计)?运营\s*(\d+(?:\.\d+)?)\s*天/.exec(text);
      if (daily && days) {
        const perDay = Number(daily[1]);
        const operateDays = Number(days[1]);
        const monthTrips = perDay * operateDays;
        const evidence = sentenceOf(text, daily.index ?? 0);
        const item = numericItem(chunk, "tripsPerVehicleMonth", monthTrips, "趟", evidence, {
          fact: "INFERRED",
          qualifier: "日趟次换算",
          derivation: `每天${perDay}趟 × 每月运营${operateDays}天 = ${monthTrips}趟/月，由确定性规则换算，不是模型直接计算`,
          reason: `每天${perDay}趟 × 每月运营${operateDays}天 = ${monthTrips}趟/月，需人工确认`,
          confidence: 0.74,
        });
        if (item) pushUnique(items, item);
      }
    }
  }

  return { items, unresolved };
}
