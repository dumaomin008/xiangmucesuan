import { prisma } from "@/lib/db";
import { calculateScheme } from "@/lib/engine/calculate";
import { EngineError } from "@/lib/engine/decimal";
import { DEFAULT_RULE_SET } from "@/lib/engine/rule-engine";
import { runSensitivity } from "@/lib/engine/sensitivity";
import type {
  LeaseCashFlowRule,
  RuleSet,
  SchemeCalculationInput,
  SensitivityVariableCode,
} from "@/lib/engine/types";
import { validateSchemeInput } from "@/lib/engine/validate";

function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export async function loadRuleSet(ruleVersionId: string): Promise<RuleSet> {
  const versions = await prisma.calculationRuleVersion.findMany({
    where: { version: ruleVersionId, enabled: true },
    include: { rule: true },
  });
  const pick = (code: string) =>
    versions.find((v) => v.rule.ruleCode === code)?.configJson;

  return {
    ...DEFAULT_RULE_SET,
    ruleVersionId,
    energyMileage: parseJson(pick("ENERGY_MILEAGE") ?? "", DEFAULT_RULE_SET.energyMileage),
    revenue: parseJson(pick("REVENUE") ?? "", DEFAULT_RULE_SET.revenue),
    finance: parseJson(pick("FINANCE") ?? "", DEFAULT_RULE_SET.finance),
    maintenance: parseJson(pick("MAINTENANCE") ?? "", DEFAULT_RULE_SET.maintenance),
    driverCostDefaultType: parseJson(pick("DRIVER_COST") ?? "", { type: DEFAULT_RULE_SET.driverCostDefaultType }).type,
    pricesIncludeVat: parseJson(pick("TAX_PRICE") ?? "", { pricesIncludeVat: DEFAULT_RULE_SET.pricesIncludeVat }).pricesIncludeVat,
    annualFeeAmortizationMonths: parseJson(pick("ANNUAL_AMORT") ?? "", { months: DEFAULT_RULE_SET.annualFeeAmortizationMonths }).months,
    energyUnit: parseJson(pick("ENERGY_UNIT") ?? "", { energyUnit: DEFAULT_RULE_SET.energyUnit }).energyUnit,
    energyLoadMode: parseJson(pick("ENERGY_LOAD_MODE") ?? "", { energyLoadMode: DEFAULT_RULE_SET.energyLoadMode }).energyLoadMode,
    vatMode: parseJson(pick("VAT_MODE") ?? "", { vatMode: DEFAULT_RULE_SET.vatMode }).vatMode,
    vatRates: parseJson(pick("VAT_RATES") ?? "", DEFAULT_RULE_SET.vatRates),
    allocationWeight: parseJson(pick("ALLOCATION") ?? "", { allocationWeight: DEFAULT_RULE_SET.allocationWeight }).allocationWeight,
    workingCapitalBase: parseJson(pick("WC_BASE") ?? "", { workingCapitalBase: DEFAULT_RULE_SET.workingCapitalBase }).workingCapitalBase,
  };
}

export async function loadCalculationInput(schemeId: string): Promise<SchemeCalculationInput> {
  const scheme = await prisma.calculationScheme.findUnique({
    where: { id: schemeId },
    include: {
      routes: { include: { segments: { orderBy: { sortNo: "asc" } } }, orderBy: { sortNo: "asc" } },
      vehiclePlan: true,
      financeTaxPlan: true,
      overrides: true,
    },
  });
  if (!scheme || !scheme.vehiclePlan || !scheme.financeTaxPlan) {
    throw new EngineError("CALC_PARAMETER_INVALID", "scheme", "方案不完整，缺少运力或财税参数");
  }
  const vehiclePlan = scheme.vehiclePlan;
  const financeTaxPlan = scheme.financeTaxPlan;

  const [ruleSet, standardParameters, managementFeeTiers, leaseTypes, inputVatRules, freightPriceUnits] =
    await Promise.all([
      loadRuleSet(scheme.ruleVersionId),
      prisma.standardParameter.findMany({ where: { enabled: true } }),
      prisma.managementFeeTier.findMany({ where: { enabled: true } }),
      prisma.leaseTypeConfig.findMany({ where: { enabled: true } }),
      prisma.inputVatRuleConfig.findMany({ where: { enabled: true } }),
      prisma.freightPriceUnitConfig.findMany({ where: { enabled: true } }),
    ]);

  return {
    schemeId: scheme.id,
    schemeName: scheme.schemeName,
    versionNo: scheme.versionNo,
    fleetSize: scheme.fleetSize,
    leaseType: scheme.leaseType,
    calculationYears: scheme.calculationYears,
    routes: scheme.routes.map((route) => ({
      id: route.id,
      routeName: route.routeName,
      routeCode: route.routeCode,
      sortNo: route.sortNo,
      weight: route.weight,
      description: route.description,
      enabled: route.enabled,
      segments: route.segments.map((seg) => ({
        id: seg.id,
        routeId: seg.routeId,
        segmentName: seg.segmentName,
        sortNo: seg.sortNo,
        originName: seg.originName,
        destinationName: seg.destinationName,
        distanceKm: seg.distanceKm,
        freightPrice: seg.freightPrice,
        freightPriceUnit: seg.freightPriceUnit,
        loadTon: seg.loadTon,
        tripsPerVehicleMonth: seg.tripsPerVehicleMonth,
        operatingMonthsYear: seg.operatingMonthsYear,
        tollPerTrip: seg.tollPerTrip,
        loadingUnloadingFee: seg.loadingUnloadingFee,
        informationFee: seg.informationFee,
        loadedEnergyConsumption: seg.loadedEnergyConsumption,
        emptyEnergyConsumption: seg.emptyEnergyConsumption,
        electricityPrice: seg.electricityPrice,
        driverCostPerTrip: seg.driverCostPerTrip,
        enabled: seg.enabled,
      })),
    })),
    vehicle: {
      fleetSize: vehiclePlan.fleetSize,
      leaseType: vehiclePlan.leaseType,
      downPaymentPerVehicle: vehiclePlan.downPaymentPerVehicle,
      installmentMonths: vehiclePlan.installmentMonths,
      monthlyRentPerVehicle: vehiclePlan.monthlyRentPerVehicle,
      managementFeePerVehicle: vehiclePlan.managementFeePerVehicle,
      roadMaintenanceFee: vehiclePlan.roadMaintenanceFee,
      maintenanceFee: vehiclePlan.maintenanceFee,
      annualInspectionFee: vehiclePlan.annualInspectionFee,
      insuranceFee: vehiclePlan.insuranceFee,
      parkingFee: vehiclePlan.parkingFee,
      heaterFee: vehiclePlan.heaterFee,
      consumableFee: vehiclePlan.consumableFee,
      tireLifeKm: vehiclePlan.tireLifeKm,
      tireCount: vehiclePlan.tireCount,
      tireUnitPrice: vehiclePlan.tireUnitPrice,
      driverCost: vehiclePlan.driverCost,
      driverCostType: vehiclePlan.driverCostType as SchemeCalculationInput["vehicle"]["driverCostType"],
    },
    finance: {
      receivableCycle: financeTaxPlan.receivableCycle,
      workingCapitalLoanCycle: financeTaxPlan.workingCapitalLoanCycle,
      workingCapitalInterestRate: financeTaxPlan.workingCapitalInterestRate,
      discountRate: financeTaxPlan.discountRate,
      outputVatRate: financeTaxPlan.outputVatRate,
      inputVatRule: financeTaxPlan.inputVatRule,
      calculationYears: financeTaxPlan.calculationYears,
      depreciationMonths: financeTaxPlan.depreciationMonths ?? 60,
      projectOperatingMonths: financeTaxPlan.projectOperatingMonths,
      operatingMonthsYear: financeTaxPlan.operatingMonthsYear,
    },
    overrides: scheme.overrides.map((o) => ({
      parameterCode: o.parameterCode,
      standardValue: o.standardValue,
      overrideValue: o.overrideValue,
      overrideReason: o.overrideReason,
      unit: o.unit,
    })),
    standardParameters: standardParameters.map((p) => ({
      parameterCode: p.parameterCode,
      parameterName: p.parameterName,
      category: p.category,
      value: p.value,
      unit: p.unit,
      version: p.version,
    })),
    managementFeeTiers,
    leaseTypes: leaseTypes.map((item) => ({
      code: item.code,
      name: item.name,
      showDownPayment: item.showDownPayment,
      showInstallment: item.showInstallment,
      showMonthlyRent: item.showMonthlyRent,
      downPaymentRequired: item.downPaymentRequired,
      installmentRequired: item.installmentRequired,
      monthlyRentRequired: item.monthlyRentRequired,
      cashFlowRule: parseJson<LeaseCashFlowRule>(item.cashFlowRuleJson, {
        downPaymentMonth: 1,
        rentStartMonth: 1,
        rentDurationMode: "INSTALLMENT_MONTHS",
        treatDownPaymentAsFullPurchase: false,
      }),
      isPureLease: item.isPureLease,
    })),
    inputVatRules: inputVatRules.map((item) => ({
      code: item.code,
      name: item.name,
      deductibleCostCodes: parseJson<string[]>(item.deductibleCostCodesJson, []),
      inputVatRate: item.inputVatRate,
      negativeVatHandling: item.negativeVatHandling as "CARRY_FORWARD" | "RECOGNIZE_NEGATIVE",
    })),
    freightPriceUnits,
    ruleSet,
  };
}

export async function audit(action: string, entityType: string, entityId: string, actor: string, detail: unknown) {
  await prisma.auditLog.create({
    data: { action, entityType, entityId, actor, detailJson: JSON.stringify(detail) },
  });
}

export async function nextSchemeCode(projectId: string) {
  const count = await prisma.calculationScheme.count({ where: { projectId } });
  return `CS-${String(count + 1).padStart(3, "0")}`;
}

export async function createBlankScheme(
  projectId: string,
  actor: string,
  body: {
    schemeName?: string;
    description?: string;
    leaseType?: string;
    fleetSize?: number;
    calculationYears?: number;
    expectedStartDate?: string;
    expectedEndDate?: string;
    downPaymentPerVehicle?: string;
    installmentMonths?: number;
    monthlyRentPerVehicle?: string;
    receivableCycle?: number;
    workingCapitalLoanCycle?: number;
    inputVatRule?: string;
    depreciationMonths?: number;
    projectOperatingMonths?: number | null;
    operatingMonthsYear?: number | null;
  } = {},
) {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) throw new EngineError("NOT_FOUND", "project", "项目不存在");
  if (body.fleetSize != null) {
    const n = Number(body.fleetSize);
    if (!Number.isInteger(n) || n <= 0) {
      throw new EngineError("CALC_PARAMETER_INVALID", "fleet_size", "车辆数必须为正整数");
    }
  }
  const std = await prisma.standardParameter.findMany({ where: { enabled: true } });
  const pick = (code: string, fallback: string) => std.find((p) => p.parameterCode === code)?.value ?? fallback;

  const scheme = await prisma.calculationScheme.create({
    data: {
      projectId,
      schemeName: body.schemeName || "未命名测算方案",
      schemeCode: await nextSchemeCode(projectId),
      versionNo: "V1",
      status: "draft",
      description: body.description || "",
      leaseType: body.leaseType || "FINANCE_LEASE",
      fleetSize: Number(body.fleetSize || 1),
      calculationYears: Number(body.calculationYears || 5),
      expectedStartDate: body.expectedStartDate ? new Date(body.expectedStartDate) : null,
      expectedEndDate: body.expectedEndDate ? new Date(body.expectedEndDate) : null,
      createdBy: actor,
      updatedBy: actor,
      ruleVersionId: "RULE_PACK_V1",
    },
  });

  await prisma.vehiclePlan.create({
    data: {
      schemeId: scheme.id,
      fleetSize: scheme.fleetSize,
      leaseType: scheme.leaseType,
      downPaymentPerVehicle: body.downPaymentPerVehicle || "0",
      installmentMonths: Number(body.installmentMonths || 36),
      monthlyRentPerVehicle: body.monthlyRentPerVehicle || "0",
      managementFeePerVehicle: pick("STD_MANAGEMENT_FEE", "1500"),
      roadMaintenanceFee: pick("STD_ROAD_MAINTENANCE_FEE", "200"),
      maintenanceFee: pick("STD_MAINTENANCE_FEE", "800"),
      annualInspectionFee: pick("STD_ANNUAL_INSPECTION_FEE", "200"),
      insuranceFee: pick("STD_INSURANCE_FEE", "1000"),
      parkingFee: pick("STD_PARKING_FEE", "300"),
      heaterFee: pick("STD_HEATER_FEE", "150"),
      consumableFee: pick("STD_CONSUMABLE_FEE", "200"),
      tireLifeKm: pick("STD_TIRE_LIFE", "80000"),
      tireCount: Number(pick("STD_TIRE_COUNT", "12")),
      tireUnitPrice: pick("STD_TIRE_PRICE", "1800"),
      driverCost: pick("STD_DRIVER_COST", "12000"),
      driverCostType: "PER_VEHICLE_MONTH",
    },
  });

  await prisma.financeTaxPlan.create({
    data: {
      schemeId: scheme.id,
      receivableCycle: Number(body.receivableCycle || pick("STD_RECEIVABLE_CYCLE", "1")),
      workingCapitalLoanCycle: Number(body.workingCapitalLoanCycle || pick("STD_WC_LOAN_CYCLE", "1")),
      workingCapitalInterestRate: pick("STD_WC_INTEREST_RATE", "0.045"),
      discountRate: pick("STD_DISCOUNT_RATE", "0.04"),
      outputVatRate: pick("STD_OUTPUT_VAT_RATE", "0.09"),
      inputVatRule: body.inputVatRule || "STANDARD_DEDUCT",
      calculationYears: scheme.calculationYears,
      depreciationMonths: Number(body.depreciationMonths || pick("STD_DEPRECIATION_MONTHS", "60")),
      projectOperatingMonths: body.projectOperatingMonths ? Number(body.projectOperatingMonths) : null,
      operatingMonthsYear: body.operatingMonthsYear ? Number(body.operatingMonthsYear) : 12,
    },
  });

  await audit("CREATE_SCHEME", "CalculationScheme", scheme.id, actor, body);
  return scheme;
}

export async function executeCalculation(schemeId: string, actor: string) {
  if (calculatingSchemes.has(schemeId)) {
    throw new EngineError("CALC_IN_PROGRESS", "scheme", "测算正在进行，请勿重复提交");
  }
  calculatingSchemes.add(schemeId);
  try {
    return await executeCalculationUnlocked(schemeId, actor);
  } finally {
    calculatingSchemes.delete(schemeId);
  }
}

const calculatingSchemes = new Set<string>();

export function assertSchemeStatusEditable(status: string) {
  if (status === "baseline") {
    throw new EngineError("CALC_PARAMETER_INVALID", "status", "基准方案不可直接覆盖修改，请先复制生成新版本");
  }
  if (status === "archived") {
    throw new EngineError("CALC_PARAMETER_INVALID", "status", "已归档方案不可修改");
  }
}

export async function requireEditableScheme(schemeId: string) {
  const scheme = await prisma.calculationScheme.findUnique({ where: { id: schemeId } });
  if (!scheme) throw new EngineError("NOT_FOUND", "scheme", "方案不存在");
  assertSchemeStatusEditable(scheme.status);
  return scheme;
}

export async function requireEditableRoute(routeId: string) {
  const route = await prisma.calculationRoute.findUnique({
    where: { id: routeId },
    include: { scheme: true },
  });
  if (!route) throw new EngineError("NOT_FOUND", "route", "线路不存在");
  assertSchemeStatusEditable(route.scheme.status);
  return route;
}

export async function requireEditableSegment(segmentId: string) {
  const segment = await prisma.calculationRouteSegment.findUnique({
    where: { id: segmentId },
    include: { route: { include: { scheme: true } } },
  });
  if (!segment) throw new EngineError("NOT_FOUND", "segment", "路段不存在");
  assertSchemeStatusEditable(segment.route.scheme.status);
  return segment;
}

async function executeCalculationUnlocked(schemeId: string, actor: string) {
  const scheme = await prisma.calculationScheme.findUnique({ where: { id: schemeId } });
  if (!scheme) throw new EngineError("CALC_PARAMETER_INVALID", "scheme", "方案不存在");
  if (scheme.status === "archived") {
    throw new EngineError("CALC_PARAMETER_INVALID", "status", "已归档方案不可测算");
  }
  if (scheme.status === "baseline") {
    throw new EngineError("CALC_PARAMETER_INVALID", "status", "基准方案不可覆盖测算，请先复制生成新版本");
  }

  const input = await loadCalculationInput(schemeId);
  const { errors, warnings } = validateSchemeInput(input);
  if (errors.length) {
    const err = errors[0];
    throw new EngineError(err.code, err.field, err.message);
  }

  const output = calculateScheme(input);
  const snapshotCount = await prisma.parameterSnapshot.count({ where: { schemeId } });
  const snapshotVersion = `V${snapshotCount + 1}`;
  const calculationTime = new Date().toISOString();
  const snapshot = await prisma.parameterSnapshot.create({
    data: {
      schemeId,
      versionNo: snapshotVersion,
      ruleVersionId: input.ruleSet.ruleVersionId,
      payloadJson: JSON.stringify({
        scheme: {
          id: input.schemeId,
          schemeName: input.schemeName,
          versionNo: snapshotVersion,
          fleetSize: input.fleetSize,
          leaseType: input.leaseType,
          calculationYears: input.calculationYears,
        },
        routes: input.routes,
        segments: input.routes.flatMap((r) => r.segments),
        vehiclePlan: input.vehicle,
        financeTaxPlan: input.finance,
        standardParameters: input.standardParameters,
        overrides: input.overrides,
        ruleVersion: input.ruleSet.ruleVersionId,
        ruleSet: input.ruleSet,
        calculationTime,
      }),
      createdBy: actor,
    },
  });

  const result = await prisma.calculationResult.create({
    data: {
      schemeId,
      snapshotId: snapshot.id,
      ruleVersionId: output.ruleVersionId,
      monthlyRevenue: output.monthlyRevenue.toFixed(2),
      monthlyTotalCost: output.monthlyTotalCost.toFixed(2),
      monthlyProfit: output.monthlyProfit.toFixed(2),
      profitMargin: output.profitMargin ? output.profitMargin.toFixed(4) : null,
      profitMarginReason: output.profitMarginReason,
      vehicleMonthlyRevenue: output.vehicleMonthlyRevenue.toFixed(2),
      vehicleMonthlyProfit: output.vehicleMonthlyProfit ? output.vehicleMonthlyProfit.toFixed(2) : "",
      monthlyVolume: output.monthlyVolume.toFixed(2),
      monthlyMileage: output.monthlyMileage.toFixed(2),
      irr: output.irr ? output.irr.toFixed(4) : null,
      irrReason: output.irrReason,
      irr4y: output.irrByYears.find((i) => i.years === 4)?.irr?.toFixed(4) ?? null,
      irr5y: output.irrByYears.find((i) => i.years === 5)?.irr?.toFixed(4) ?? null,
      irr6y: output.irrByYears.find((i) => i.years === 6)?.irr?.toFixed(4) ?? null,
      irr8y: output.irrByYears.find((i) => i.years === 8)?.irr?.toFixed(4) ?? null,
      firstPositiveMonth: output.firstPositiveMonth,
      cumulativeCashFlow: output.cumulativeCashFlow.toFixed(2),
      payloadJson: JSON.stringify({
        costBreakdown: output.costBreakdown,
        routes: output.routes,
        annualCashFlows: output.annualCashFlows,
        irrByYears: output.irrByYears,
        warnings,
        freightPricing: output.freightPricing,
        operatingMonthsYear: output.operatingMonthsYear,
        projectOperatingMonths: output.projectOperatingMonths,
        snapshotId: snapshot.id,
        calculationTime,
      }),
      calculatedBy: actor,
      items: {
        create: output.traces.map((t) => ({
          resultCode: t.resultCode,
          resultName: t.resultName,
          resultValue: t.resultValue,
          unit: t.unit,
          ruleCode: t.ruleCode,
          ruleVersion: t.ruleVersion,
          calculationExpression: t.calculationExpression,
          explanation: t.explanation,
          sourceParameterSnapshot: JSON.stringify(t.sourceParameterSnapshot),
          parentCode: t.parentCode,
          sortNo: t.sortNo,
        })),
      },
    },
  });

  await prisma.cashFlowResult.createMany({
    data: output.cashFlows.map((row) => ({
      schemeId,
      snapshotId: snapshot.id,
      monthIndex: row.monthIndex,
      revenueCashIn: row.revenueCashIn.toFixed(2),
      operatingCashOut: row.operatingCashOut.toFixed(2),
      vehicleCashOut: row.vehicleCashOut.toFixed(2),
      financingCashFlow: row.financingCashFlow.toFixed(2),
      taxCashOut: row.taxCashOut.toFixed(2),
      currentNetCashFlow: row.currentNetCashFlow.toFixed(2),
      cumulativeCashFlow: row.cumulativeCashFlow.toFixed(2),
    })),
  });

  await prisma.calculationSchemeVersion.create({
    data: {
      schemeId,
      versionNo: snapshotVersion,
      parentVersionId: scheme.parentVersionId,
      createdBy: actor,
      changeNote: "正式测算",
      ruleVersion: output.ruleVersionId,
      calculationStatus: "calculated",
      snapshotId: snapshot.id,
      resultId: result.id,
    },
  });

  const updated = await prisma.calculationScheme.update({
    where: { id: schemeId },
    data: { status: "calculated", versionNo: snapshotVersion, updatedBy: actor },
  });

  await audit("CALCULATE", "CalculationScheme", schemeId, actor, {
    snapshotId: snapshot.id,
    resultId: result.id,
    ruleVersionId: output.ruleVersionId,
  });

  return { scheme: updated, result, warnings };
}

export async function copyScheme(schemeId: string, actor: string, asNewVersion = false) {
  const source = await prisma.calculationScheme.findUnique({
    where: { id: schemeId },
    include: {
      routes: { include: { segments: true } },
      vehiclePlan: true,
      financeTaxPlan: true,
      overrides: true,
    },
  });
  if (!source || !source.vehiclePlan || !source.financeTaxPlan) {
    throw new EngineError("CALC_PARAMETER_INVALID", "scheme", "方案不存在或不完整");
  }

  const versionNo = asNewVersion
    ? `V${Number(source.versionNo.replace(/\D/g, "") || "1") + 1}`
    : "V1";

  const created = await prisma.calculationScheme.create({
    data: {
      projectId: source.projectId,
      schemeName: asNewVersion ? source.schemeName : `${source.schemeName}（副本）`,
      schemeCode: await nextSchemeCode(source.projectId),
      versionNo,
      status: "draft",
      description: source.description,
      leaseType: source.leaseType,
      fleetSize: source.fleetSize,
      calculationYears: source.calculationYears,
      expectedStartDate: source.expectedStartDate,
      expectedEndDate: source.expectedEndDate,
      createdBy: actor,
      updatedBy: actor,
      sourceSchemeId: source.id,
      parentVersionId: source.id,
      ruleVersionId: source.ruleVersionId,
    },
  });

  const { id: _vehicleId, schemeId: _vehicleSchemeId, ...vehicleData } = source.vehiclePlan;
  await prisma.vehiclePlan.create({
    data: { ...vehicleData, schemeId: created.id },
  });
  const { id: _financeId, schemeId: _financeSchemeId, ...financeData } = source.financeTaxPlan;
  await prisma.financeTaxPlan.create({
    data: { ...financeData, schemeId: created.id },
  });
  for (const o of source.overrides) {
    const { id: _oid, schemeId: _osid, ...odata } = o;
    await prisma.parameterOverride.create({
      data: { ...odata, schemeId: created.id },
    });
  }
  for (const route of source.routes) {
    const newRoute = await prisma.calculationRoute.create({
      data: {
        schemeId: created.id,
        routeName: route.routeName,
        routeCode: route.routeCode,
        sortNo: route.sortNo,
        weight: route.weight,
        description: route.description,
        enabled: route.enabled,
      },
    });
    for (const seg of route.segments) {
      const { id: _sid, routeId: _rid, ...segData } = seg;
      await prisma.calculationRouteSegment.create({
        data: { ...segData, routeId: newRoute.id },
      });
    }
  }

  await audit("COPY_SCHEME", "CalculationScheme", created.id, actor, { sourceSchemeId: source.id });
  return created;
}

export async function setBaseline(schemeId: string, actor: string) {
  const scheme = await prisma.calculationScheme.findUnique({ where: { id: schemeId } });
  if (!scheme) throw new EngineError("CALC_PARAMETER_INVALID", "scheme", "方案不存在");
  if (scheme.status !== "calculated" && scheme.status !== "baseline") {
    throw new EngineError("CALC_PARAMETER_INVALID", "status", "只有已测算方案可以设为基准");
  }

  const previous = await prisma.calculationScheme.findMany({
    where: { projectId: scheme.projectId, status: "baseline" },
  });
  for (const item of previous) {
    await prisma.calculationScheme.update({
      where: { id: item.id },
      data: { status: "calculated", isHistoricalBaseline: true, updatedBy: actor },
    });
  }
  const updated = await prisma.calculationScheme.update({
    where: { id: schemeId },
    data: { status: "baseline", isHistoricalBaseline: false, updatedBy: actor },
  });
  await audit("SET_BASELINE", "CalculationScheme", schemeId, actor, {
    previousIds: previous.map((p) => p.id),
  });
  return updated;
}

export async function runSchemeSensitivity(params: {
  schemeId: string;
  variableCode: SensitivityVariableCode;
  changeMode: "PERCENT" | "ABSOLUTE";
  minChange: string;
  maxChange: string;
  step: string;
  actor: string;
}) {
  const input = await loadCalculationInput(params.schemeId);
  const rows = runSensitivity({
    input,
    variable: params.variableCode,
    changeMode: params.changeMode,
    minChange: params.minChange,
    maxChange: params.maxChange,
    step: params.step,
  });
  const task = await prisma.sensitivityTask.create({
    data: {
      schemeId: params.schemeId,
      variableCode: params.variableCode,
      changeMode: params.changeMode,
      minChange: params.minChange,
      maxChange: params.maxChange,
      step: params.step,
      status: "done",
      createdBy: params.actor,
      results: {
        create: rows.map((row) => ({
          parameterChange: row.parameterChange,
          monthlyRevenue: row.monthlyRevenue,
          monthlyCost: row.monthlyCost,
          monthlyProfit: row.monthlyProfit,
          profitMargin: row.profitMargin,
          profitDelta: row.profitDelta,
          profitDeltaRate: row.profitDeltaRate,
          isBaseline: row.isBaseline,
        })),
      },
    },
    include: { results: true },
  });
  return task;
}

export function serializeScheme(scheme: {
  id: string;
  projectId: string;
  schemeName: string;
  schemeCode: string;
  versionNo: string;
  status: string;
  description: string | null;
  leaseType: string;
  fleetSize: number;
  calculationYears: number;
  expectedStartDate: Date | null;
  expectedEndDate: Date | null;
  createdBy: string;
  createdAt: Date;
  updatedBy: string;
  updatedAt: Date;
  sourceSchemeId: string | null;
  ruleVersionId: string;
  routes?: { id: string; segments: unknown[] }[];
  results?: { monthlyRevenue: string; monthlyTotalCost: string; monthlyProfit: string; profitMargin: string | null; irr: string | null; calculatedAt: Date }[];
}) {
  const latest = scheme.results?.[0];
  return {
    ...scheme,
    routeCount: scheme.routes?.length ?? 0,
    segmentCount: scheme.routes?.reduce((n, r) => n + r.segments.length, 0) ?? 0,
    monthlyRevenue: latest?.monthlyRevenue ?? null,
    monthlyTotalCost: latest?.monthlyTotalCost ?? null,
    monthlyProfit: latest?.monthlyProfit ?? null,
    profitMargin: latest?.profitMargin ?? null,
    irr: latest?.irr ?? null,
    lastCalculatedAt: latest?.calculatedAt ?? null,
  };
}
