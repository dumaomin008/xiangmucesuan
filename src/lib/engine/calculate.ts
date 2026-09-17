import { Decimal, EngineError, roundMoney, safeDiv } from "./decimal";
import { calculateExcelV5, enabledSegments, resolveOperatingMonthsYear } from "./excel-v5";
import { firstPositiveMonth } from "./investment";
import { calcProfitMargin } from "./profit";
import { buildSegmentBaseMetrics, summarizeFreightPricing } from "./revenue";
import { buildTraces } from "./trace";
import type {
  CostBreakdownItem,
  RouteMetrics,
  SchemeCalculationInput,
  SchemeCalculationOutput,
  SegmentMetrics,
} from "./types";
import { issuesToErrors, validateSchemeInput } from "./validate";
import { calcExcelSegmentEnergyCost } from "./energy";
import { toDecimalOrZero } from "./decimal";

export function calculateScheme(input: SchemeCalculationInput): SchemeCalculationOutput {
  const { errors, warnings } = validateSchemeInput(input);
  if (errors.length > 0) {
    throw issuesToErrors(errors)[0] ?? new EngineError("CALC_PARAMETER_INVALID", "scheme", "参数校验失败");
  }

  const excel = calculateExcelV5(input);
  const { total, segments: excelSegments, ctx, cashFlows, annualCashFlows, irr, irrReason, irrByYears } = excel;

  const monthlyRevenue = total.revenue;
  const monthlyFixedCost = total.vehicleCost
    .plus(total.managementFee)
    .plus(total.roadFee)
    .plus(total.maintenanceFee)
    .plus(total.inspectionFee)
    .plus(total.insuranceFee)
    .plus(total.parkingFee)
    .plus(total.heaterFee)
    .plus(total.consumableFee);
  const monthlyVariableCost = total.driverCost
    .plus(total.tollCost)
    .plus(total.loadingCost)
    .plus(total.infoCost)
    .plus(total.energyCost)
    .plus(total.tireCost);
  const monthlyFinanceCost = total.advanceCost.plus(total.wcInterest);
  const monthlyTaxCost = total.vatPayable;
  const monthlyTotalCost = total.totalCost;
  const monthlyProfit = total.profit;
  const { margin, reason } = calcProfitMargin(monthlyProfit, monthlyRevenue);

  const excelBySegment = new Map(excelSegments.map((row) => [row.segmentId, row]));
  const routeMetrics: RouteMetrics[] = [];
  const allSegments: SegmentMetrics[] = [];
  let volumeTotal = new Decimal(0);
  let mileageTotal = new Decimal(0);

  for (const route of input.routes.filter((r) => r.enabled)) {
    const segs: SegmentMetrics[] = [];
    for (const segment of route.segments.filter((s) => s.enabled)) {
      const base = buildSegmentBaseMetrics(input, segment, route.id);
      const excelRow = excelBySegment.get(segment.id);
      if (!excelRow) continue;
      const loadState = excelRow.loadState;
      const empty = loadState === "EMPTY";
      const ctxSeg = ctx.segments.find((s) => s.input.id === segment.id);
      const segPrice = ctxSeg?.electricityPrice ?? ctx.electricityPrice;
      const metrics: SegmentMetrics = {
        ...base,
        loadedDistance: empty ? new Decimal(0) : base.distanceKm,
        emptyDistance: empty ? base.distanceKm : new Decimal(0),
        loadedMileage: empty ? new Decimal(0) : base.segmentMonthlyMileage,
        emptyMileage: empty ? base.segmentMonthlyMileage : new Decimal(0),
        energyQuantity: excelRow.energyCost.isZero() || segPrice.isZero() ? new Decimal(0) : excelRow.energyCost.div(segPrice),
        energyCost: excelRow.energyCost,
        tollCost: excelRow.tollCost,
        loadingUnloadingCost: excelRow.loadingCost,
        informationFeeCost: excelRow.infoCost,
        tireCost: excelRow.tireCost,
        otherVariableCost: excelRow.tollCost.plus(excelRow.loadingCost).plus(excelRow.infoCost),
        monthlyProfit: excelRow.profit,
        monthlyRevenue: excelRow.revenue,
        allocationWeight: excelRow.weight.div(ctx.totalWeight),
        allocationWeightRaw: excelRow.weight,
        loadState,
        allocatedFixedCost: excelRow.vehicleCost
          .plus(excelRow.managementFee)
          .plus(excelRow.roadFee)
          .plus(excelRow.maintenanceFee)
          .plus(excelRow.inspectionFee)
          .plus(excelRow.insuranceFee)
          .plus(excelRow.parkingFee)
          .plus(excelRow.heaterFee)
          .plus(excelRow.consumableFee),
        allocatedFinanceCost: excelRow.advanceCost.plus(excelRow.wcInterest),
        taxCost: excelRow.vatPayable,
        driverCost: excelRow.driverCost,
        driverCostSource: excelRow.driverCostSource,
      };
      segs.push(metrics);
      allSegments.push(metrics);
      volumeTotal = volumeTotal.plus(base.segmentMonthlyVolume);
      mileageTotal = mileageTotal.plus(base.segmentMonthlyMileage);
    }
    const routeRevenue = segs.reduce((sum, x) => sum.plus(x.monthlyRevenue), new Decimal(0));
    const routeProfit = segs.reduce((sum, x) => sum.plus(x.monthlyProfit ?? new Decimal(0)), new Decimal(0));
    routeMetrics.push({
      routeId: route.id,
      routeName: route.routeName,
      weight: route.weight,
      monthlyRevenue: routeRevenue,
      monthlyVolume: segs.reduce((s, x) => s.plus(x.segmentMonthlyVolume), new Decimal(0)),
      monthlyMileage: segs.reduce((s, x) => s.plus(x.segmentMonthlyMileage), new Decimal(0)),
      energyCost: segs.reduce((s, x) => s.plus(x.energyCost), new Decimal(0)),
      variableCost: segs.reduce(
        (s, x) => s.plus(x.energyCost).plus(x.tollCost).plus(x.loadingUnloadingCost).plus(x.informationFeeCost).plus(x.tireCost),
        new Decimal(0),
      ),
      fixedCost: segs.reduce((s, x) => {
        const row = excelBySegment.get(x.segmentId);
        if (!row) return s;
        return s
          .plus(row.vehicleCost)
          .plus(row.managementFee)
          .plus(row.roadFee)
          .plus(row.maintenanceFee)
          .plus(row.inspectionFee)
          .plus(row.insuranceFee)
          .plus(row.parkingFee)
          .plus(row.heaterFee)
          .plus(row.consumableFee);
      }, new Decimal(0)),
      financeCost: segs.reduce((s, x) => {
        const row = excelBySegment.get(x.segmentId);
        return row ? s.plus(row.advanceCost).plus(row.wcInterest) : s;
      }, new Decimal(0)),
      taxCost: segs.reduce((s, x) => {
        const row = excelBySegment.get(x.segmentId);
        return row ? s.plus(row.vatPayable) : s;
      }, new Decimal(0)),
      monthlyProfit: routeProfit,
      profitMargin: calcProfitMargin(routeProfit, routeRevenue).margin,
      segments: segs,
    });
  }

  const revenueShare = (amount: Decimal) => safeDiv(amount, monthlyRevenue);
  const costItems: CostBreakdownItem[] = [
    { code: "vehicle_cost", name: "车辆成本", amount: total.vehicleCost, share: revenueShare(total.vehicleCost) },
    { code: "management_fee", name: "车辆管理费", amount: total.managementFee, share: revenueShare(total.managementFee) },
    { code: "road_maintenance_fee", name: "路保费", amount: total.roadFee, share: revenueShare(total.roadFee) },
    { code: "maintenance_fee", name: "维保费", amount: total.maintenanceFee, share: revenueShare(total.maintenanceFee) },
    { code: "inspection_fee", name: "审验费", amount: total.inspectionFee, share: revenueShare(total.inspectionFee) },
    { code: "insurance_fee", name: "保险费", amount: total.insuranceFee, share: revenueShare(total.insuranceFee) },
    { code: "parking_fee", name: "停车费", amount: total.parkingFee, share: revenueShare(total.parkingFee) },
    { code: "heater_fee", name: "柴暖费", amount: total.heaterFee, share: revenueShare(total.heaterFee) },
    { code: "consumable_fee", name: "消耗费用", amount: total.consumableFee, share: revenueShare(total.consumableFee) },
    { code: "driver_cost", name: "司机成本", amount: total.driverCost, share: revenueShare(total.driverCost) },
    { code: "energy_cost", name: "能源成本", amount: total.energyCost, share: revenueShare(total.energyCost) },
    { code: "tire_cost", name: "轮胎成本", amount: total.tireCost, share: revenueShare(total.tireCost) },
    { code: "toll", name: "过路费", amount: total.tollCost, share: revenueShare(total.tollCost) },
    { code: "loading_unloading", name: "装卸费", amount: total.loadingCost, share: revenueShare(total.loadingCost) },
    { code: "information_fee", name: "信息费", amount: total.infoCost, share: revenueShare(total.infoCost) },
    { code: "finance_cost", name: "财务成本", amount: monthlyFinanceCost, share: revenueShare(monthlyFinanceCost) },
    { code: "tax_cost", name: "增值税税金", amount: monthlyTaxCost, share: revenueShare(monthlyTaxCost) },
  ];

  const vehicleMonthlyRevenue = safeDiv(monthlyRevenue, new Decimal(input.fleetSize));
  const vehicleMonthlyProfit = safeDiv(monthlyProfit, new Decimal(input.fleetSize));

  const traces = [
    ...buildTraces({
      input,
      monthlyRevenue,
      monthlyTotalCost,
      monthlyProfit,
      profitMargin: margin,
      energyCost: total.energyCost,
      tireCost: total.tireCost,
      sampleSegment: allSegments[0],
    }),
    {
      resultCode: "output_vat",
      resultName: "销项税额",
      resultValue: roundMoney(total.outputVat).toFixed(2),
      unit: "元",
      ruleCode: "R008",
      ruleVersion: input.ruleSet.ruleVersionId,
      calculationExpression: `output_vat = revenue × ${input.ruleSet.vatRates.outputInclusiveRate} / (1+${input.ruleSet.vatRates.outputInclusiveRate})`,
      explanation: "销项 VAT 由 Rule Engine 含税口径控制，不在计算器内硬编码税率。",
      sourceParameterSnapshot: {
        output_vat_rate: input.finance.outputVatRate,
        rule_output_rate: input.ruleSet.vatRates.outputInclusiveRate,
        vat_mode: input.ruleSet.vatMode,
      },
      sortNo: 20,
    },
    {
      resultCode: "input_vat",
      resultName: "进项税额",
      resultValue: roundMoney(total.inputVat).toFixed(2),
      unit: "元",
      ruleCode: "R008",
      ruleVersion: input.ruleSet.ruleVersionId,
      calculationExpression: `input_vat = (车辆+能源+轮胎)×${input.ruleSet.vatRates.inputStandardRate}/(1+${input.ruleSet.vatRates.inputStandardRate}) + 保险×${input.ruleSet.vatRates.inputInsuranceRate}/(1+${input.ruleSet.vatRates.inputInsuranceRate})`,
      explanation: "进项税率由 Rule Version 的 vatRates 统一控制，可随规则版本调整。",
      sourceParameterSnapshot: {
        input_standard_rate: input.ruleSet.vatRates.inputStandardRate,
        input_insurance_rate: input.ruleSet.vatRates.inputInsuranceRate,
        vat_mode: input.ruleSet.vatMode,
      },
      sortNo: 21,
    },
    {
      resultCode: "vat_payable",
      resultName: "增值税税金",
      resultValue: roundMoney(total.vatPayable).toFixed(2),
      unit: "元",
      ruleCode: "R008",
      ruleVersion: input.ruleSet.ruleVersionId,
      calculationExpression: "vat_payable = MAX(0, output_vat - input_vat)",
      explanation: "税额为负时利润表记 0。",
      sourceParameterSnapshot: {},
      sortNo: 22,
    },
    {
      resultCode: "wc_interest",
      resultName: "流动资金贷款利息",
      resultValue: roundMoney(total.wcInterest).toFixed(2),
      unit: "元",
      ruleCode: "R007",
      ruleVersion: input.ruleSet.ruleVersionId,
      calculationExpression: "(年化月租 + SUM(管理费至轮胎)) × 利率/12 × 贷款周期",
      explanation: "基数用年化月租，不含非纯租赁首付摊销。",
      sourceParameterSnapshot: {
        working_capital_interest_rate: input.finance.workingCapitalInterestRate,
        loan_cycle_months: String(input.finance.workingCapitalLoanCycle),
      },
      sortNo: 23,
    },
  ];

  return {
    monthlyRevenue: roundMoney(monthlyRevenue),
    monthlyFixedCost: roundMoney(monthlyFixedCost),
    monthlyVariableCost: roundMoney(monthlyVariableCost),
    monthlyFinanceCost: roundMoney(monthlyFinanceCost),
    monthlyTaxCost: roundMoney(monthlyTaxCost),
    monthlyTotalCost: roundMoney(monthlyTotalCost),
    monthlyProfit: roundMoney(monthlyProfit),
    profitMargin: margin,
    profitMarginReason: reason,
    vehicleMonthlyRevenue: vehicleMonthlyRevenue ? roundMoney(vehicleMonthlyRevenue) : new Decimal(0),
    vehicleMonthlyProfit: vehicleMonthlyProfit ? roundMoney(vehicleMonthlyProfit) : null,
    monthlyVolume: roundQtySafe(volumeTotal),
    monthlyMileage: roundQtySafe(mileageTotal),
    costBreakdown: costItems.map((item) => ({
      ...item,
      amount: roundMoney(item.amount),
    })),
    routes: routeMetrics.map((route) => ({
      ...route,
      monthlyRevenue: roundMoney(route.monthlyRevenue),
      monthlyProfit: roundMoney(route.monthlyProfit),
      segments: route.segments.map((seg) => ({
        ...seg,
        monthlyRevenue: roundMoney(seg.monthlyRevenue),
        energyCost: roundMoney(seg.energyCost),
        monthlyProfit: seg.monthlyProfit ? roundMoney(seg.monthlyProfit) : null,
        allocatedFixedCost: roundMoney(seg.allocatedFixedCost),
        allocatedFinanceCost: roundMoney(seg.allocatedFinanceCost),
        taxCost: roundMoney(seg.taxCost),
        driverCost: roundMoney(seg.driverCost),
        allocationWeight: seg.allocationWeight.toDecimalPlaces(6),
        allocationWeightRaw: roundQtySafe(seg.allocationWeightRaw),
      })),
    })),
    cashFlows: cashFlows.map((row) => ({
      ...row,
      revenueCashIn: roundMoney(row.revenueCashIn),
      operatingCashOut: roundMoney(row.operatingCashOut),
      vehicleCashOut: roundMoney(row.vehicleCashOut),
      financingCashFlow: roundMoney(row.financingCashFlow),
      taxCashOut: roundMoney(row.taxCashOut),
      currentNetCashFlow: roundMoney(row.currentNetCashFlow),
      cumulativeCashFlow: roundMoney(row.cumulativeCashFlow),
    })),
    annualCashFlows: annualCashFlows.map((row) => ({
      ...row,
      currentNetCashFlow: roundMoney(row.currentNetCashFlow),
      cumulativeCashFlow: roundMoney(row.cumulativeCashFlow),
    })),
    irr,
    irrReason,
    irrByYears,
    firstPositiveMonth: firstPositiveMonth(cashFlows),
    cumulativeCashFlow: cashFlows.length
      ? roundMoney(cashFlows[cashFlows.length - 1].cumulativeCashFlow)
      : new Decimal(0),
    traces,
    warnings,
    ruleVersionId: input.ruleSet.ruleVersionId,
    freightPricing: summarizeFreightPricing(input),
    operatingMonthsYear: resolveOperatingMonthsYear(input).toNumber(),
    projectOperatingMonths: input.finance.projectOperatingMonths ?? null,
  };
}

function roundQtySafe(v: Decimal): Decimal {
  return v.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

export function previewSegmentHelpers(
  input: Pick<SchemeCalculationInput, "fleetSize" | "ruleSet">,
  segment: Parameters<typeof buildSegmentBaseMetrics>[1],
  routeId: string,
) {
  const base = buildSegmentBaseMetrics(input as SchemeCalculationInput, segment, routeId);
  const energy = calcExcelSegmentEnergyCost({
    fleetSize: input.fleetSize,
    electricityPrice: toDecimalOrZero(segment.electricityPrice),
    loadedConsumptionKwhKm: toDecimalOrZero(segment.loadedEnergyConsumption),
    emptyConsumptionKwhKm: toDecimalOrZero(segment.emptyEnergyConsumption),
    loadTon: toDecimalOrZero(segment.loadTon),
    distanceKm: toDecimalOrZero(segment.distanceKm),
    tripsPerVehicleMonth: toDecimalOrZero(segment.tripsPerVehicleMonth),
  });
  return {
    vehicleMonthlyVolume: roundQtySafe(base.vehicleMonthlyVolume).toNumber(),
    vehicleMonthlyMileage: roundQtySafe(base.vehicleMonthlyMileage).toNumber(),
    segmentMonthlyVolume: roundQtySafe(base.segmentMonthlyVolume).toNumber(),
    segmentMonthlyRevenue: roundMoney(base.monthlyRevenue).toNumber(),
    segmentMonthlyEnergyCost: roundMoney(energy.energyCost).toNumber(),
  };
}

export { enabledSegments };
