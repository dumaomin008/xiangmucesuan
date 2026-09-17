import { EngineError, toDecimal, Decimal } from "./decimal";
import type { SchemeCalculationInput, ValidationIssue } from "./types";

export function validateSchemeInput(input: SchemeCalculationInput): {
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
} {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];

  const pushError = (field: string, message: string) => {
    errors.push({ code: "CALC_PARAMETER_INVALID", field, message, level: "error" });
  };
  const pushWarning = (field: string, message: string) => {
    warnings.push({ code: "CALC_PARAMETER_WARNING", field, message, level: "warning" });
  };

  if (!Number.isInteger(input.fleetSize) || input.fleetSize <= 0) {
    pushError("fleet_size", "车辆数必须为正整数");
  }

  const lease = input.leaseTypes.find((item) => item.code === input.leaseType);
  if (!lease) {
    pushError("lease_type", "租赁形式未在配置中定义");
  } else {
    if (lease.downPaymentRequired) {
      const v = safeNum(input.vehicle.downPaymentPerVehicle);
      if (v === null || v.lte(0)) pushError("down_payment_per_vehicle", "当前租赁形式要求填写单车首付");
    }
    if (lease.installmentRequired && input.vehicle.installmentMonths <= 0) {
      pushError("installment_months", "当前租赁形式要求填写分期月份");
    }
    if (lease.monthlyRentRequired) {
      const v = safeNum(input.vehicle.monthlyRentPerVehicle);
      if (v === null || v.lte(0)) pushError("monthly_rent_per_vehicle", "当前租赁形式要求填写单车月租");
    }
  }

  const enabledRoutes = input.routes.filter((r) => r.enabled);
  if (enabledRoutes.length === 0) {
    pushError("routes", "至少需要一条启用中的线路");
  }

  const missingStd = input.standardParameters.filter((p) => p.value === "" || p.value == null);
  if (missingStd.length > 0) {
    pushError(
      "standard_parameters",
      `标准参数缺失：${missingStd.map((p) => p.parameterName).join("、")}`,
    );
  }

  for (const route of enabledRoutes) {
    if (!route.weight && route.weight !== 0) {
      pushWarning(`route.${route.id}.weight`, `线路「${route.routeName}」权重未配置`);
    }
    const segs = route.segments.filter((s) => s.enabled);
    if (segs.length === 0) {
      pushError(`route.${route.id}.segments`, `线路「${route.routeName}」至少需要一个路段`);
    }
    for (const seg of segs) {
      const prefix = `segment.${seg.id}`;
      const distance = safeNum(seg.distanceKm);
      const price = safeNum(seg.freightPrice);
      const load = safeNum(seg.loadTon);
      const trips = safeNum(seg.tripsPerVehicleMonth);
      const energyLoaded = safeNum(seg.loadedEnergyConsumption);
      const energyEmpty = safeNum(seg.emptyEnergyConsumption);
      const electricity = safeNum(seg.electricityPrice);
      const months = safeNum(seg.operatingMonthsYear);

      if (distance === null || distance.lte(0)) pushError(`${prefix}.distance_km`, "路段没有有效里程");
      if (distance !== null && distance.lt(0)) pushError(`${prefix}.distance_km`, "里程不得为负");
      if (price === null) pushError(`${prefix}.freight_price`, "运价为空");
      if (load !== null && load.lt(0)) pushError(`${prefix}.load_ton`, "载重不得为负");
      if (trips === null || trips.lte(0)) pushError(`${prefix}.trips_per_vehicle_month`, "单车月运营趟数必须大于0");
      if (trips !== null && trips.lt(0)) pushError(`${prefix}.trips_per_vehicle_month`, "趟数不得为负");
      if (energyLoaded === null || energyEmpty === null) pushError(`${prefix}.energy`, "必要能耗为空");
      if (electricity === null) pushError(`${prefix}.electricity_price`, "电价为空");
      if (months === null || months.lte(0) || months.gt(12)) {
        pushError(`${prefix}.operating_months_year`, "年运营月数必须在 1–12 之间");
      }

      if (!input.freightPriceUnits.some((u) => u.code === seg.freightPriceUnit)) {
        pushError(`${prefix}.freight_price_unit`, "运价单位未在配置中定义");
      }

      const stdPrice = findStd(input, "STD_FREIGHT_PRICE_REF");
      if (stdPrice && price && price.minus(stdPrice).abs().div(stdPrice).gt("0.3")) {
        pushWarning(`${prefix}.freight_price`, `运价明显偏离标准参考值 ${stdPrice.toString()}`);
      }
      const stdLoaded = findStd(input, "STD_LOADED_ENERGY");
      if (stdLoaded && energyLoaded && energyLoaded.minus(stdLoaded).abs().div(stdLoaded).gt("0.25")) {
        pushWarning(`${prefix}.loaded_energy_consumption`, `满载能耗明显偏离标准值 ${stdLoaded.toString()}`);
      }
    }
  }

  const vat = safeNum(input.finance.outputVatRate);
  if (vat === null || vat.lt(0) || vat.gt(1)) {
    pushError("output_vat_rate", "非法税率，销项税率需在 0–1 之间");
  }

  const wcRate = safeNum(input.finance.workingCapitalInterestRate);
  if (wcRate === null || wcRate.lt(0) || wcRate.gt(1)) {
    pushError("working_capital_interest_rate", "流动资金贷款利率需在 0–1 之间");
  }
  const discount = safeNum(input.finance.discountRate);
  if (discount === null || discount.lt(0) || discount.gt(1)) {
    pushError("discount_rate", "贴现率需在 0–1 之间");
  }

  if (input.finance.receivableCycle > 6) {
    pushWarning("receivable_cycle", "回款周期较长，资金占用成本可能被放大");
  }

  if (input.overrides.length > 0) {
    for (const o of input.overrides) {
      if (!o.overrideReason.trim()) {
        pushError(`override.${o.parameterCode}`, `覆盖标准参数「${o.parameterCode}」必须填写调整原因`);
      } else {
        pushWarning(`override.${o.parameterCode}`, `标准参数「${o.parameterCode}」已被项目覆盖`);
      }
    }
  }

  const tireLife = safeNum(input.vehicle.tireLifeKm);
  if (tireLife !== null && tireLife.lte(0) && input.vehicle.tireCount > 0) {
    pushError("tire_life_km", "轮胎寿命必须大于 0，否则轮胎成本分母为 0");
  }

  return { errors, warnings };
}

function safeNum(value: string): Decimal | null {
  try {
    const n = toDecimal(value);
    return n.isFinite() ? n : null;
  } catch {
    return null;
  }
}

function findStd(input: SchemeCalculationInput, code: string): Decimal | null {
  const found = input.standardParameters.find((p) => p.parameterCode === code);
  return found ? safeNum(found.value) : null;
}

export function issuesToErrors(issues: ValidationIssue[]): EngineError[] {
  return issues
    .filter((i) => i.level === "error")
    .map((i) => new EngineError(i.code, i.field, i.message));
}
