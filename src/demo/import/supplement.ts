/**
 * 导入页 AI 补参意图：从自然语言提取可写入 ExtractedParameter 的补丁。
 * 不计算 KPI，不直接写 Scenario。
 */
import type { ImportParamPatch } from "./tools";

export function parseImportSupplementIntent(message: string): ImportParamPatch[] {
  const q = message.replace(/\s+/g, "");
  const patches: ImportParamPatch[] = [];

  const rent = q.match(/月租[^0-9\-]{0,6}(-?\d+(?:\.\d+)?)/);
  if (rent) patches.push({ field: "monthlyRentPerVehicle", value: Number(rent[1]), label: "单车月租", unit: "元" });

  const energy = q.match(/(?:重载)?能耗[^0-9\-]{0,6}(-?\d+(?:\.\d+)?)/);
  if (energy) {
    patches.push({
      field: "loadedEnergyConsumption",
      value: Number(energy[1]),
      label: "重载能耗",
      unit: "kWh/km",
    });
  }

  const driver = q.match(/司机[^0-9\-]{0,10}(-?\d+(?:\.\d+)?)/);
  if (driver) {
    patches.push({ field: "driverCostPerTrip", value: Number(driver[1]), label: "司机单趟成本", unit: "元/趟" });
  }

  const fleet = q.match(/车辆[^0-9\-]{0,6}(-?\d+)/);
  if (fleet && !/增加|减少/.test(q)) {
    patches.push({ field: "fleetSize", value: Number(fleet[1]), label: "车辆数", unit: "台" });
  }

  const elec = q.match(/电价[^0-9\-]{0,6}(-?\d+(?:\.\d+)?)/);
  if (elec) patches.push({ field: "electricityPrice", value: Number(elec[1]), label: "电价", unit: "元/kWh" });

  return patches;
}
