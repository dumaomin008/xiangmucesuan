import { Decimal, EngineError, toDecimal, toDecimalOrZero } from "./decimal";
import { calcExcelSegmentEnergyCost } from "./energy";
import { calcExcelAdvanceCost, calcExcelWorkingCapitalInterest } from "./finance";
import { calcExcelVehicleCost, excelAnnualizeMonthly } from "./fixed-cost";
import { newtonRaphsonPeriodicIrr } from "./investment";
import { calcExcelInputVat, calcExcelOutputVat, calcExcelVatPayable } from "./tax";
import { getLeaseType, isExcelPureLease, resolveManagementFee } from "./rule-engine";
import { calcSegmentRevenue, resolveRevenueFormula } from "./revenue";
import { resolveSegmentDriverPerTrip } from "./variable-cost";
import type {
  AnnualCashFlow,
  DriverCostSource,
  MonthlyCashFlow,
  SchemeCalculationInput,
  SegmentInput,
} from "./types";

export type ExcelPnlKey =
  | "revenue"
  | "vehicleCost"
  | "managementFee"
  | "roadFee"
  | "maintenanceFee"
  | "inspectionFee"
  | "insuranceFee"
  | "parkingFee"
  | "heaterFee"
  | "consumableFee"
  | "driverCost"
  | "tollCost"
  | "loadingCost"
  | "infoCost"
  | "energyCost"
  | "tireCost"
  | "advanceCost"
  | "wcInterest"
  | "outputVat"
  | "inputVat"
  | "vatPayable"
  | "totalCost"
  | "profit";

export type ExcelPnl = Record<ExcelPnlKey, Decimal>;

export type ExcelSegmentPnl = ExcelPnl & {
  segmentId: string;
  routeId: string;
  segmentName: string;
  weight: Decimal;
  loadState: "LOADED" | "EMPTY";
  driverCostSource: DriverCostSource;
};

export type ExcelWorkingContext = {
  fleet: Decimal;
  fleetSize: number;
  isPureLease: boolean;
  operatingMonths: Decimal;
  electricityPrice: Decimal;
  loadedConsumption: Decimal;
  emptyConsumption: Decimal;
  monthlyRent: Decimal;
  downPayment: Decimal;
  depreciationMonths: Decimal;
  installmentMonths: number;
  managementFeePerVehicle: Decimal;
  receivableMonths: Decimal;
  loanCycleMonths: Decimal;
  discountRate: Decimal;
  wcRate: Decimal;
  outputVatRate: Decimal;
  inputStandardRate: Decimal;
  inputInsuranceRate: Decimal;
  tireLifeKm: Decimal;
  tireCount: Decimal;
  tireUnitPrice: Decimal;
  projectOperatingMonths: number;
  calculationYears: number;
  segments: {
    input: SegmentInput;
    distance: Decimal;
    price: Decimal;
    load: Decimal;
    trips: Decimal;
    weight: Decimal;
    driverPerTrip: Decimal;
    driverCostSource: DriverCostSource;
    tollPerTrip: Decimal;
    loadingPerTrip: Decimal;
    infoPerTrip: Decimal;
    electricityPrice: Decimal;
    loadedConsumption: Decimal;
    emptyConsumption: Decimal;
  }[];
  totalWeight: Decimal;
};

const ALLOCATED_KEYS: ExcelPnlKey[] = [
  "vehicleCost",
  "managementFee",
  "roadFee",
  "maintenanceFee",
  "inspectionFee",
  "insuranceFee",
  "parkingFee",
  "heaterFee",
  "consumableFee",
  "tireCost",
  "advanceCost",
  "wcInterest",
  "outputVat",
  "inputVat",
];

const DIRECT_KEYS: ExcelPnlKey[] = ["revenue", "driverCost", "tollCost", "loadingCost", "infoCost", "energyCost"];

export function enabledSegments(input: SchemeCalculationInput): { routeId: string; routeName: string; segment: SegmentInput }[] {
  return input.routes
    .filter((route) => route.enabled)
    .flatMap((route) =>
      route.segments
        .filter((segment) => segment.enabled)
        .map((segment) => ({ routeId: route.id, routeName: route.routeName, segment })),
    );
}

export function resolveOperatingMonthsYear(input: SchemeCalculationInput): Decimal {
  if (input.finance.operatingMonthsYear != null && input.finance.operatingMonthsYear > 0) {
    return new Decimal(input.finance.operatingMonthsYear);
  }
  const rows = enabledSegments(input);
  if (rows.length === 0) {
    throw new EngineError("CALC_PARAMETER_INVALID", "operating_months_year", "年运营月数必须大于 0");
  }
  return toDecimal(rows[0].segment.operatingMonthsYear);
}

export function buildExcelContext(input: SchemeCalculationInput): ExcelWorkingContext {
  const rows = enabledSegments(input);
  if (rows.length === 0) {
    throw new EngineError("CALC_PARAMETER_INVALID", "routes", "至少需要一个启用路段");
  }
  const first = rows[0].segment;
  const operatingMonths = resolveOperatingMonthsYear(input);
  if (operatingMonths.lte(0)) {
    throw new EngineError("CALC_PARAMETER_INVALID", "operating_months_year", "年运营月数必须大于 0");
  }
  const lease = getLeaseType(input);
  const vehicle = input.vehicle;
  const mgmtOverride = input.overrides.find((item) => item.parameterCode === "STD_MANAGEMENT_FEE");
  const managementFeePerVehicle = mgmtOverride
    ? toDecimal(mgmtOverride.overrideValue)
    : resolveManagementFee(input.fleetSize, input.managementFeeTiers);

  const segments = rows.map(({ segment }) => {
    const distance = toDecimalOrZero(segment.distanceKm);
    const trips = toDecimalOrZero(segment.tripsPerVehicleMonth);
    const driver = resolveSegmentDriverPerTrip(segment, vehicle);
    return {
      input: segment,
      distance,
      price: toDecimalOrZero(segment.freightPrice),
      load: toDecimalOrZero(segment.loadTon),
      trips,
      weight: distance.mul(trips),
      driverPerTrip: driver.amount,
      driverCostSource: driver.source,
      tollPerTrip: toDecimalOrZero(segment.tollPerTrip),
      loadingPerTrip: toDecimalOrZero(segment.loadingUnloadingFee),
      infoPerTrip: toDecimalOrZero(segment.informationFee),
      electricityPrice: toDecimalOrZero(segment.electricityPrice),
      loadedConsumption: toDecimalOrZero(segment.loadedEnergyConsumption),
      emptyConsumption: toDecimalOrZero(segment.emptyEnergyConsumption),
    };
  });

  const totalWeight = segments.reduce((sum, seg) => sum.plus(seg.weight), new Decimal(0));
  if (totalWeight.isZero()) {
    throw new EngineError("CALC_DIV_ZERO", "allocation_weight", "路段里程×趟数合计为 0，无法按 Excel 口径分摊");
  }

  return {
    fleet: new Decimal(input.fleetSize),
    fleetSize: input.fleetSize,
    isPureLease: isExcelPureLease(lease),
    operatingMonths,
    electricityPrice: toDecimalOrZero(first.electricityPrice),
    loadedConsumption: toDecimalOrZero(first.loadedEnergyConsumption),
    emptyConsumption: toDecimalOrZero(first.emptyEnergyConsumption),
    monthlyRent: toDecimalOrZero(vehicle.monthlyRentPerVehicle),
    downPayment: toDecimalOrZero(vehicle.downPaymentPerVehicle),
    depreciationMonths: new Decimal(input.finance.depreciationMonths ?? 60),
    installmentMonths: vehicle.installmentMonths,
    managementFeePerVehicle,
    receivableMonths: new Decimal(input.finance.receivableCycle || 0),
    loanCycleMonths: new Decimal(input.finance.workingCapitalLoanCycle || 0),
    discountRate: toDecimalOrZero(input.finance.discountRate),
    wcRate: toDecimalOrZero(input.finance.workingCapitalInterestRate),
    outputVatRate: toDecimal(input.finance.outputVatRate || input.ruleSet.vatRates.outputInclusiveRate),
    inputStandardRate: toDecimal(input.ruleSet.vatRates.inputStandardRate),
    inputInsuranceRate: toDecimal(input.ruleSet.vatRates.inputInsuranceRate),
    tireLifeKm: toDecimal(vehicle.tireLifeKm),
    tireCount: new Decimal(vehicle.tireCount),
    tireUnitPrice: toDecimalOrZero(vehicle.tireUnitPrice),
    projectOperatingMonths: input.finance.projectOperatingMonths ?? 0,
    calculationYears: input.calculationYears,
    segments,
    totalWeight,
  };
}

function emptyPnl(): ExcelPnl {
  return {
    revenue: new Decimal(0),
    vehicleCost: new Decimal(0),
    managementFee: new Decimal(0),
    roadFee: new Decimal(0),
    maintenanceFee: new Decimal(0),
    inspectionFee: new Decimal(0),
    insuranceFee: new Decimal(0),
    parkingFee: new Decimal(0),
    heaterFee: new Decimal(0),
    consumableFee: new Decimal(0),
    driverCost: new Decimal(0),
    tollCost: new Decimal(0),
    loadingCost: new Decimal(0),
    infoCost: new Decimal(0),
    energyCost: new Decimal(0),
    tireCost: new Decimal(0),
    advanceCost: new Decimal(0),
    wcInterest: new Decimal(0),
    outputVat: new Decimal(0),
    inputVat: new Decimal(0),
    vatPayable: new Decimal(0),
    totalCost: new Decimal(0),
    profit: new Decimal(0),
  };
}

function finishPnl(pnl: ExcelPnl): ExcelPnl {
  pnl.vatPayable = calcExcelVatPayable(pnl.outputVat, pnl.inputVat);
  pnl.totalCost = pnl.vehicleCost
    .plus(pnl.managementFee)
    .plus(pnl.roadFee)
    .plus(pnl.maintenanceFee)
    .plus(pnl.inspectionFee)
    .plus(pnl.insuranceFee)
    .plus(pnl.parkingFee)
    .plus(pnl.heaterFee)
    .plus(pnl.consumableFee)
    .plus(pnl.driverCost)
    .plus(pnl.tollCost)
    .plus(pnl.loadingCost)
    .plus(pnl.infoCost)
    .plus(pnl.energyCost)
    .plus(pnl.tireCost)
    .plus(pnl.advanceCost)
    .plus(pnl.wcInterest)
    .plus(pnl.vatPayable);
  pnl.profit = pnl.revenue.minus(pnl.totalCost);
  return pnl;
}

function lumpDriverCost(input: SchemeCalculationInput): Decimal {
  const unit = toDecimalOrZero(input.vehicle.driverCost);
  if (input.vehicle.driverCostType === "PER_VEHICLE_MONTH") {
    return unit.mul(input.fleetSize);
  }
  if (input.vehicle.driverCostType === "FIXED_MONTH") {
    return unit;
  }
  return new Decimal(0);
}

/** Excel 测算模型 月度利润表 AC39–AC62 */
export function calculateExcelMonthlyPnl(input: SchemeCalculationInput): {
  total: ExcelPnl;
  segments: ExcelSegmentPnl[];
  ctx: ExcelWorkingContext;
  annualizedRent: Decimal;
  actualMonthly: {
    rent: Decimal;
    managementFee: Decimal;
    roadFee: Decimal;
    maintenanceFee: Decimal;
    inspectionFee: Decimal;
    insuranceFee: Decimal;
    parkingFee: Decimal;
    heaterFee: Decimal;
    consumableFee: Decimal;
  };
} {
  const ctx = buildExcelContext(input);
  const vehicle = input.vehicle;
  const annualizedRent = excelAnnualizeMonthly(ctx.monthlyRent, ctx.fleetSize, ctx.operatingMonths);

  const total = emptyPnl();
  total.revenue = ctx.segments.reduce((sum, seg) => {
    const formula = resolveRevenueFormula(seg.input.freightPriceUnit, input.ruleSet.revenue.formulaByUnit);
    return sum.plus(calcSegmentRevenue(seg.input, ctx.fleetSize, formula));
  }, new Decimal(0));
  total.vehicleCost = calcExcelVehicleCost({
    isPureLease: ctx.isPureLease,
    fleetSize: ctx.fleetSize,
    monthlyRent: ctx.monthlyRent,
    downPayment: ctx.downPayment,
    depreciationMonths: ctx.depreciationMonths,
    operatingMonths: ctx.operatingMonths,
  });
  total.managementFee = excelAnnualizeMonthly(ctx.managementFeePerVehicle, ctx.fleetSize, ctx.operatingMonths);
  total.roadFee = excelAnnualizeMonthly(toDecimalOrZero(vehicle.roadMaintenanceFee), ctx.fleetSize, ctx.operatingMonths);
  total.maintenanceFee = excelAnnualizeMonthly(toDecimalOrZero(vehicle.maintenanceFee), ctx.fleetSize, ctx.operatingMonths);
  total.inspectionFee = excelAnnualizeMonthly(toDecimalOrZero(vehicle.annualInspectionFee), ctx.fleetSize, ctx.operatingMonths);
  total.insuranceFee = excelAnnualizeMonthly(toDecimalOrZero(vehicle.insuranceFee), ctx.fleetSize, ctx.operatingMonths);
  total.parkingFee = excelAnnualizeMonthly(toDecimalOrZero(vehicle.parkingFee), ctx.fleetSize, ctx.operatingMonths);
  total.heaterFee = excelAnnualizeMonthly(toDecimalOrZero(vehicle.heaterFee), ctx.fleetSize, ctx.operatingMonths);
  total.consumableFee = excelAnnualizeMonthly(toDecimalOrZero(vehicle.consumableFee), ctx.fleetSize, ctx.operatingMonths);

  total.driverCost = ctx.segments
    .reduce((sum, seg) => sum.plus(ctx.fleet.mul(seg.trips).mul(seg.driverPerTrip)), new Decimal(0))
    .plus(lumpDriverCost(input));
  total.tollCost = ctx.segments.reduce((sum, seg) => sum.plus(ctx.fleet.mul(seg.trips).mul(seg.tollPerTrip)), new Decimal(0));
  total.loadingCost = ctx.segments.reduce(
    (sum, seg) => sum.plus(ctx.fleet.mul(seg.trips).mul(seg.loadingPerTrip)),
    new Decimal(0),
  );
  total.infoCost = ctx.segments.reduce((sum, seg) => sum.plus(ctx.fleet.mul(seg.trips).mul(seg.infoPerTrip)), new Decimal(0));

  total.energyCost = ctx.segments.reduce(
    (sum, seg) =>
      sum.plus(
        calcExcelSegmentEnergyCost({
          fleetSize: ctx.fleetSize,
          electricityPrice: seg.electricityPrice,
          loadedConsumptionKwhKm: seg.loadedConsumption,
          emptyConsumptionKwhKm: seg.emptyConsumption,
          loadTon: seg.load,
          distanceKm: seg.distance,
          tripsPerVehicleMonth: seg.trips,
        }).energyCost,
      ),
    new Decimal(0),
  );

  if (ctx.tireLifeKm.lte(0) && ctx.tireCount.gt(0)) {
    throw new EngineError("CALC_DIV_ZERO", "tire_life_km", "轮胎寿命必须大于 0");
  }
  total.tireCost = ctx.tireLifeKm.lte(0)
    ? new Decimal(0)
    : ctx.totalWeight.div(ctx.tireLifeKm).mul(ctx.tireCount).mul(ctx.fleet).mul(ctx.tireUnitPrice);

  total.advanceCost = calcExcelAdvanceCost({
    revenue: total.revenue,
    discountRate: ctx.discountRate,
    receivableCycleMonths: ctx.receivableMonths,
  });

  const sumAc42ToAc55 = total.managementFee
    .plus(total.roadFee)
    .plus(total.maintenanceFee)
    .plus(total.inspectionFee)
    .plus(total.insuranceFee)
    .plus(total.parkingFee)
    .plus(total.heaterFee)
    .plus(total.consumableFee)
    .plus(total.driverCost)
    .plus(total.tollCost)
    .plus(total.loadingCost)
    .plus(total.infoCost)
    .plus(total.energyCost)
    .plus(total.tireCost);

  total.wcInterest = calcExcelWorkingCapitalInterest({
    annualizedRent,
    sumAc42ToAc55,
    workingCapitalInterestRate: ctx.wcRate,
    loanCycleMonths: ctx.loanCycleMonths,
  });
  total.outputVat = calcExcelOutputVat(total.revenue, ctx.outputVatRate);
  total.inputVat = calcExcelInputVat({
    vehicleCost: total.vehicleCost,
    energyCost: total.energyCost,
    tireCost: total.tireCost,
    insuranceCost: total.insuranceFee,
    inputStandardRate: ctx.inputStandardRate,
    inputInsuranceRate: ctx.inputInsuranceRate,
  });
  finishPnl(total);

  const segments: ExcelSegmentPnl[] = ctx.segments.map((seg) => {
    const row = emptyPnl();
    const share = seg.weight.div(ctx.totalWeight);
    const formula = resolveRevenueFormula(seg.input.freightPriceUnit, input.ruleSet.revenue.formulaByUnit);
    row.revenue = calcSegmentRevenue(seg.input, ctx.fleetSize, formula);
    row.driverCost = ctx.fleet.mul(seg.trips).mul(seg.driverPerTrip);
    row.tollCost = ctx.fleet.mul(seg.trips).mul(seg.tollPerTrip);
    row.loadingCost = ctx.fleet.mul(seg.trips).mul(seg.loadingPerTrip);
    row.infoCost = ctx.fleet.mul(seg.trips).mul(seg.infoPerTrip);
    row.energyCost = calcExcelSegmentEnergyCost({
      fleetSize: ctx.fleetSize,
      electricityPrice: seg.electricityPrice,
      loadedConsumptionKwhKm: seg.loadedConsumption,
      emptyConsumptionKwhKm: seg.emptyConsumption,
      loadTon: seg.load,
      distanceKm: seg.distance,
      tripsPerVehicleMonth: seg.trips,
    }).energyCost;
    for (const key of ALLOCATED_KEYS) {
      row[key] = total[key].mul(share);
    }
    finishPnl(row);
    return {
      ...row,
      segmentId: seg.input.id,
      routeId: seg.input.routeId,
      segmentName: seg.input.segmentName,
      weight: seg.weight,
      loadState: seg.load.isZero() ? "EMPTY" : "LOADED",
      driverCostSource: seg.driverCostSource,
    };
  });

  if (lumpDriverCost(input).gt(0)) {
    for (const row of segments) {
      row.driverCost = row.driverCost.plus(lumpDriverCost(input).mul(row.weight.div(ctx.totalWeight)));
      finishPnl(row);
    }
  }

  return {
    total,
    segments,
    ctx,
    annualizedRent,
    actualMonthly: {
      rent: ctx.monthlyRent.mul(ctx.fleetSize),
      managementFee: ctx.managementFeePerVehicle.mul(ctx.fleetSize),
      roadFee: toDecimalOrZero(vehicle.roadMaintenanceFee).mul(ctx.fleetSize),
      maintenanceFee: toDecimalOrZero(vehicle.maintenanceFee).mul(ctx.fleetSize),
      inspectionFee: toDecimalOrZero(vehicle.annualInspectionFee).mul(ctx.fleetSize),
      insuranceFee: toDecimalOrZero(vehicle.insuranceFee).mul(ctx.fleetSize),
      parkingFee: toDecimalOrZero(vehicle.parkingFee).mul(ctx.fleetSize),
      heaterFee: toDecimalOrZero(vehicle.heaterFee).mul(ctx.fleetSize),
      consumableFee: toDecimalOrZero(vehicle.consumableFee).mul(ctx.fleetSize),
    },
  };
}

function revenueHorizonMonths(ctx: ExcelWorkingContext): number {
  if (ctx.projectOperatingMonths > 0) return ctx.projectOperatingMonths;
  if (ctx.isPureLease) {
    if (ctx.installmentMonths > 0) return ctx.installmentMonths;
    return ctx.calculationYears * 12;
  }
  const dep = ctx.depreciationMonths.toNumber();
  if (dep > 0) return dep;
  return ctx.calculationYears * 12;
}

function yearActive(ctx: ExcelWorkingContext, year: number, kind: "revenueWindow" | "rentFull" | "rentResidual"): boolean {
  const monthCursor = year * 12;
  if (ctx.projectOperatingMonths > 0) {
    return monthCursor <= ctx.projectOperatingMonths;
  }
  if (ctx.isPureLease) {
    return monthCursor <= revenueHorizonMonths(ctx);
  }
  if (kind === "rentFull") return monthCursor <= ctx.installmentMonths;
  if (kind === "rentResidual") return monthCursor > ctx.installmentMonths && monthCursor <= ctx.depreciationMonths.toNumber();
  return monthCursor <= ctx.depreciationMonths.toNumber();
}

function annualRent(ctx: ExcelWorkingContext, year: number): Decimal {
  if (ctx.isPureLease) {
    return yearActive(ctx, year, "rentFull") ? ctx.monthlyRent.mul(ctx.fleetSize).mul(12) : new Decimal(0);
  }
  if (yearActive(ctx, year, "rentFull")) {
    return ctx.monthlyRent.mul(ctx.fleetSize).mul(12);
  }
  if (yearActive(ctx, year, "rentResidual")) {
    return new Decimal(ctx.installmentMonths % 12).mul(ctx.monthlyRent).mul(ctx.fleetSize);
  }
  return new Decimal(0);
}

/** Excel 年度现金流 AI61 / AJ61… 及 IRR(4/5/6/8年) */
export function calculateExcelAnnualCashFlows(
  input: SchemeCalculationInput,
  pnl = calculateExcelMonthlyPnl(input),
  maxYear = 8,
): AnnualCashFlow[] {
  const { total, ctx, actualMonthly } = pnl;
  const down = ctx.downPayment.mul(ctx.fleetSize);
  const year0InputVat = down.mul(ctx.inputStandardRate).div(ctx.inputStandardRate.plus(1));
  const year0Vat = new Decimal(0).minus(year0InputVat);
  const year0Net = down.negated().plus(year0Vat);

  const rows: AnnualCashFlow[] = [
    { yearIndex: 0, currentNetCashFlow: year0Net, cumulativeCashFlow: year0Net, active: true },
  ];
  let cumulative = year0Net;

  for (let year = 1; year <= maxYear; year++) {
    const active = yearActive(ctx, year, "revenueWindow");
    if (!active) {
      cumulative = cumulative.plus(0);
      rows.push({ yearIndex: year, currentNetCashFlow: new Decimal(0), cumulativeCashFlow: cumulative, active: false });
      continue;
    }

    const revenue = total.revenue.mul(ctx.operatingMonths);
    const rent = annualRent(ctx, year);
    const times12 = (monthlyActual: Decimal) => monthlyActual.mul(12);
    const timesOp = (monthlyPnl: Decimal) => monthlyPnl.mul(ctx.operatingMonths);

    const managementFee = times12(actualMonthly.managementFee);
    const roadFee = times12(actualMonthly.roadFee);
    const maintenanceFee = times12(actualMonthly.maintenanceFee);
    const inspectionFee = times12(actualMonthly.inspectionFee);
    const insuranceFee = times12(actualMonthly.insuranceFee);
    const parkingFee = times12(actualMonthly.parkingFee);
    const heaterFee = times12(actualMonthly.heaterFee);
    const consumableFee = times12(actualMonthly.consumableFee);
    const driverCost = timesOp(total.driverCost);
    const tollCost = timesOp(total.tollCost);
    const loadingCost = timesOp(total.loadingCost);
    const infoCost = timesOp(total.infoCost);
    const energyCost = timesOp(total.energyCost);
    const tireCost = timesOp(total.tireCost);
    const advanceCost = revenue.mul(ctx.discountRate).div(12).mul(ctx.receivableMonths);
    const sum41to55 = rent
      .plus(managementFee)
      .plus(roadFee)
      .plus(maintenanceFee)
      .plus(inspectionFee)
      .plus(insuranceFee)
      .plus(parkingFee)
      .plus(heaterFee)
      .plus(consumableFee)
      .plus(driverCost)
      .plus(tollCost)
      .plus(loadingCost)
      .plus(infoCost)
      .plus(energyCost)
      .plus(tireCost);
    const wcInterest = sum41to55.mul(ctx.wcRate).div(12).mul(ctx.loanCycleMonths);
    const outputVat = calcExcelOutputVat(revenue, ctx.outputVatRate);
    const inputVat = calcExcelInputVat({
      vehicleCost: rent,
      energyCost,
      tireCost,
      insuranceCost: insuranceFee,
      inputStandardRate: ctx.inputStandardRate,
      inputInsuranceRate: ctx.inputInsuranceRate,
    });
    const vatPayable = calcExcelVatPayable(outputVat, inputVat);
    const current = revenue.minus(sum41to55).minus(advanceCost).minus(wcInterest).minus(vatPayable);
    cumulative = cumulative.plus(current);
    rows.push({ yearIndex: year, currentNetCashFlow: current, cumulativeCashFlow: cumulative, active: true });
  }

  return rows;
}

/** Excel 月度现金流 AJ3–AJ25，并按测算年数展开 */
export function calculateExcelMonthlyCashFlows(
  input: SchemeCalculationInput,
  pnl = calculateExcelMonthlyPnl(input),
): MonthlyCashFlow[] {
  const { total, ctx, actualMonthly } = pnl;
  const months = input.calculationYears * 12;
  const rows: MonthlyCashFlow[] = [];
  let cumulative = new Decimal(0);

  for (let month = 1; month <= months; month++) {
    const year = Math.ceil(month / 12);
    const monthInYear = ((month - 1) % 12) + 1;
    const active = yearActive(ctx, year, "revenueWindow") || (ctx.isPureLease && month <= ctx.installmentMonths);
    const operating = active && monthInYear <= ctx.operatingMonths.toNumber();
    const revenue = operating ? total.revenue : new Decimal(0);
    const rent = month <= ctx.installmentMonths ? actualMonthly.rent : new Decimal(0);
    const managementFee = active ? actualMonthly.managementFee : new Decimal(0);
    const roadFee = active ? actualMonthly.roadFee : new Decimal(0);
    const maintenanceFee = active ? actualMonthly.maintenanceFee : new Decimal(0);
    const inspectionFee = active ? actualMonthly.inspectionFee : new Decimal(0);
    const insuranceFee = active ? actualMonthly.insuranceFee : new Decimal(0);
    const parkingFee = active ? actualMonthly.parkingFee : new Decimal(0);
    const heaterFee = active ? actualMonthly.heaterFee : new Decimal(0);
    const consumableFee = active ? actualMonthly.consumableFee : new Decimal(0);
    const driverCost = operating ? total.driverCost : new Decimal(0);
    const tollCost = operating ? total.tollCost : new Decimal(0);
    const loadingCost = operating ? total.loadingCost : new Decimal(0);
    const infoCost = operating ? total.infoCost : new Decimal(0);
    const energyCost = operating ? total.energyCost : new Decimal(0);
    const tireCost = operating ? total.tireCost : new Decimal(0);
    const advanceCost = revenue.mul(ctx.discountRate).div(12).mul(ctx.receivableMonths);
    const sum5to19 = rent
      .plus(managementFee)
      .plus(roadFee)
      .plus(maintenanceFee)
      .plus(inspectionFee)
      .plus(insuranceFee)
      .plus(parkingFee)
      .plus(heaterFee)
      .plus(consumableFee)
      .plus(driverCost)
      .plus(tollCost)
      .plus(loadingCost)
      .plus(infoCost)
      .plus(energyCost)
      .plus(tireCost);
    const wcInterest = sum5to19.mul(ctx.wcRate).div(12).mul(ctx.loanCycleMonths);
    const outputVat = calcExcelOutputVat(revenue, ctx.outputVatRate);
    const inputVat = calcExcelInputVat({
      vehicleCost: rent,
      energyCost,
      tireCost,
      insuranceCost: insuranceFee,
      inputStandardRate: ctx.inputStandardRate,
      inputInsuranceRate: ctx.inputInsuranceRate,
    });
    const vatCash = outputVat.minus(inputVat);
    const operatingCashOut = managementFee
      .plus(roadFee)
      .plus(maintenanceFee)
      .plus(inspectionFee)
      .plus(insuranceFee)
      .plus(parkingFee)
      .plus(heaterFee)
      .plus(consumableFee)
      .plus(driverCost)
      .plus(tollCost)
      .plus(loadingCost)
      .plus(infoCost)
      .plus(energyCost)
      .plus(tireCost)
      .plus(advanceCost);
    const current = revenue.minus(sum5to19).minus(advanceCost).minus(wcInterest).minus(vatCash);
    cumulative = cumulative.plus(current);
    rows.push({
      monthIndex: month,
      revenueCashIn: revenue,
      operatingCashOut,
      vehicleCashOut: rent,
      financingCashFlow: wcInterest,
      taxCashOut: vatCash,
      currentNetCashFlow: current,
      cumulativeCashFlow: cumulative,
    });
  }

  return rows;
}

export function calculateExcelIrrByYears(annual: AnnualCashFlow[]): { years: number; irr: Decimal | null; reason: string | null }[] {
  return [4, 5, 6, 8].map((years) => {
    const series = annual.slice(0, years + 1).map((row) => row.currentNetCashFlow);
    return { years, ...newtonRaphsonPeriodicIrr(series) };
  });
}

export function calculateExcelV5(input: SchemeCalculationInput) {
  const pnl = calculateExcelMonthlyPnl(input);
  const annualCashFlows = calculateExcelAnnualCashFlows(input, pnl);
  const cashFlows = calculateExcelMonthlyCashFlows(input, pnl);
  const irrByYears = calculateExcelIrrByYears(annualCashFlows);
  const irr8 = irrByYears.find((item) => item.years === 8) ?? irrByYears[irrByYears.length - 1];
  return {
    ...pnl,
    cashFlows,
    annualCashFlows,
    irrByYears,
    irr: irr8?.irr ?? null,
    irrReason: irr8?.reason ?? null,
  };
}
