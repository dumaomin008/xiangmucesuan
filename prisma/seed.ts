import { PrismaClient } from "@prisma/client";
import { calculateScheme } from "../src/lib/engine/calculate";
import { DEFAULT_RULE_SET } from "../src/lib/engine/rule-engine";
import type { SchemeCalculationInput } from "../src/lib/engine/types";

const prisma = new PrismaClient();

async function main() {
  const leaseTypes = [
    {
      code: "FINANCE_LEASE",
      name: "融资租赁",
      showDownPayment: true,
      showInstallment: true,
      showMonthlyRent: true,
      downPaymentRequired: true,
      installmentRequired: true,
      monthlyRentRequired: true,
      sortNo: 1,
      cashFlowRuleJson: JSON.stringify({
        downPaymentMonth: 1,
        rentStartMonth: 1,
        rentDurationMode: "INSTALLMENT_MONTHS",
        treatDownPaymentAsFullPurchase: false,
      }),
      isPureLease: false,
    },
    {
      code: "OPERATING_LEASE",
      name: "经营租赁",
      showDownPayment: false,
      showInstallment: false,
      showMonthlyRent: true,
      downPaymentRequired: false,
      installmentRequired: false,
      monthlyRentRequired: true,
      sortNo: 2,
      cashFlowRuleJson: JSON.stringify({
        downPaymentMonth: 0,
        rentStartMonth: 1,
        rentDurationMode: "ALL_MONTHS",
        treatDownPaymentAsFullPurchase: false,
      }),
      isPureLease: true,
    },
    {
      code: "HIRE_PURCHASE",
      name: "分期购车",
      showDownPayment: true,
      showInstallment: true,
      showMonthlyRent: true,
      downPaymentRequired: true,
      installmentRequired: true,
      monthlyRentRequired: true,
      sortNo: 3,
      cashFlowRuleJson: JSON.stringify({
        downPaymentMonth: 1,
        rentStartMonth: 1,
        rentDurationMode: "INSTALLMENT_MONTHS",
        treatDownPaymentAsFullPurchase: false,
      }),
      isPureLease: false,
    },
    {
      code: "FULL_PURCHASE",
      name: "全款购车",
      showDownPayment: true,
      showInstallment: false,
      showMonthlyRent: false,
      downPaymentRequired: true,
      installmentRequired: false,
      monthlyRentRequired: false,
      sortNo: 4,
      cashFlowRuleJson: JSON.stringify({
        downPaymentMonth: 1,
        rentStartMonth: 1,
        rentDurationMode: "NONE",
        treatDownPaymentAsFullPurchase: true,
      }),
      isPureLease: false,
    },
    {
      code: "PURE_LEASE",
      name: "纯租赁",
      showDownPayment: false,
      showInstallment: true,
      showMonthlyRent: true,
      downPaymentRequired: false,
      installmentRequired: true,
      monthlyRentRequired: true,
      sortNo: 5,
      cashFlowRuleJson: JSON.stringify({
        downPaymentMonth: 0,
        rentStartMonth: 1,
        rentDurationMode: "INSTALLMENT_MONTHS",
        treatDownPaymentAsFullPurchase: false,
      }),
      isPureLease: true,
    },
  ];
  for (const item of leaseTypes) {
    await prisma.leaseTypeConfig.create({ data: item });
  }

  await prisma.inputVatRuleConfig.createMany({
    data: [
      {
        code: "STANDARD_DEDUCT",
        name: "标准抵扣（能源/维保/租金/轮胎）",
        deductibleCostCodesJson: JSON.stringify(["energy_cost", "maintenance_fee", "vehicle_rent", "tire_cost"]),
        inputVatRate: "0.13",
        negativeVatHandling: "CARRY_FORWARD",
        description: "V1 默认进项规则，留抵不冲减当期利润税成本",
      },
      {
        code: "ENERGY_ONLY",
        name: "仅能源进项",
        deductibleCostCodesJson: JSON.stringify(["energy_cost"]),
        inputVatRate: "0.13",
        negativeVatHandling: "CARRY_FORWARD",
        description: "仅电费可抵扣",
      },
    ],
  });

  await prisma.freightPriceUnitConfig.createMany({
    data: [
      { code: "PER_TON", name: "元/吨", sortNo: 1 },
      { code: "PER_TRIP", name: "元/趟", sortNo: 2 },
      { code: "PER_TON_KM", name: "元/吨公里", sortNo: 3 },
    ],
  });

  await prisma.managementFeeTier.createMany({
    data: [
      { minVehicleCount: 0, maxVehicleCount: 30, fee: "2000", effectiveDate: new Date("2026-01-01"), version: "V1" },
      { minVehicleCount: 30, maxVehicleCount: 50, fee: "1500", effectiveDate: new Date("2026-01-01"), version: "V1" },
      { minVehicleCount: 50, maxVehicleCount: 100, fee: "1200", effectiveDate: new Date("2026-01-01"), version: "V1" },
      { minVehicleCount: 100, maxVehicleCount: 200, fee: "1000", effectiveDate: new Date("2026-01-01"), version: "V1" },
      { minVehicleCount: 200, maxVehicleCount: null, fee: "800", effectiveDate: new Date("2026-01-01"), version: "V1" },
    ],
  });

  const rules = [
    { ruleCode: "ENERGY_MILEAGE", ruleName: "满载/空载里程拆分", category: "能源", config: DEFAULT_RULE_SET.energyMileage },
    { ruleCode: "REVENUE", ruleName: "收入公式", category: "收入", config: DEFAULT_RULE_SET.revenue },
    { ruleCode: "FINANCE", ruleName: "财务成本口径", category: "财务", config: DEFAULT_RULE_SET.finance },
    { ruleCode: "MAINTENANCE", ruleName: "维保计费口径", category: "成本", config: DEFAULT_RULE_SET.maintenance },
    { ruleCode: "DRIVER_COST", ruleName: "司机成本口径", category: "人工", config: { type: DEFAULT_RULE_SET.driverCostDefaultType } },
    { ruleCode: "TAX_PRICE", ruleName: "价格是否含税", category: "税务", config: { pricesIncludeVat: true } },
    { ruleCode: "ANNUAL_AMORT", ruleName: "年费摊销月数", category: "成本", config: { months: 12 } },
    { ruleCode: "ENERGY_UNIT", ruleName: "能耗单位", category: "能源", config: { energyUnit: "KWH_PER_KM" } },
    { ruleCode: "ENERGY_LOAD_MODE", ruleName: "满空载判定", category: "能源", config: { energyLoadMode: "SEGMENT_LOAD_STATE" } },
    { ruleCode: "VAT_MODE", ruleName: "增值税口径", category: "税务", config: { vatMode: "EXCEL_INCLUSIVE" } },
    { ruleCode: "VAT_RATES", ruleName: "增值税税率", category: "税务", config: DEFAULT_RULE_SET.vatRates },
    { ruleCode: "ALLOCATION", ruleName: "路段分摊权重", category: "成本", config: { allocationWeight: "DISTANCE_TIMES_TRIPS" } },
    { ruleCode: "WC_BASE", ruleName: "流贷利息基数", category: "财务", config: { workingCapitalBase: "EXCEL_RENT_PLUS_AC42_AC55" } },
  ];
  for (const rule of rules) {
    const created = await prisma.calculationRule.create({
      data: { ruleCode: rule.ruleCode, ruleName: rule.ruleName, category: rule.category, description: "V1 隔离规则，待业务确认项不散落硬编码" },
    });
    await prisma.calculationRuleVersion.create({
      data: {
        ruleId: created.id,
        version: "RULE_PACK_V1",
        configJson: JSON.stringify(rule.config),
        effectiveDate: new Date("2026-01-01"),
      },
    });
  }

  const stdParams = [
    ["STD_MANAGEMENT_FEE", "单车月管理费参考", "管理费", "1500", "元/车/月"],
    ["STD_ROAD_MAINTENANCE_FEE", "路保费", "车辆", "200", "元/车/月"],
    ["STD_MAINTENANCE_FEE", "维保费", "车辆", "800", "元/车/月"],
    ["STD_ANNUAL_INSPECTION_FEE", "年审费", "车辆", "200", "元/车/月"],
    ["STD_INSURANCE_FEE", "保险费", "车辆", "1000", "元/车/月"],
    ["STD_PARKING_FEE", "停车费", "车辆", "300", "元/车/月"],
    ["STD_HEATER_FEE", "柴暖费", "车辆", "150", "元/车/月"],
    ["STD_CONSUMABLE_FEE", "消耗费用", "车辆", "200", "元/车/月"],
    ["STD_TIRE_LIFE", "轮胎寿命", "轮胎", "80000", "km"],
    ["STD_TIRE_COUNT", "单车轮胎数量", "轮胎", "12", "条"],
    ["STD_TIRE_PRICE", "轮胎均价", "轮胎", "1800", "元/条"],
    ["STD_LOADED_ENERGY", "标准满载能耗", "能源", "1.35", "kWh/km"],
    ["STD_EMPTY_ENERGY", "标准空载能耗", "能源", "0.95", "kWh/km"],
    ["STD_ELECTRICITY_PRICE", "含电损电价", "能源", "0.82", "元/kWh"],
    ["STD_DRIVER_COST", "司机成本", "人工", "12000", "元/车/月"],
    ["STD_WC_INTEREST_RATE", "流动资金贷款利率", "财务", "0.045", "年利率"],
    ["STD_DISCOUNT_RATE", "营收垫资资金成本率", "财务", "0.04", "年利率"],
    ["STD_OUTPUT_VAT_RATE", "销项税率", "税务", "0.09", "税率"],
    ["STD_RECEIVABLE_CYCLE", "应收回款周期", "财务", "1", "月"],
    ["STD_WC_LOAN_CYCLE", "流动资金贷款周期", "财务", "1", "月"],
    ["STD_DEPRECIATION_MONTHS", "车辆折旧年限", "财务", "60", "月"],
    ["STD_FREIGHT_PRICE_REF", "运价参考", "其他", "220", "元/吨"],
  ] as const;

  for (const [code, name, category, value, unit] of stdParams) {
    await prisma.standardParameter.create({
      data: {
        parameterCode: code,
        parameterName: name,
        category,
        value,
        unit,
        effectiveDate: new Date("2026-01-01"),
        version: "V1",
        description: "公司统一测算口径",
        scope: "COMPANY",
      },
    });
  }

  const p1 = await prisma.project.create({
    data: {
      projectCode: "PRJ-HD-2026-001",
      projectName: "华东重卡干线运力项目",
      customerName: "创维物流华东分公司",
      projectManager: "王经理",
      projectStatus: "测算中",
      startDate: new Date("2026-04-01"),
      endDate: new Date("2031-03-31"),
    },
  });
  const p2 = await prisma.project.create({
    data: {
      projectCode: "PRJ-HN-2026-014",
      projectName: "华南城配运力项目",
      customerName: "华南城配集团",
      projectManager: "李主管",
      projectStatus: "立项准备",
      startDate: new Date("2026-06-01"),
      endDate: new Date("2029-05-31"),
    },
  });
  await prisma.project.create({
    data: {
      projectCode: "PRJ-XN-2026-008",
      projectName: "西南干线运输项目",
      customerName: "西南能源运输",
      projectManager: "赵经理",
      projectStatus: "意向",
      startDate: new Date("2026-09-01"),
      endDate: new Date("2030-08-31"),
    },
  });

  const baseline = await createFullScheme({
    projectId: p1.id,
    schemeName: "最终商务方案",
    schemeCode: "CS-001",
    versionNo: "V3",
    status: "draft",
    actor: "王经理",
    fleetSize: 40,
    leaseType: "FINANCE_LEASE",
    description: "与客户确认后的商务口径，作为立项基准。",
  });
  await persistCalculation(baseline.id, "王经理");
  await prisma.calculationScheme.update({ where: { id: baseline.id }, data: { status: "baseline" } });

  const v2 = await createFullScheme({
    projectId: p1.id,
    schemeName: "运营优化方案",
    schemeCode: "CS-002",
    versionNo: "V2",
    status: "draft",
    actor: "周分析师",
    fleetSize: 36,
    leaseType: "OPERATING_LEASE",
    description: "降低车队规模、改为经营租赁的对照方案。",
    monthlyRent: "7200",
    downPayment: "0",
    trips: "11",
  });
  await persistCalculation(v2.id, "周分析师");

  const v1 = await createFullScheme({
    projectId: p1.id,
    schemeName: "初版测算",
    schemeCode: "CS-003",
    versionNo: "V1",
    status: "draft",
    actor: "周分析师",
    fleetSize: 50,
    leaseType: "FINANCE_LEASE",
    description: "投标前初版，能耗按偏保守口径。",
    loadedEnergy: "1.50",
  });
  await persistCalculation(v1.id, "周分析师");
  await prisma.calculationScheme.update({ where: { id: v1.id }, data: { status: "archived" } });

  await createFullScheme({
    projectId: p1.id,
    schemeName: "新能源电价情景草稿",
    schemeCode: "CS-004",
    versionNo: "V1",
    status: "draft",
    actor: "周分析师",
    fleetSize: 40,
    leaseType: "FINANCE_LEASE",
    description: "正在调整电价与回款周期，尚未正式测算。",
    electricityPrice: "0.70",
  });

  await createFullScheme({
    projectId: p2.id,
    schemeName: "华南城配试算",
    schemeCode: "CS-001",
    versionNo: "V1",
    status: "draft",
    actor: "李主管",
    fleetSize: 20,
    leaseType: "OPERATING_LEASE",
    description: "城配短途，路段较少。",
    monthlyRent: "5800",
    downPayment: "0",
  });

  await createExcelParityScheme(p1.id);
  await persistCalculation((await prisma.calculationScheme.findFirstOrThrow({ where: { schemeCode: "CS-EXCEL", projectId: p1.id } })).id, "对账机器人");

  console.log("Seed completed.");
}

async function createFullScheme(opts: {
  projectId: string;
  schemeName: string;
  schemeCode: string;
  versionNo: string;
  status: string;
  actor: string;
  fleetSize: number;
  leaseType: string;
  description: string;
  monthlyRent?: string;
  downPayment?: string;
  trips?: string;
  loadedEnergy?: string;
  electricityPrice?: string;
}) {
  const scheme = await prisma.calculationScheme.create({
    data: {
      projectId: opts.projectId,
      schemeName: opts.schemeName,
      schemeCode: opts.schemeCode,
      versionNo: opts.versionNo,
      status: opts.status,
      description: opts.description,
      leaseType: opts.leaseType,
      fleetSize: opts.fleetSize,
      calculationYears: 5,
      expectedStartDate: new Date("2026-04-01"),
      expectedEndDate: new Date("2031-03-31"),
      createdBy: opts.actor,
      updatedBy: opts.actor,
      ruleVersionId: "RULE_PACK_V1",
    },
  });

  await prisma.vehiclePlan.create({
    data: {
      schemeId: scheme.id,
      fleetSize: opts.fleetSize,
      leaseType: opts.leaseType,
      downPaymentPerVehicle: opts.downPayment ?? "80000",
      installmentMonths: opts.leaseType === "OPERATING_LEASE" ? 60 : opts.leaseType === "PURE_LEASE" ? 30 : 36,
      monthlyRentPerVehicle: opts.monthlyRent ?? "6500",
      managementFeePerVehicle: "1500",
      roadMaintenanceFee: "200",
      maintenanceFee: "800",
      annualInspectionFee: "200",
      insuranceFee: "1000",
      parkingFee: "300",
      heaterFee: "150",
      consumableFee: "200",
      tireLifeKm: "80000",
      tireCount: 12,
      tireUnitPrice: "1800",
      driverCost: "12000",
      driverCostType: "PER_VEHICLE_MONTH",
    },
  });

  await prisma.financeTaxPlan.create({
    data: {
      schemeId: scheme.id,
      receivableCycle: 1,
      workingCapitalLoanCycle: 1,
      workingCapitalInterestRate: "0.045",
      discountRate: "0.04",
      outputVatRate: "0.09",
      inputVatRule: "STANDARD_DEDUCT",
      calculationYears: 5,
      depreciationMonths: 60,
      operatingMonthsYear: 12,
    },
  });

  const r1 = await prisma.calculationRoute.create({
    data: {
      schemeId: scheme.id,
      routeName: "上海-杭州往返",
      routeCode: "SH-HZ",
      sortNo: 1,
      weight: 60,
      description: "主干线，夜间发车",
      enabled: true,
    },
  });
  await prisma.calculationRouteSegment.create({
    data: {
      routeId: r1.id,
      segmentName: "上海仓-杭州仓",
      sortNo: 1,
      originName: "上海临港仓",
      destinationName: "杭州萧山仓",
      distanceKm: "180",
      freightPrice: "220",
      freightPriceUnit: "PER_TON",
      loadTon: "30",
      tripsPerVehicleMonth: opts.trips ?? "10",
      operatingMonthsYear: "12",
      tollPerTrip: "400",
      loadingUnloadingFee: "80",
      informationFee: "50",
      loadedEnergyConsumption: opts.loadedEnergy ?? "1.35",
      emptyEnergyConsumption: "0.95",
      electricityPrice: opts.electricityPrice ?? "0.82",
    },
  });

  const r2 = await prisma.calculationRoute.create({
    data: {
      schemeId: scheme.id,
      routeName: "上海-苏州往返",
      routeCode: "SH-SZ",
      sortNo: 2,
      weight: 40,
      description: "短途加密线路",
      enabled: true,
    },
  });
  await prisma.calculationRouteSegment.create({
    data: {
      routeId: r2.id,
      segmentName: "上海仓-苏州仓",
      sortNo: 1,
      originName: "上海临港仓",
      destinationName: "苏州工业园仓",
      distanceKm: "95",
      freightPrice: "140",
      freightPriceUnit: "PER_TON",
      loadTon: "28",
      tripsPerVehicleMonth: "14",
      operatingMonthsYear: "12",
      tollPerTrip: "180",
      loadingUnloadingFee: "60",
      informationFee: "30",
      loadedEnergyConsumption: opts.loadedEnergy ?? "1.35",
      emptyEnergyConsumption: "0.95",
      electricityPrice: opts.electricityPrice ?? "0.82",
    },
  });
  await prisma.calculationRouteSegment.create({
    data: {
      routeId: r2.id,
      segmentName: "苏州仓-昆山中转",
      sortNo: 2,
      originName: "苏州工业园仓",
      destinationName: "昆山中转场",
      distanceKm: "40",
      freightPrice: "70",
      freightPriceUnit: "PER_TON",
      loadTon: "20",
      tripsPerVehicleMonth: "8",
      operatingMonthsYear: "12",
      tollPerTrip: "60",
      loadingUnloadingFee: "40",
      informationFee: "20",
      loadedEnergyConsumption: opts.loadedEnergy ?? "1.35",
      emptyEnergyConsumption: "0.95",
      electricityPrice: opts.electricityPrice ?? "0.82",
    },
  });

  return scheme;
}

async function createExcelParityScheme(projectId: string) {
  const scheme = await prisma.calculationScheme.create({
    data: {
      projectId,
      schemeName: "Excel V5 对账示例",
      schemeCode: "CS-EXCEL",
      versionNo: "V1",
      status: "draft",
      description: "与《重卡运力测算模型-V5》示例同源输入，用于验收同一组参数系统结果能与原表对上。",
      leaseType: "PURE_LEASE",
      fleetSize: 2,
      calculationYears: 5,
      expectedStartDate: new Date("2026-04-01"),
      expectedEndDate: new Date("2028-09-30"),
      createdBy: "对账机器人",
      updatedBy: "对账机器人",
      ruleVersionId: "RULE_PACK_V1",
    },
  });

  await prisma.vehiclePlan.create({
    data: {
      schemeId: scheme.id,
      fleetSize: 2,
      leaseType: "PURE_LEASE",
      downPaymentPerVehicle: "0",
      installmentMonths: 30,
      monthlyRentPerVehicle: "13900",
      managementFeePerVehicle: "2000",
      roadMaintenanceFee: "0",
      maintenanceFee: (55000 / 12).toString(),
      annualInspectionFee: (4000 / 12).toString(),
      insuranceFee: (30000 / 12).toString(),
      parkingFee: "0",
      heaterFee: (4000 / 12).toString(),
      consumableFee: "200",
      tireLifeKm: "80000",
      tireCount: 22,
      tireUnitPrice: "1100",
      driverCost: "0",
      driverCostType: "PER_TRIP",
    },
  });

  await prisma.financeTaxPlan.create({
    data: {
      schemeId: scheme.id,
      receivableCycle: 0,
      workingCapitalLoanCycle: 1,
      workingCapitalInterestRate: "0.07",
      discountRate: "0.04",
      outputVatRate: "0.09",
      inputVatRule: "STANDARD_DEDUCT",
      calculationYears: 5,
      depreciationMonths: 60,
      operatingMonthsYear: 10,
    },
  });

  const route = await prisma.calculationRoute.create({
    data: {
      schemeId: scheme.id,
      routeName: "示例多路段",
      routeCode: "EXCEL-1",
      sortNo: 1,
      weight: 100,
      description: "重卡运力测算模型-V5 示例",
      enabled: true,
    },
  });

  const rows = [
    { name: "路段1", origin: "路段1起", dest: "路段1止", km: "360", price: "100", load: "33", driver: "1500", toll: "1170", info: "400" },
    { name: "路段2", origin: "路段2起", dest: "路段2止", km: "206", price: "80", load: "33", driver: "0", toll: "0", info: "0" },
    { name: "路段3", origin: "路段3起", dest: "路段3止", km: "550", price: "110", load: "33", driver: "0", toll: "0", info: "0" },
  ];
  for (const [i, row] of rows.entries()) {
    await prisma.calculationRouteSegment.create({
      data: {
        routeId: route.id,
        segmentName: row.name,
        sortNo: i + 1,
        originName: row.origin,
        destinationName: row.dest,
        distanceKm: row.km,
        freightPrice: row.price,
        freightPriceUnit: "PER_TON",
        loadTon: row.load,
        tripsPerVehicleMonth: "9",
        operatingMonthsYear: "10",
        tollPerTrip: row.toll,
        loadingUnloadingFee: "0",
        informationFee: row.info,
        loadedEnergyConsumption: "1.6",
        emptyEnergyConsumption: "1.1",
        electricityPrice: "0.79",
        driverCostPerTrip: row.driver,
      },
    });
  }
  return scheme;
}

async function persistCalculation(schemeId: string, actor: string) {
  const scheme = await prisma.calculationScheme.findUniqueOrThrow({
    where: { id: schemeId },
    include: {
      routes: { include: { segments: true } },
      vehiclePlan: true,
      financeTaxPlan: true,
      overrides: true,
    },
  });
  const [standardParameters, managementFeeTiers, leaseTypes, inputVatRules, freightPriceUnits] = await Promise.all([
    prisma.standardParameter.findMany({ where: { enabled: true } }),
    prisma.managementFeeTier.findMany({ where: { enabled: true } }),
    prisma.leaseTypeConfig.findMany(),
    prisma.inputVatRuleConfig.findMany(),
    prisma.freightPriceUnitConfig.findMany(),
  ]);

  const input: SchemeCalculationInput = {
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
      segments: route.segments,
    })),
    vehicle: {
      ...scheme.vehiclePlan!,
      driverCostType: scheme.vehiclePlan!.driverCostType as SchemeCalculationInput["vehicle"]["driverCostType"],
    },
    finance: scheme.financeTaxPlan!,
    overrides: [],
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
      ...item,
      cashFlowRule: JSON.parse(item.cashFlowRuleJson),
    })),
    inputVatRules: inputVatRules.map((item) => ({
      code: item.code,
      name: item.name,
      deductibleCostCodes: JSON.parse(item.deductibleCostCodesJson),
      inputVatRate: item.inputVatRate,
      negativeVatHandling: item.negativeVatHandling as "CARRY_FORWARD" | "RECOGNIZE_NEGATIVE",
    })),
    freightPriceUnits,
    ruleSet: DEFAULT_RULE_SET,
  };

  const output = calculateScheme(input);
  const snapshot = await prisma.parameterSnapshot.create({
    data: {
      schemeId,
      versionNo: scheme.versionNo,
      ruleVersionId: output.ruleVersionId,
      payloadJson: JSON.stringify(input),
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
        warnings: output.warnings,
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
      versionNo: scheme.versionNo,
      createdBy: actor,
      changeNote: "种子数据正式测算",
      ruleVersion: output.ruleVersionId,
      calculationStatus: "calculated",
      snapshotId: snapshot.id,
      resultId: result.id,
    },
  });
  await prisma.calculationScheme.update({
    where: { id: schemeId },
    data: { status: "calculated", updatedBy: actor },
  });
  await prisma.auditLog.create({
    data: {
      action: "CALCULATE",
      entityType: "CalculationScheme",
      entityId: schemeId,
      actor,
      detailJson: JSON.stringify({ snapshotId: snapshot.id, seed: true, ruleVersionId: output.ruleVersionId }),
    },
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
