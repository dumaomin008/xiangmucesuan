import { getField } from "../schema/field-dictionary";
import type { AiRouteDraft, ParameterRecord } from "../schema/types";

export type EngineSegmentDraft = {
  originName: string;
  destinationName: string;
  segmentName: string;
  distanceKm: string;
  freightPrice: string;
  freightPriceUnit: string;
  loadTon: string;
  tripsPerVehicleMonth: string;
  operatingMonthsYear: string;
  tollPerTrip: string;
  loadingUnloadingFee: string;
  informationFee: string;
  loadedEnergyConsumption: string;
  emptyEnergyConsumption: string;
  electricityPrice: string;
  driverCostPerTrip: string;
};

export type EngineSchemeDraft = {
  schemeName: string;
  fleetSize: number;
  routes: Array<{
    routeName: string;
    routeCode: string;
    sortNo: number;
    description: string;
    segment: EngineSegmentDraft;
  }>;
  unmappedParameters: ParameterRecord[];
};

function paramValue(parameters: ParameterRecord[], fieldCode: string, routeId?: string | null) {
  return (
    parameters.find((item) => item.field_code === fieldCode && (item.route_id ?? null) === (routeId ?? null) && item.status !== "missing" && item.status !== "conflict")
      ?.value ?? null
  );
}

function pick(route: AiRouteDraft, parameters: ParameterRecord[], fieldCode: string, fallback = "") {
  const fromRoute: Record<string, string | null> = {
    "route.origin": route.origin_name,
    "route.destination": route.destination_name,
    "route.distance_km": route.distance_km,
    "cargo.load_ton": route.load_ton,
    "ops.trips_per_vehicle_month": route.trips_per_vehicle_month,
    "energy.loaded_consumption": null,
    "energy.empty_consumption": null,
    "energy.electricity_price": null,
    "revenue.freight_price": route.freight_price,
    "revenue.freight_price_unit": route.freight_price_unit,
  };
  return fromRoute[fieldCode] ?? paramValue(parameters, fieldCode, route.id) ?? fallback;
}

/**
 * 只把字典中 mapping=mapped 且用户已有值的字段写入引擎。
 * 不把未映射字段换算进引擎，不把参考值伪装成已确认输入。
 */
export function mapWorkspaceToEngineInput(input: {
  title: string;
  routes: AiRouteDraft[];
  parameters: ParameterRecord[];
  projectFleetSize?: string | null;
}): EngineSchemeDraft {
  const fleetRaw = paramValue(input.parameters, "vehicle.fleet_size", null) || input.projectFleetSize || input.routes.find((r) => r.vehicle_count)?.vehicle_count;
  const fleetSize = Number(fleetRaw || 1);
  const unmapped = input.parameters.filter((item) => getField(item.field_code)?.mapping === "unmapped");

  return {
    schemeName: input.title,
    fleetSize: Number.isInteger(fleetSize) && fleetSize > 0 ? fleetSize : 1,
    unmappedParameters: unmapped,
    routes: input.routes
      .filter((route) => route.enabled)
      .map((route, index) => {
        const origin = pick(route, input.parameters, "route.origin");
        const destination = pick(route, input.parameters, "route.destination");
        return {
          routeName: route.route_name || (origin && destination ? `${origin}-${destination}` : `线路 ${index + 1}`),
          routeCode: `AI-${String(index + 1).padStart(2, "0")}`,
          sortNo: route.sort_no || index + 1,
          description: "来自 AI 测算草稿，仅包含已映射字段",
          segment: {
            originName: origin,
            destinationName: destination,
            segmentName: origin && destination ? `${origin}-${destination}` : route.route_name || `路段 ${index + 1}`,
            distanceKm: pick(route, input.parameters, "route.distance_km"),
            freightPrice: pick(route, input.parameters, "revenue.freight_price"),
            freightPriceUnit: pick(route, input.parameters, "revenue.freight_price_unit") || "PER_TON",
            loadTon: pick(route, input.parameters, "cargo.load_ton"),
            tripsPerVehicleMonth: pick(route, input.parameters, "ops.trips_per_vehicle_month"),
            operatingMonthsYear: "",
            tollPerTrip: "0",
            loadingUnloadingFee: "0",
            informationFee: "0",
            loadedEnergyConsumption: paramValue(input.parameters, "energy.loaded_consumption", route.id) || "",
            emptyEnergyConsumption: paramValue(input.parameters, "energy.empty_consumption", route.id) || "",
            electricityPrice: paramValue(input.parameters, "energy.electricity_price", route.id) || "",
            driverCostPerTrip: "0",
          },
        };
      }),
  };
}
