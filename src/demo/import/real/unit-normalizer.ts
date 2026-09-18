/**
 * 确定性单位换算。保留 rawValue / rawUnit，失败时不猜测。
 */

export type UnitNorm = {
  ok: boolean;
  rawValue: string | number | null;
  rawUnit?: string;
  normalizedValue: string | number | null;
  unit?: string;
  freightPriceUnit?: "PER_TON" | "PER_TRIP" | "PER_TON_KM";
  reason?: string;
};

function cleanUnit(unit?: string): string {
  return (unit || "").trim().replace(/\s+/g, "");
}

export function normalizeByField(field: string, value: number, rawUnit?: string): UnitNorm {
  const unit = cleanUnit(rawUnit);
  const base = { rawValue: value, rawUnit: unit || undefined, normalizedValue: value as number | null };

  if (field === "distanceKm") {
    if (!unit || unit === "km" || unit === "公里" || unit === "千米") return { ...base, ok: true, unit: "km" };
    if (unit === "米" || unit === "m") return { ...base, ok: true, unit: "km", normalizedValue: value / 1000 };
    return { ...base, ok: false, normalizedValue: null, reason: `无法把「${unit}」换算为 km` };
  }
  if (field === "loadTon") {
    if (!unit || unit === "吨" || unit === "t" || unit === "T") return { ...base, ok: true, unit: "吨" };
    if (unit === "kg" || unit === "千克" || unit === "公斤") return { ...base, ok: true, unit: "吨", normalizedValue: value / 1000 };
    return { ...base, ok: false, normalizedValue: null, reason: `无法把「${unit}」换算为吨` };
  }
  if (field === "electricityPrice") {
    if (!unit || unit === "元/度" || unit === "元/kWh" || unit === "元/kwh" || unit === "元/千瓦时") {
      return { ...base, ok: true, unit: "元/kWh" };
    }
    return { ...base, ok: false, normalizedValue: null, reason: `无法把「${unit}」换算为元/kWh` };
  }
  if (field === "loadedEnergyConsumption" || field === "emptyEnergyConsumption") {
    if (!unit || unit === "kWh/km" || unit === "度/公里" || unit === "度/km") return { ...base, ok: true, unit: "kWh/km" };
    return { ...base, ok: false, normalizedValue: null, reason: `无法把「${unit}」换算为 kWh/km` };
  }
  if (field === "tripsPerVehicleMonth") {
    if (!unit || unit === "趟" || unit === "趟/月" || unit === "次/月") return { ...base, ok: true, unit: "趟" };
    if (unit === "趟/天" || unit === "次/天") {
      return { ...base, ok: false, normalizedValue: null, reason: "趟/天缺少每月运营天数，不能静默换算为趟/月" };
    }
    return { ...base, ok: false, normalizedValue: null, reason: `无法把「${unit}」换算为趟/月` };
  }
  if (field === "monthlyRentPerVehicle") {
    if (!unit || unit === "元" || unit === "元/车/月" || unit === "元/月/车" || unit === "元/台/月") {
      return { ...base, ok: true, unit: "元" };
    }
    return { ...base, ok: false, normalizedValue: null, reason: `无法把「${unit}」换算为元/车/月` };
  }
  if (field === "driverCostPerTrip") {
    if (!unit || unit === "元/趟" || unit === "元") return { ...base, ok: true, unit: "元/趟" };
    return { ...base, ok: false, normalizedValue: null, reason: `无法把「${unit}」换算为元/趟` };
  }
  if (field === "freightPrice") {
    const freight =
      unit === "元/吨" || unit === "元/t" ? "PER_TON" : unit === "元/趟" ? "PER_TRIP" : unit === "元/吨公里" ? "PER_TON_KM" : undefined;
    if (!unit || unit === "元" || freight) return { ...base, ok: true, unit: "元", freightPriceUnit: freight };
    return { ...base, ok: false, normalizedValue: null, reason: `无法识别运价单位「${unit}」` };
  }
  if (field === "fleetSize" || field === "operatingMonthsYear" || field === "tollPerTrip") {
    if (unit === "%" || unit === "％") return { ...base, ok: true, unit: "%", normalizedValue: value / 100 };
    return { ...base, ok: true, unit: unit || undefined };
  }
  if (unit === "%" || unit === "％") return { ...base, ok: true, unit: "%", normalizedValue: value / 100 };
  return { ...base, ok: true, unit: unit || undefined };
}
