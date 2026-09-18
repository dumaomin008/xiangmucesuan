import { getField } from "../schema/field-dictionary";
import type { AiRouteDraft, FieldStatus, ParameterRecord } from "../schema/types";

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

export type MappingAssumption = {
  field_code: string;
  value: string;
  status: Extract<FieldStatus, "default" | "reference">;
  label: string;
};

export type EngineSchemeDraft = {
  schemeName: string;
  fleetSize: number;
  monthlyRentPerVehicle: string | null;
  monthlyRentStatus: FieldStatus | "missing";
  routes: Array<{
    routeName: string;
    routeCode: string;
    sortNo: number;
    description: string;
    segment: EngineSegmentDraft;
  }>;
  unmappedParameters: ParameterRecord[];
  assumptions: MappingAssumption[];
  silentZeroViolations: string[];
};

const SILENT_ZERO_FORBIDDEN = [
  "cost.toll_per_trip",
  "cost.loading_unloading_fee",
  "cost.information_fee",
  "cost.driver_cost_per_trip",
  "energy.electricity_price",
  "energy.loaded_consumption",
  "energy.empty_consumption",
  "vehicle.monthly_rent",
];

function paramOf(parameters: ParameterRecord[], fieldCode: string, routeId?: string | null) {
  const usable = (item: ParameterRecord) =>
    item.field_code === fieldCode && item.status !== "missing" && item.status !== "conflict" && item.value != null && String(item.value).trim() !== "";
  const exact = parameters.find((item) => usable(item) && (item.route_id ?? null) === (routeId ?? null));
  if (exact) return exact;
  if (routeId) return parameters.find((item) => usable(item) && item.route_id == null);
  return undefined;
}

function routeValue(route: AiRouteDraft, fieldCode: string) {
  const map: Record<string, string | null> = {
    "route.origin": route.origin_name,
    "route.destination": route.destination_name,
    "route.distance_km": route.distance_km,
    "cargo.load_ton": route.load_ton,
    "ops.trips_per_vehicle_month": route.trips_per_vehicle_month,
    "revenue.freight_price": route.freight_price,
    "revenue.freight_price_unit": route.freight_price_unit,
    "cost.toll_per_trip": route.toll_per_trip,
    "cost.loading_unloading_fee": route.loading_unloading_fee,
    "cost.information_fee": route.information_fee,
    "cost.driver_cost_per_trip": route.driver_cost_per_trip,
  };
  return map[fieldCode] ?? null;
}

type Resolved = { value: string; status: FieldStatus | "missing"; visibleDefault: boolean };

function resolveField(
  route: AiRouteDraft | null,
  parameters: ParameterRecord[],
  fieldCode: string,
  fallbackDefault: string | null,
): Resolved {
  const fromRoute = route ? routeValue(route, fieldCode) : null;
  const param = paramOf(parameters, fieldCode, route?.id ?? null);
  const raw = (fromRoute && fromRoute.trim()) || param?.value || null;
  if (raw != null && String(raw).trim() !== "") {
    return { value: String(raw), status: param?.status || "extracted", visibleDefault: false };
  }
  if (fallbackDefault != null) {
    return { value: fallbackDefault, status: "default", visibleDefault: true };
  }
  return { value: "", status: "missing", visibleDefault: false };
}

export function mapWorkspaceToEngineInput(input: {
  title: string;
  routes: AiRouteDraft[];
  parameters: ParameterRecord[];
  projectFleetSize?: string | null;
}): EngineSchemeDraft {
  const fleetResolved = resolveField(null, input.parameters, "vehicle.fleet_size", null);
  const fleetRaw = fleetResolved.value || input.projectFleetSize || input.routes.find((r) => r.vehicle_count)?.vehicle_count;
  const fleetSize = Number(fleetRaw || 1);
  const rent = resolveField(null, input.parameters, "vehicle.monthly_rent", null);
  const assumptions: MappingAssumption[] = [];
  const silentZeroViolations: string[] = [];
  const unmapped = input.parameters.filter((item) => getField(item.field_code)?.mapping === "unmapped");

  const routes = input.routes
    .filter((route) => route.enabled)
    .map((route, index) => {
      const origin = resolveField(route, input.parameters, "route.origin", null);
      const destination = resolveField(route, input.parameters, "route.destination", null);
      const distance = resolveField(route, input.parameters, "route.distance_km", null);
      const freight = resolveField(route, input.parameters, "revenue.freight_price", null);
      const unit = resolveField(route, input.parameters, "revenue.freight_price_unit", null);
      const load = resolveField(route, input.parameters, "cargo.load_ton", null);
      const trips = resolveField(route, input.parameters, "ops.trips_per_vehicle_month", null);
      const energyLoaded = resolveField(route, input.parameters, "energy.loaded_consumption", null);
      const energyEmpty = resolveField(route, input.parameters, "energy.empty_consumption", null);
      const electricity = resolveField(route, input.parameters, "energy.electricity_price", null);
      const toll = resolveField(route, input.parameters, "cost.toll_per_trip", "0");
      const loading = resolveField(route, input.parameters, "cost.loading_unloading_fee", "0");
      const info = resolveField(route, input.parameters, "cost.information_fee", "0");
      const driver = resolveField(route, input.parameters, "cost.driver_cost_per_trip", "0");

      const maybeAssume = (resolved: Resolved, fieldCode: string, label: string) => {
        if (resolved.visibleDefault) {
          assumptions.push({ field_code: fieldCode, value: resolved.value, status: "default", label });
        }
      };
      maybeAssume(toll, "cost.toll_per_trip", "过路费未从资料提取，按可见假设 0 元/趟进入引擎");
      maybeAssume(loading, "cost.loading_unloading_fee", "装卸费未从资料提取，按可见假设 0 元/趟进入引擎");
      maybeAssume(info, "cost.information_fee", "信息费未从资料提取，按可见假设 0 元/趟进入引擎");
      maybeAssume(driver, "cost.driver_cost_per_trip", "路段司机成本未提取，回退方案级司机成本（路段记 0，不作为资料事实）");
      if (["missing", "default"].includes(energyLoaded.status) && energyLoaded.value === "0") {
        silentZeroViolations.push("energy.loaded_consumption");
      }
      if (["missing", "default"].includes(electricity.status) && electricity.value === "0") {
        silentZeroViolations.push("energy.electricity_price");
      }
      if (energyLoaded.status === "reference") {
        assumptions.push({ field_code: "energy.loaded_consumption", value: energyLoaded.value, status: "reference", label: "满载能耗采用参考值" });
      }
      if (electricity.status === "reference") {
        assumptions.push({ field_code: "energy.electricity_price", value: electricity.value, status: "reference", label: "电价采用参考值" });
      }

      return {
        routeName: route.route_name || (origin.value && destination.value ? `${origin.value}-${destination.value}` : `线路 ${index + 1}`),
        routeCode: `AI-${String(index + 1).padStart(2, "0")}`,
        sortNo: route.sort_no || index + 1,
        description: "来自 AI 测算草稿，仅包含已映射字段",
        segment: {
          originName: origin.value,
          destinationName: destination.value,
          segmentName: origin.value && destination.value ? `${origin.value}-${destination.value}` : route.route_name || `路段 ${index + 1}`,
          distanceKm: distance.value,
          freightPrice: freight.value,
          freightPriceUnit: unit.value || "PER_TON",
          loadTon: load.value,
          tripsPerVehicleMonth: trips.value,
          operatingMonthsYear: "12",
          tollPerTrip: toll.value,
          loadingUnloadingFee: loading.value,
          informationFee: info.value,
          loadedEnergyConsumption: energyLoaded.value,
          emptyEnergyConsumption: energyEmpty.value,
          electricityPrice: electricity.value,
          driverCostPerTrip: driver.value,
        },
      };
    });

  assumptions.push({
    field_code: "ops.operating_months_year",
    value: "12",
    status: "default",
    label: "运营月数按系统默认 12 个月，不是本合同约定",
  });
  if (rent.status === "missing") {
    assumptions.push({
      field_code: "vehicle.monthly_rent",
      value: "",
      status: "default",
      label: "单车月租尚未确认，禁止静默按 0 测算车辆成本",
    });
  } else if (rent.status === "reference") {
    assumptions.push({
      field_code: "vehicle.monthly_rent",
      value: rent.value,
      status: "reference",
      label: "单车月租采用演示参考值，不是已签合同",
    });
  }
  assumptions.push({
    field_code: "vehicle.down_payment",
    value: "80000",
    status: "default",
    label: "单车首付使用演示默认 80000 元，需合同核验",
  });

  return {
    schemeName: input.title,
    fleetSize: Number.isInteger(fleetSize) && fleetSize > 0 ? fleetSize : 1,
    monthlyRentPerVehicle: rent.value || null,
    monthlyRentStatus: rent.status,
    unmappedParameters: unmapped,
    assumptions,
    silentZeroViolations,
    routes,
  };
}

export function assertNoSilentZero(draft: EngineSchemeDraft) {
  const assumed = new Set(draft.assumptions.map((item) => item.field_code));
  for (const route of draft.routes) {
    const pairs: Array<[string, string]> = [
      ["cost.toll_per_trip", route.segment.tollPerTrip],
      ["cost.loading_unloading_fee", route.segment.loadingUnloadingFee],
      ["cost.information_fee", route.segment.informationFee],
      ["cost.driver_cost_per_trip", route.segment.driverCostPerTrip],
    ];
    for (const [code, value] of pairs) {
      if (value === "0" && !assumed.has(code)) draft.silentZeroViolations.push(code);
    }
    for (const [code, value] of [
      ["energy.electricity_price", route.segment.electricityPrice],
      ["energy.loaded_consumption", route.segment.loadedEnergyConsumption],
      ["energy.empty_consumption", route.segment.emptyEnergyConsumption],
    ] as const) {
      if (value === "0" && !assumed.has(code) && !SILENT_ZERO_FORBIDDEN.includes(code)) {
        draft.silentZeroViolations.push(code);
      }
    }
  }
  if (draft.monthlyRentPerVehicle === "0" && draft.monthlyRentStatus === "missing") {
    draft.silentZeroViolations.push("vehicle.monthly_rent");
  }
  if (draft.silentZeroViolations.length) {
    throw new Error(`禁止将关键成本静默写成已提取的 0：${draft.silentZeroViolations.join("、")}`);
  }
}
