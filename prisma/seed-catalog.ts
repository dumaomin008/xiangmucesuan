import type { PrismaClient } from "@prisma/client";
import { DEFAULT_RULE_SET } from "../src/lib/engine/rule-engine";

/** 规则/标准库，不含业务项目。验收库只种这份数据。 */
export async function seedCatalog(prisma: PrismaClient) {
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
}
