import { prisma } from "@/lib/db";
import { FORBIDDEN_AUTOCOMPLETE_FIELDS, getField } from "../schema/field-dictionary";
import { AI_REFERENCE_RULE_VERSION } from "../schema/versions";
import type { ReferenceCandidate } from "../schema/types";

const STANDARD_PARAM_BY_FIELD: Record<string, string> = {
  "energy.loaded_consumption": "STD_LOADED_ENERGY",
  "energy.empty_consumption": "STD_EMPTY_ENERGY",
  "energy.electricity_price": "STD_ELECTRICITY_PRICE",
};

/**
 * 参考值服务。
 * 历史项目/同线路/同车型检索规则尚未冻结，本轮只暴露：
 * 1. 禁止补全字段直接拒绝
 * 2. 已有标准参数库中的系统默认值（PRD 优先级 6），必须醒目标识
 */
export async function getReferenceValue(fieldCode: string): Promise<{ configured: boolean; candidates: ReferenceCandidate[] }> {
  const def = getField(fieldCode);
  if (!def) return { configured: false, candidates: [] };
  if (FORBIDDEN_AUTOCOMPLETE_FIELDS.includes(fieldCode) || def.aiCompletable === "forbidden") {
    return { configured: true, candidates: [] };
  }
  if (AI_REFERENCE_RULE_VERSION) {
    return { configured: false, candidates: [] };
  }
  const stdCode = STANDARD_PARAM_BY_FIELD[fieldCode];
  if (!stdCode) return { configured: false, candidates: [] };
  const std = await prisma.standardParameter.findFirst({ where: { parameterCode: stdCode, enabled: true } });
  if (!std) return { configured: false, candidates: [] };
  return {
    configured: true,
    candidates: [
      {
        field_code: fieldCode,
        suggested_value: std.value,
        range_min: null,
        range_max: null,
        source_level: "system_default",
        sample_size: null,
        statistic_method: "platform_default",
        source_updated_at: std.effectiveDate.toISOString(),
        applicable_condition: "系统默认值，仅作最后兜底，必须醒目标识。历史项目/车型规则尚未配置。",
        confidence_level: "default_only",
        status: "unused",
      },
    ],
  };
}
