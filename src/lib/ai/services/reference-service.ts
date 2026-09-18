import { prisma } from "@/lib/db";
import { FORBIDDEN_AUTOCOMPLETE_FIELDS, getField } from "../schema/field-dictionary";
import { DEMO_REFERENCES } from "../demo-reference";
import type { ReferenceCandidate } from "../schema/types";

const STANDARD_PARAM_BY_FIELD: Record<string, string> = {
  "energy.loaded_consumption": "STD_LOADED_ENERGY",
  "energy.empty_consumption": "STD_EMPTY_ENERGY",
  "energy.electricity_price": "STD_ELECTRICITY_PRICE",
};

export async function getReferenceValue(fieldCode: string): Promise<{ configured: boolean; candidates: ReferenceCandidate[] }> {
  const def = getField(fieldCode);
  if (!def) return { configured: false, candidates: [] };
  if (FORBIDDEN_AUTOCOMPLETE_FIELDS.includes(fieldCode) || def.aiCompletable === "forbidden") {
    return { configured: true, candidates: [] };
  }
  const demo = DEMO_REFERENCES.filter((item) => item.field_code === fieldCode);
  const stdCode = STANDARD_PARAM_BY_FIELD[fieldCode];
  let system: ReferenceCandidate[] = [];
  try {
    const std = stdCode
      ? await prisma.standardParameter.findFirst({ where: { parameterCode: stdCode, enabled: true } })
      : null;
    system = std
      ? [
          {
            field_code: fieldCode,
            suggested_value: std.value,
            range_min: null,
            range_max: null,
            source_level: "system_default",
            sample_size: null,
            statistic_method: "platform_default",
            source_updated_at: std.effectiveDate.toISOString(),
            applicable_condition: "系统默认值，仅作最后兜底，必须醒目标识。",
            confidence_level: "default_only",
            status: "unused",
          },
        ]
      : [];
  } catch {
    system = [];
  }
  return { configured: true, candidates: [...demo, ...system] };
}

export async function listDemoAndSystemReferences() {
  const codes = Array.from(new Set([...DEMO_REFERENCES.map((i) => i.field_code), ...Object.keys(STANDARD_PARAM_BY_FIELD)]));
  const rows = await Promise.all(codes.map((code) => getReferenceValue(code)));
  return rows.flatMap((row) => row.candidates);
}
