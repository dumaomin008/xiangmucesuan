import type { Scheme } from "./types";
import { VEHICLE_FIELDS } from "./types";

export type FlatParam = { key: string; label: string; value: string; group: string };

export function flattenSchemeParams(scheme: Scheme): FlatParam[] {
  const rows: FlatParam[] = [
    { key: "schemeName", label: "方案名称", value: scheme.schemeName, group: "基本信息" },
    { key: "leaseType", label: "租赁形式", value: scheme.leaseType, group: "基本信息" },
    { key: "fleetSize", label: "车队规模", value: String(scheme.fleetSize), group: "运营参数" },
    { key: "calculationYears", label: "测算年限", value: String(scheme.calculationYears), group: "基本信息" },
    {
      key: "operatingMonthsYear",
      label: "年运营月数",
      value: String(scheme.financeTaxPlan.operatingMonthsYear ?? ""),
      group: "运营参数",
    },
  ];
  for (const field of VEHICLE_FIELDS) {
    rows.push({
      key: `vehicle.${field.key}`,
      label: field.label,
      value: String(scheme.vehiclePlan[field.key] ?? ""),
      group: "成本",
    });
  }
  const financeLabels: Record<string, string> = {
    receivableCycle: "应收回款周期",
    workingCapitalLoanCycle: "流动资金贷款周期",
    workingCapitalInterestRate: "流动资金贷款利率",
    discountRate: "营收垫资资金成本率",
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
  for (const route of scheme.routes) {
    for (const seg of route.segments) {
      const prefix = `${route.routeName}/${seg.segmentName || "路段"}`;
      const fields: [string, string, string][] = [
        ["originName", "装货地", seg.originName],
        ["destinationName", "卸货地", seg.destinationName],
        ["distanceKm", "单程距离", seg.distanceKm],
        ["loadTon", "单趟载重", seg.loadTon],
        ["tripsPerVehicleMonth", "单车月趟数", seg.tripsPerVehicleMonth],
        ["freightPrice", "运价", seg.freightPrice],
        ["freightPriceUnit", "运价单位", seg.freightPriceUnit],
        ["electricityPrice", "电价", seg.electricityPrice],
        ["loadedEnergyConsumption", "满载能耗", seg.loadedEnergyConsumption],
        ["emptyEnergyConsumption", "空载能耗", seg.emptyEnergyConsumption],
        ["tollPerTrip", "过路费", seg.tollPerTrip],
        ["loadingUnloadingFee", "装卸费", seg.loadingUnloadingFee],
        ["informationFee", "信息费", seg.informationFee],
        ["driverCostPerTrip", "司机/趟", seg.driverCostPerTrip],
      ];
      for (const [key, label, value] of fields) {
        rows.push({
          key: `seg.${seg.id}.${key}`,
          label: `${prefix} · ${label}`,
          value: String(value ?? ""),
          group: "线路",
        });
      }
    }
  }
  return rows;
}
