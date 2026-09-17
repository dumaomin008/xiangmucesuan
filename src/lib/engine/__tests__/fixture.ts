import { Decimal } from "../decimal";
import { DEFAULT_RULE_SET } from "../rule-engine";
import type { SchemeCalculationInput } from "../types";

export function sampleInput(overrides: Partial<SchemeCalculationInput> = {}): SchemeCalculationInput {
  return {
    schemeId: "scheme-1",
    schemeName: "测试方案",
    versionNo: "V1",
    fleetSize: 40,
    leaseType: "FINANCE_LEASE",
    calculationYears: 5,
    routes: [
      {
        id: "r1",
        routeName: "上海-杭州",
        routeCode: "SH-HZ",
        sortNo: 1,
        weight: 60,
        description: null,
        enabled: true,
        segments: [
          {
            id: "s1",
            routeId: "r1",
            segmentName: "上海仓-杭州仓",
            sortNo: 1,
            originName: "上海",
            destinationName: "杭州",
            distanceKm: "180",
            freightPrice: "220",
            freightPriceUnit: "PER_TON",
            loadTon: "30",
            tripsPerVehicleMonth: "10",
            operatingMonthsYear: "12",
            tollPerTrip: "400",
            loadingUnloadingFee: "80",
            informationFee: "50",
            loadedEnergyConsumption: "1.35",
            emptyEnergyConsumption: "0.95",
            electricityPrice: "0.82",
            driverCostPerTrip: "0",
            enabled: true,
          },
        ],
      },
    ],
    vehicle: {
      fleetSize: 40,
      leaseType: "FINANCE_LEASE",
      downPaymentPerVehicle: "80000",
      installmentMonths: 36,
      monthlyRentPerVehicle: "6500",
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
    finance: {
      receivableCycle: 1,
      workingCapitalLoanCycle: 1,
      workingCapitalInterestRate: "0.045",
      discountRate: "0.04",
      outputVatRate: "0.09",
      inputVatRule: "STANDARD_DEDUCT",
      calculationYears: 5,
      depreciationMonths: 60,
    },
    overrides: [],
    standardParameters: [
      { parameterCode: "STD_LOADED_ENERGY", parameterName: "标准满载能耗", category: "能源", value: "1.35", unit: "kWh/km", version: "V1" },
      { parameterCode: "STD_EMPTY_ENERGY", parameterName: "标准空载能耗", category: "能源", value: "0.95", unit: "kWh/km", version: "V1" },
      { parameterCode: "STD_TIRE_LIFE", parameterName: "轮胎寿命", category: "轮胎", value: "80000", unit: "km", version: "V1" },
    ],
    managementFeeTiers: [
      { minVehicleCount: 0, maxVehicleCount: 30, fee: "2000" },
      { minVehicleCount: 30, maxVehicleCount: 50, fee: "1500" },
      { minVehicleCount: 50, maxVehicleCount: 100, fee: "1200" },
      { minVehicleCount: 100, maxVehicleCount: 200, fee: "1000" },
      { minVehicleCount: 200, maxVehicleCount: null, fee: "800" },
    ],
    leaseTypes: [
      {
        code: "FINANCE_LEASE",
        name: "融资租赁",
        showDownPayment: true,
        showInstallment: true,
        showMonthlyRent: true,
        downPaymentRequired: true,
        installmentRequired: true,
        monthlyRentRequired: true,
        cashFlowRule: {
          downPaymentMonth: 1,
          rentStartMonth: 1,
          rentDurationMode: "INSTALLMENT_MONTHS",
          treatDownPaymentAsFullPurchase: false,
        },
        isPureLease: false,
      },
      {
        code: "PURE_LEASE",
        name: "纯租赁",
        showDownPayment: true,
        showInstallment: true,
        showMonthlyRent: true,
        downPaymentRequired: false,
        installmentRequired: true,
        monthlyRentRequired: true,
        cashFlowRule: {
          downPaymentMonth: 0,
          rentStartMonth: 1,
          rentDurationMode: "INSTALLMENT_MONTHS",
          treatDownPaymentAsFullPurchase: false,
        },
        isPureLease: true,
      },
      {
        code: "HIRE_PURCHASE",
        name: "非纯租赁",
        showDownPayment: true,
        showInstallment: true,
        showMonthlyRent: true,
        downPaymentRequired: true,
        installmentRequired: true,
        monthlyRentRequired: true,
        cashFlowRule: {
          downPaymentMonth: 1,
          rentStartMonth: 1,
          rentDurationMode: "INSTALLMENT_MONTHS",
          treatDownPaymentAsFullPurchase: false,
        },
        isPureLease: false,
      },
    ],
    inputVatRules: [
      {
        code: "STANDARD_DEDUCT",
        name: "标准抵扣",
        deductibleCostCodes: ["energy_cost", "maintenance_fee", "vehicle_rent", "tire_cost"],
        inputVatRate: "0.13",
        negativeVatHandling: "CARRY_FORWARD",
      },
    ],
    freightPriceUnits: [
      { code: "PER_TON", name: "元/吨" },
      { code: "PER_TRIP", name: "元/趟" },
      { code: "PER_TON_KM", name: "元/吨公里" },
    ],
    ruleSet: { ...DEFAULT_RULE_SET },
    ...overrides,
  };
}

function excelSegment(params: {
  id: string;
  name: string;
  origin: string;
  destination: string;
  distanceKm: string;
  freightPrice: string;
  loadTon: string;
  driverCostPerTrip?: string;
  tollPerTrip?: string;
  loadingUnloadingFee?: string;
  informationFee?: string;
}) {
  return {
    id: params.id,
    routeId: "r-excel",
    segmentName: params.name,
    sortNo: Number(params.id.replace(/\D/g, "") || 1),
    originName: params.origin,
    destinationName: params.destination,
    distanceKm: params.distanceKm,
    freightPrice: params.freightPrice,
    freightPriceUnit: "PER_TON",
    loadTon: params.loadTon,
    tripsPerVehicleMonth: "9",
    operatingMonthsYear: "10",
    tollPerTrip: params.tollPerTrip ?? "0",
    loadingUnloadingFee: params.loadingUnloadingFee ?? "0",
    informationFee: params.informationFee ?? "0",
    loadedEnergyConsumption: "1.6",
    emptyEnergyConsumption: "1.1",
    electricityPrice: "0.79",
    driverCostPerTrip: params.driverCostPerTrip ?? "0",
    enabled: true,
  };
}

/** 原表「示例」sheet 已填入并有缓存结果的黄金用例 */
export function excelExampleInput(
  overrides: Partial<SchemeCalculationInput> = {},
): SchemeCalculationInput {
  const base = sampleInput();
  return {
    ...base,
    schemeId: "excel-example",
    schemeName: "Excel V5 示例",
    fleetSize: 2,
    leaseType: "PURE_LEASE",
    calculationYears: 5,
    routes: [
      {
        id: "r-excel",
        routeName: "示例多路段",
        routeCode: "EXCEL-1",
        sortNo: 1,
        weight: 100,
        description: "重卡运力测算模型-V5 示例",
        enabled: true,
        segments: [
          excelSegment({
            id: "seg-1",
            name: "路段1",
            origin: "路段1起",
            destination: "路段1止",
            distanceKm: "360",
            freightPrice: "100",
            loadTon: "33",
            driverCostPerTrip: "1500",
            tollPerTrip: "1170",
            informationFee: "400",
          }),
          excelSegment({
            id: "seg-2",
            name: "路段2",
            origin: "路段2起",
            destination: "路段2止",
            distanceKm: "206",
            freightPrice: "80",
            loadTon: "33",
          }),
          excelSegment({
            id: "seg-3",
            name: "路段3",
            origin: "路段3起",
            destination: "路段3止",
            distanceKm: "550",
            freightPrice: "110",
            loadTon: "33",
          }),
        ],
      },
    ],
    vehicle: {
      ...base.vehicle,
      fleetSize: 2,
      leaseType: "PURE_LEASE",
      downPaymentPerVehicle: "0",
      installmentMonths: 30,
      monthlyRentPerVehicle: "13900",
      managementFeePerVehicle: "2000",
      roadMaintenanceFee: "0",
      maintenanceFee: new Decimal(55000).div(12).toString(),
      annualInspectionFee: new Decimal(4000).div(12).toString(),
      insuranceFee: new Decimal(30000).div(12).toString(),
      parkingFee: "0",
      heaterFee: new Decimal(4000).div(12).toString(),
      consumableFee: "200",
      tireLifeKm: "80000",
      tireCount: 22,
      tireUnitPrice: "1100",
      driverCost: "0",
      driverCostType: "PER_TRIP",
    },
    finance: {
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
    ...overrides,
  };
}

/** 原表「示例」AC39–AC62 缓存值（Excel IEEE） */
export const EXCEL_EXAMPLE_AC = {
  revenue: "172260",
  vehicleCost: "33360",
  managementFee: "4800",
  roadFee: "0",
  maintenanceFee: "11000",
  inspectionFee: "800",
  insuranceFee: "6000",
  parkingFee: "0",
  heaterFee: "800",
  consumableFee: "480",
  driverCost: "27000",
  tollCost: "21060",
  loadingCost: "0",
  infoCost: "7200",
  energyCost: "25391.232",
  tireCost: "6076.62",
  advanceCost: "0",
  wcInterest: "839.81247",
  outputVat: "14223.3027522936",
  inputVat: "7797.69411053598",
  vatPayable: "6425.60864175759",
  totalCost: "151233.273111758",
  profit: "21026.7268882424",
  annualYear1CashFlow: "210267.268882424",
} as const;

export const EXCEL_EXAMPLE_SEGMENTS = {
  "seg-1": {
    revenue: "59400",
    vehicleCost: "10761.2903225806",
    driverCost: "27000",
    energyCost: "8190.72",
    profit: "-26819.1203586315",
  },
  "seg-2": {
    revenue: "47520",
    vehicleCost: "6157.84946236559",
    driverCost: "0",
    energyCost: "4686.912",
    profit: "29804.5033503387",
  },
  "seg-3": {
    revenue: "65340",
    vehicleCost: "16440.8602150538",
    driverCost: "0",
    energyCost: "12513.6",
    profit: "18041.3438965352",
  },
} as const;
