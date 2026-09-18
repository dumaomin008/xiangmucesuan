/**
 * DocumentParserAdapter：正式解析器可替换，Demo 模式返回稳定结构化结果。
 * 禁止把假数据写死在 UI；解析结果只从本 Adapter / Tool 产出。
 */
import { createId, nowIso } from "../utils";
import { normalizeDistance, normalizeElectricity, parseValueWithUnit } from "./normalize";
import {
  FIELD_GROUPS,
  FIELD_LABELS,
  REQUIRED_IMPORT_FIELDS,
  type ExtractedParameter,
  type ImportFieldKey,
  type ImportFile,
  type ParameterSource,
} from "./types";

export type ParseFileResult = {
  fileId: string;
  ok: boolean;
  mode: "demo" | "live";
  errorMessage?: string;
  parameters: ExtractedParameter[];
  suggestedProjectName?: string;
};

function param(
  field: ImportFieldKey,
  value: string | number | null,
  status: ExtractedParameter["status"],
  sources: ParameterSource[],
  extras?: Partial<ExtractedParameter>,
): ExtractedParameter {
  return {
    field,
    label: FIELD_LABELS[field],
    value,
    normalizedValue: value,
    unit: extras?.unit,
    originalUnit: extras?.originalUnit,
    originalText: extras?.originalText,
    status,
    confidence: extras?.confidence,
    sources,
    alternatives: extras?.alternatives,
    required: REQUIRED_IMPORT_FIELDS.includes(field),
    group: FIELD_GROUPS[field],
    inferReason: extras?.inferReason,
  };
}

function source(file: ImportFile, patch: Partial<ParameterSource> = {}): ParameterSource {
  return { fileId: file.id, fileName: file.name, ...patch };
}

function parseTransportDemand(file: ImportFile): ParseFileResult {
  const elec = normalizeElectricity(0.68, "元/度");
  const dist = normalizeDistance(85, "公里");
  return {
    fileId: file.id,
    ok: true,
    mode: "demo",
    suggestedProjectName: "临港港区短倒电动化项目",
    parameters: [
      param("projectName", "临港港区短倒电动化项目", "EXTRACTED", [
        source(file, { sheetName: "项目概况", cellRange: "B2", originalText: "项目名称：临港港区短倒电动化项目" }),
      ], { confidence: 0.96, originalText: "临港港区短倒电动化项目" }),
      param("customer", "临港智运", "EXTRACTED", [
        source(file, { sheetName: "项目概况", cellRange: "B3", originalText: "客户：临港智运" }),
      ], { confidence: 0.94 }),
      param("region", "华东", "EXTRACTED", [
        source(file, { sheetName: "项目概况", cellRange: "B4", originalText: "区域：华东" }),
      ], { confidence: 0.9 }),
      param("fleetSize", 30, "EXTRACTED", [
        source(file, { sheetName: "车辆配置", cellRange: "B12", originalText: "预计投入新能源牵引车30台" }),
      ], { unit: "台", confidence: 0.98, originalText: "预计投入新能源牵引车30台" }),
      param("distanceKm", dist.normalizedValue, "EXTRACTED", [
        source(file, { sheetName: "线路", cellRange: "C5", originalText: "单程85公里" }),
      ], { unit: dist.unit, originalUnit: dist.originalUnit, originalText: dist.originalText, confidence: 0.95 }),
      param("loadTon", 32, "EXTRACTED", [
        source(file, { sheetName: "线路", cellRange: "C6", originalText: "额定载重32吨" }),
      ], { unit: "吨", confidence: 0.93, originalText: "额定载重32吨" }),
      param("tripsPerVehicleMonth", 28, "EXTRACTED", [
        source(file, { sheetName: "运力", cellRange: "D8", originalText: "单车月均28趟" }),
      ], { unit: "趟", confidence: 0.91 }),
      param("freightPrice", 120, "EXTRACTED", [
        source(file, { sheetName: "收入", cellRange: "E3", originalText: "运价120元/吨" }),
      ], { unit: "元", originalUnit: "元/吨", originalText: "运价120元/吨", confidence: 0.92 }),
      param("freightPriceUnit", "PER_TON", "EXTRACTED", [
        source(file, { sheetName: "收入", cellRange: "E4", originalText: "计价：按吨" }),
      ], { confidence: 0.88 }),
      param("routeName", "临港仓-码头短倒", "EXTRACTED", [
        source(file, { sheetName: "线路", cellRange: "A2", originalText: "线路：临港仓-码头短倒" }),
      ], { confidence: 0.9 }),
      param("originName", "临港仓", "EXTRACTED", [
        source(file, { sheetName: "线路", cellRange: "A3", originalText: "起点：临港仓" }),
      ], { confidence: 0.9 }),
      param("destinationName", "码头堆场", "EXTRACTED", [
        source(file, { sheetName: "线路", cellRange: "A4", originalText: "终点：码头堆场" }),
      ], { confidence: 0.9 }),
      param("electricityPrice", elec.normalizedValue, "EXTRACTED", [
        source(file, { sheetName: "能源", cellRange: "F2", originalText: "场站电价0.68元/度" }),
      ], {
        unit: elec.unit,
        originalUnit: elec.originalUnit,
        originalText: elec.originalText,
        confidence: 0.94,
      }),
      param("operatingMonthsYear", 12, "INFERRED", [
        source(file, { sheetName: "备注", originalText: "项目资料描述「每周运营6天、全年基本不停」" }),
      ], {
        unit: "月",
        confidence: 0.62,
        inferReason: "资料写「每周运营6天」，按全年推算约12个运营月（演示推断，需人工确认）",
      }),
      param("monthlyRentPerVehicle", null, "MISSING", [], { unit: "元" }),
      param("loadedEnergyConsumption", null, "MISSING", [], { unit: "kWh/km" }),
      param("driverCostPerTrip", null, "MISSING", [], { unit: "元/趟" }),
    ],
  };
}

function parseVehicleQuote(file: ImportFile): ParseFileResult {
  return {
    fileId: file.id,
    ok: true,
    mode: "demo",
    suggestedProjectName: "临港港区短倒电动化项目",
    parameters: [
      // 与运输需求车辆数冲突（演示：禁止 AI 静默选择）
      param("fleetSize", 32, "EXTRACTED", [
        source(file, { page: 3, originalText: "租赁方案建议投放牵引车 32 台" }),
      ], { unit: "台", confidence: 0.9, originalText: "租赁方案建议投放牵引车 32 台" }),
      // 月租留给对话补参演示
    ],
  };
}

function parseRouteQuote(file: ImportFile): ParseFileResult {
  // 补充同口径里程，不制造冲突，便于演示聚焦「车辆数冲突」
  const dist = normalizeDistance(85, "公里");
  return {
    fileId: file.id,
    ok: true,
    mode: "demo",
    parameters: [
      param("distanceKm", dist.normalizedValue, "EXTRACTED", [
        source(file, { sheetName: "报价", cellRange: "B10", originalText: "运输里程85公里（与需求书一致）" }),
      ], { unit: dist.unit, originalUnit: "公里", originalText: "运输里程85公里", confidence: 0.93 }),
    ],
  };
}

function parseCustomerDoc(file: ImportFile): ParseFileResult {
  return {
    fileId: file.id,
    ok: true,
    mode: "demo",
    parameters: [
      param("owner", "林晨", "EXTRACTED", [
        source(file, { originalText: "项目负责人：林晨" }),
      ], { confidence: 0.8 }),
      // 司机成本留给对话补参
    ],
  };
}

function parseImage(file: ImportFile): ParseFileResult {
  return {
    fileId: file.id,
    ok: true,
    mode: "demo",
    parameters: [
      param("loadedEnergyConsumption", 1.45, "EXTRACTED", [
        source(file, { originalText: "OCR：重载能耗约 1.45 kWh/km" }),
      ], { unit: "kWh/km", originalText: "OCR：重载能耗约 1.45 kWh/km", confidence: 0.7 }),
    ],
  };
}

/**
 * Demo 解析：按文件名路由稳定样例，保证领导演示可重复。
 * 含故意缺失/冲突/推断，供确认页演示。
 */
export function parseImportFileDemo(file: ImportFile): ParseFileResult {
  const name = file.name.toLowerCase();

  if (/fail|损坏|坏/.test(name)) {
    return {
      fileId: file.id,
      ok: false,
      mode: "demo",
      errorMessage: "演示适配器：该文件模拟解析失败，可重试或更换文件。",
      parameters: [],
    };
  }

  if (/运输需求|项目需求|需求书/.test(name)) return parseTransportDemand(file);
  if (/车辆|租赁/.test(name) && /报价|租赁|车辆/.test(name)) return parseVehicleQuote(file);
  if (/线路|路线/.test(name)) return parseRouteQuote(file);
  if (/说明|需求说明|\.docx?$/.test(name)) return parseCustomerDoc(file);
  if (/\.(png|jpe?g|webp)$/i.test(name) || /截图|图片/.test(name)) return parseImage(file);

  // 通用 fallback：最小可演示包
  const parsed = parseValueWithUnit("30台");
  return {
    fileId: file.id,
    ok: true,
    mode: "demo",
    parameters: [
      param("fleetSize", parsed.normalizedValue, "EXTRACTED", [
        source(file, { originalText: `演示解析：从「${file.name}」识别车辆数30台` }),
      ], { unit: "台", confidence: 0.5, originalText: "30台" }),
      param("monthlyRentPerVehicle", null, "MISSING", [], { unit: "元" }),
      param("electricityPrice", null, "MISSING", [], { unit: "元/kWh" }),
      param("distanceKm", null, "MISSING", [], { unit: "km" }),
      param("loadTon", null, "MISSING", [], { unit: "吨" }),
      param("tripsPerVehicleMonth", null, "MISSING", [], { unit: "趟" }),
      param("freightPrice", null, "MISSING", [], { unit: "元" }),
      param("loadedEnergyConsumption", null, "MISSING", [], { unit: "kWh/km" }),
      param("driverCostPerTrip", null, "MISSING", [], { unit: "元/趟" }),
    ],
  };
}

/** 合并多文件参数：同字段不同值 → CONFLICT */
export function mergeExtractedParameters(batches: ParseFileResult[]): ExtractedParameter[] {
  const map = new Map<string, ExtractedParameter>();

  for (const batch of batches) {
    if (!batch.ok) continue;
    for (const p of batch.parameters) {
      const existing = map.get(p.field);
      if (!existing) {
        map.set(p.field, {
          ...p,
          sources: [...p.sources],
          alternatives: p.alternatives ? [...p.alternatives] : undefined,
        });
        continue;
      }

      if (existing.status === "MISSING" && p.value != null && p.status !== "MISSING") {
        map.set(p.field, { ...p, sources: [...p.sources] });
        continue;
      }
      if (p.status === "MISSING") continue;

      const same =
        String(existing.normalizedValue ?? existing.value) === String(p.normalizedValue ?? p.value);
      if (same) {
        existing.sources = [...existing.sources, ...p.sources];
        if ((p.confidence ?? 0) > (existing.confidence ?? 0)) existing.confidence = p.confidence;
        continue;
      }

      const alternatives = [
        ...(existing.alternatives || [
          {
            value: existing.value,
            unit: existing.unit,
            source: existing.sources[0] || { fileId: "", fileName: "未知" },
          },
        ]),
        {
          value: p.value,
          unit: p.unit,
          source: p.sources[0] || { fileId: "", fileName: "未知" },
        },
      ];
      map.set(p.field, {
        ...existing,
        status: "CONFLICT",
        value: null,
        normalizedValue: null,
        sources: [...existing.sources, ...p.sources],
        alternatives,
        confidence: Math.min(existing.confidence ?? 1, p.confidence ?? 1),
      });
    }
  }

  for (const field of REQUIRED_IMPORT_FIELDS) {
    if (!map.has(field)) {
      map.set(field, param(field, null, "MISSING", []));
    }
  }

  return [...map.values()].sort((a, b) => a.field.localeCompare(b.field));
}

export function createImportFileMeta(input: {
  name: string;
  mimeType?: string;
  size?: number;
}): ImportFile {
  return {
    id: createId("FILE"),
    name: input.name,
    mimeType: input.mimeType || guessMime(input.name),
    size: input.size ?? 0,
    status: "UPLOADED",
    parserMode: "demo",
    addedAt: nowIso(),
  };
}

function guessMime(name: string) {
  const n = name.toLowerCase();
  if (n.endsWith(".xlsx") || n.endsWith(".xls")) return "application/vnd.ms-excel";
  if (n.endsWith(".pdf")) return "application/pdf";
  if (n.endsWith(".docx") || n.endsWith(".doc")) return "application/msword";
  if (n.endsWith(".png")) return "image/png";
  if (n.endsWith(".jpg") || n.endsWith(".jpeg")) return "image/jpeg";
  return "application/octet-stream";
}

/** 演示资料清单（UI 可一键加载，不写死解析结果） */
export const DEMO_IMPORT_SAMPLE_FILES = [
  { name: "项目运输需求.xlsx", mimeType: "application/vnd.ms-excel", size: 48200 },
  { name: "车辆租赁报价.pdf", mimeType: "application/pdf", size: 126000 },
  { name: "线路报价表.xlsx", mimeType: "application/vnd.ms-excel", size: 31800 },
  { name: "客户需求说明.docx", mimeType: "application/msword", size: 22400 },
] as const;
