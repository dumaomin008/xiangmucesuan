import { FREIGHT_UNIT_ALIASES } from "../schema/field-dictionary";
import type { AiRouteDraft, ParameterRecord, SourceType } from "../schema/types";

export type HeuristicHit = {
  field_code: string;
  value: string;
  unit: string | null;
  raw_value: string;
  confidence: number;
};

export type HeuristicDocumentExtract = {
  source_ref: string;
  source_type: SourceType;
  project: { name: string | null; customer: string | null; region: string | null };
  routes: AiRouteDraft[];
  hits: Array<HeuristicHit & { route_index: number | null }>;
};

const PLACE_TO_PLACE = /([\u4e00-\u9fa5A-Za-z0-9]{2,16})到([\u4e00-\u9fa5A-Za-z0-9]{2,16})/g;
const DISTANCE = /(?:单程)?(?:约|大约|大概)?\s*(\d+(?:\.\d+)?)\s*(?:公里|千米|km)/gi;
const DAILY_VOLUME = /(?:每天|每日|日均)[^\d]{0,8}(\d+(?:\.\d+)?)\s*吨|(\d+(?:\.\d+)?)\s*吨[^\d]{0,6}(?:每天|每日|日均|一天)/gi;
const FLEET = /(?:投入|投放|配置)?\s*(\d+)\s*台(?:新能源)?(?:重卡|牵引车|货车|车辆)?/g;
const FREIGHT = /(?:运价|价格|单价)[^\d]{0,6}(?:约|大约)?\s*(\d+(?:\.\d+)?)\s*元\s*\/\s*(吨|趟|吨公里|吨·公里)|(\d+(?:\.\d+)?)\s*元\s*\/\s*(吨|趟|吨公里|吨·公里)/gi;
const TRIPS_DAY = /(?:每天|每日|日均)[^\d]{0,6}(\d+(?:\.\d+)?)\s*趟/gi;
const LOAD_TON = /(?:载重|核载|单车载重)[^\d]{0,6}(\d+(?:\.\d+)?)\s*吨/gi;

function uniqPlaces(text: string) {
  const pairs: Array<{ origin: string; destination: string; raw: string }> = [];
  const re = new RegExp(PLACE_TO_PLACE);
  let match: RegExpExecArray | null;
  while ((match = re.exec(text))) {
    const origin = match[1].replace(/^(从|由)/, "");
    const destination = match[2];
    if (origin && destination && origin !== destination) {
      pairs.push({ origin, destination, raw: match[0] });
    }
  }
  return pairs;
}

function allMatches(re: RegExp, text: string, pick: (m: RegExpExecArray) => { value: string; raw: string; unit?: string | null } | null) {
  const out: Array<{ value: string; raw: string; unit?: string | null }> = [];
  const cloned = new RegExp(re.source, re.flags);
  let match: RegExpExecArray | null;
  while ((match = cloned.exec(text))) {
    const item = pick(match);
    if (item) out.push(item);
  }
  return out;
}

function makeRoute(sort: number, origin: string, destination: string): AiRouteDraft {
  const name = origin && destination ? `${origin}-${destination}` : origin || destination || `线路 ${sort}`;
  return {
    sort_no: sort,
    route_name: name,
    origin_name: origin,
    destination_name: destination,
    distance_km: null,
    volume_value: null,
    volume_unit: null,
    trips_per_day: null,
    trips_per_vehicle_month: null,
    vehicle_count: null,
    cargo_name: null,
    freight_price: null,
    freight_price_unit: null,
    load_ton: null,
    status: "pending",
    enabled: true,
  };
}

/**
 * 保守启发式抽取：只识别 PRD 附录与字典内的显式数字/地名模式。
 * 不猜测日均趟次、电耗，不做单位危险换算，不把讨论语气升级为事实。
 */
export function extractFromText(text: string, sourceRef: string, sourceType: SourceType): HeuristicDocumentExtract {
  const places = uniqPlaces(text);
  const routes = (places.length ? places : [{ origin: "", destination: "", raw: "" }]).map((p, i) =>
    makeRoute(i + 1, p.origin, p.destination),
  );

  const distances = allMatches(DISTANCE, text, (m) => ({ value: m[1], raw: m[0], unit: "km" }));
  const volumes = allMatches(DAILY_VOLUME, text, (m) => ({ value: m[1] || m[2], raw: m[0], unit: "吨/日" }));
  const fleets = allMatches(FLEET, text, (m) => ({ value: m[1], raw: m[0], unit: "台" }));
  const freights = allMatches(FREIGHT, text, (m) => {
    const value = m[1] || m[3];
    const unitRaw = m[2] || m[4];
    if (!value || !unitRaw) return null;
    return { value, raw: m[0], unit: FREIGHT_UNIT_ALIASES[`元/${unitRaw}`] || FREIGHT_UNIT_ALIASES[unitRaw] || null };
  });
  const trips = allMatches(TRIPS_DAY, text, (m) => ({ value: m[1], raw: m[0], unit: "趟/日" }));
  const loads = allMatches(LOAD_TON, text, (m) => ({ value: m[1], raw: m[0], unit: "吨" }));

  const hits: HeuristicDocumentExtract["hits"] = [];
  const assignRouteField = (
    field: keyof AiRouteDraft,
    fieldCode: string,
    items: Array<{ value: string; raw: string; unit?: string | null }>,
    mapValue?: (v: string) => string,
  ) => {
    items.forEach((item, index) => {
      const routeIndex = Math.min(index, routes.length - 1);
      const value = mapValue ? mapValue(item.value) : item.value;
      (routes[routeIndex][field] as string) = value;
      hits.push({
        field_code: fieldCode,
        value,
        unit: item.unit ?? null,
        raw_value: item.raw.trim(),
        confidence: 0.82,
        route_index: routeIndex,
      });
    });
  };

  routes.forEach((route, index) => {
    if (route.origin_name) {
      hits.push({
        field_code: "route.origin",
        value: route.origin_name,
        unit: null,
        raw_value: places[index]?.raw ?? route.origin_name,
        confidence: 0.9,
        route_index: index,
      });
    }
    if (route.destination_name) {
      hits.push({
        field_code: "route.destination",
        value: route.destination_name,
        unit: null,
        raw_value: places[index]?.raw ?? route.destination_name,
        confidence: 0.9,
        route_index: index,
      });
    }
  });

  assignRouteField("distance_km", "route.distance_km", distances);
  assignRouteField("volume_value", "cargo.daily_volume_ton", volumes);
  volumes.forEach((item, index) => {
    const routeIndex = Math.min(index, routes.length - 1);
    routes[routeIndex].volume_unit = "吨/日";
  });
  assignRouteField("freight_price", "revenue.freight_price", freights);
  freights.forEach((item, index) => {
    const routeIndex = Math.min(index, routes.length - 1);
    if (item.unit) {
      routes[routeIndex].freight_price_unit = item.unit;
      hits.push({
        field_code: "revenue.freight_price_unit",
        value: item.unit,
        unit: null,
        raw_value: item.raw.trim(),
        confidence: 0.88,
        route_index: routeIndex,
      });
    }
  });
  assignRouteField("trips_per_day", "ops.trips_per_day", trips);
  assignRouteField("load_ton", "cargo.load_ton", loads);

  if (fleets[0]) {
    hits.push({
      field_code: "vehicle.fleet_size",
      value: fleets[0].value,
      unit: "台",
      raw_value: fleets[0].raw.trim(),
      confidence: 0.86,
      route_index: null,
    });
    routes.forEach((route) => {
      if (!route.vehicle_count) route.vehicle_count = fleets[0].value;
    });
  }

  return {
    source_ref: sourceRef,
    source_type: sourceType,
    project: { name: null, customer: null, region: null },
    routes: routes.filter((r) => r.origin_name || r.destination_name || r.distance_km || r.freight_price || r.volume_value),
    hits,
  };
}

export function hitsToParameters(
  extract: HeuristicDocumentExtract,
  routeIds: Array<string | undefined>,
): ParameterRecord[] {
  return extract.hits.map((hit) => ({
    field_code: hit.field_code,
    value: hit.value,
    unit: hit.unit,
    raw_value: hit.raw_value,
    source_type: extract.source_type,
    source_ref: extract.source_ref,
    confidence: hit.confidence,
    status: "extracted" as const,
    editable: true,
    reference_meta: null,
    updated_by: "AI" as const,
    route_id: hit.route_index == null ? null : routeIds[hit.route_index] ?? null,
  }));
}
