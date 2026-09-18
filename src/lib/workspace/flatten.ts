import type { Scheme } from "./types";
import { VEHICLE_FIELDS } from "./types";

export type FlatParam = { key: string; label: string; value: string; group: string };

const SEGMENT_FIELDS: [string, string][] = [
  ["originName", "装货地"],
  ["destinationName", "卸货地"],
  ["distanceKm", "单程距离"],
  ["loadTon", "单趟载重"],
  ["tripsPerVehicleMonth", "单车月趟数"],
  ["freightPrice", "运价"],
  ["freightPriceUnit", "运价单位"],
  ["electricityPrice", "电价"],
  ["loadedEnergyConsumption", "满载能耗"],
  ["emptyEnergyConsumption", "空载能耗"],
  ["tollPerTrip", "过路费"],
  ["loadingUnloadingFee", "装卸费"],
  ["informationFee", "信息费"],
  ["driverCostPerTrip", "司机/趟"],
];

export function flattenSchemeParams(scheme: Scheme): FlatParam[] {
  const rows: FlatParam[] = [
    { key: "schemeName", label: "方案名称", value: scheme.schemeName, group: "项目与方案" },
    { key: "leaseType", label: "租赁形式", value: scheme.leaseType, group: "项目与方案" },
    { key: "fleetSize", label: "车队规模", value: String(scheme.fleetSize), group: "运营效率" },
    { key: "calculationYears", label: "测算年限", value: String(scheme.calculationYears), group: "项目与方案" },
    {
      key: "operatingMonthsYear",
      label: "年运营月数",
      value: String(scheme.financeTaxPlan.operatingMonthsYear ?? ""),
      group: "运营效率",
    },
  ];
  for (const field of VEHICLE_FIELDS) {
    rows.push({
      key: `vehicle.${field.key}`,
      label: field.label,
      value: String(scheme.vehiclePlan[field.key] ?? ""),
      group: "收入与成本",
    });
  }
  const financeLabels: Record<string, string> = {
    receivableCycle: "应收回款周期",
    workingCapitalLoanCycle: "流动资金贷款周期",
    workingCapitalInterestRate: "流动资金贷款利率",
    discountRate: "折现率",
    outputVatRate: "销项税率",
    inputVatRule: "进项税规则",
    depreciationMonths: "车辆折旧年限",
    projectOperatingMonths: "项目经营月数",
  };
  for (const [key, label] of Object.entries(financeLabels)) {
    rows.push({
      key: `finance.${key}`,
      label,
      value: String(scheme.financeTaxPlan[key] ?? ""),
      group: "财务税务",
    });
  }
  const routes = [...scheme.routes].sort((a, b) => a.sortNo - b.sortNo);
  routes.forEach((route, routeIndex) => {
    rows.push({
      key: `route.${routeIndex}.name`,
      label: `线路${routeIndex + 1}名称`,
      value: route.routeName,
      group: "运输场景",
    });
    const segments = [...route.segments].sort((a, b) => a.sortNo - b.sortNo);
    segments.forEach((seg, segIndex) => {
      const prefix = `${route.routeName || `线路${routeIndex + 1}`}/${seg.segmentName || `路段${segIndex + 1}`}`;
      for (const [key, label] of SEGMENT_FIELDS) {
        rows.push({
          key: `route.${routeIndex}.seg.${segIndex}.${key}`,
          label: `${prefix} · ${label}`,
          value: String(seg[key as keyof typeof seg] ?? ""),
          group: "运输场景",
        });
      }
    });
  });
  return rows;
}
