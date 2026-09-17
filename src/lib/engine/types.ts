import type { Decimal } from "./decimal";

export type ValidationIssue = {
  code: string;
  field: string;
  message: string;
  level: "error" | "warning";
};

export type FreightPriceUnit = string;

export type DriverCostType = "PER_VEHICLE_MONTH" | "PER_TRIP" | "FIXED_MONTH";

export type ParameterSource = "STANDARD" | "PROJECT" | "ROUTE" | "SEGMENT" | "COMPUTED" | "OVERRIDE";

export type DriverCostSource = "SEGMENT_OVERRIDE" | "SCHEME_DEFAULT" | "NONE";

export interface SegmentInput {
  id: string;
  routeId: string;
  segmentName: string;
  sortNo: number;
  originName: string;
  destinationName: string;
  distanceKm: string;
  freightPrice: string;
  freightPriceUnit: string;
  loadTon: string;
  tripsPerVehicleMonth: string;
  operatingMonthsYear: string;
  tollPerTrip: string;
  loadingUnloadingFee: string;
  informationFee: string;
  loadedEnergyConsumption: string;
  emptyEnergyConsumption: string;
  electricityPrice: string;
  /** Excel E22:N22 单车司机成本（元/趟）；空视为 0 */
  driverCostPerTrip?: string;
  enabled: boolean;
  loadState?: "LOADED" | "EMPTY";
  loadedDistanceKm?: string;
  emptyDistanceKm?: string;
}

export interface RouteInput {
  id: string;
  routeName: string;
  routeCode: string;
  sortNo: number;
  weight: number | null;
  description: string | null;
  enabled: boolean;
  segments: SegmentInput[];
}

export interface VehiclePlanInput {
  fleetSize: number;
  leaseType: string;
  downPaymentPerVehicle: string;
  installmentMonths: number;
  monthlyRentPerVehicle: string;
  managementFeePerVehicle: string;
  roadMaintenanceFee: string;
  maintenanceFee: string;
  annualInspectionFee: string;
  insuranceFee: string;
  parkingFee: string;
  heaterFee: string;
  consumableFee: string;
  tireLifeKm: string;
  tireCount: number;
  tireUnitPrice: string;
  driverCost: string;
  driverCostType: DriverCostType;
}

export interface FinanceTaxPlanInput {
  /** Excel E26 应收回款周期（月）；空视为 0 */
  receivableCycle: number;
  /** Excel E27 流动资金贷款周期（月） */
  workingCapitalLoanCycle: number;
  workingCapitalInterestRate: string;
  discountRate: string;
  outputVatRate: string;
  inputVatRule: string;
  calculationYears: number;
  /** Excel E28 车辆折旧年限（月），默认 60 */
  depreciationMonths?: number;
  /** 独立经营期限；空则回退 Excel 分期/折旧月数 */
  projectOperatingMonths?: number | null;
  /** 方案级年运营月数。正式计算唯一来源，优先于路段字段 */
  operatingMonthsYear?: number | null;
}

export interface ParameterOverrideInput {
  parameterCode: string;
  standardValue: string;
  overrideValue: string;
  overrideReason: string;
  unit?: string | null;
}

export interface StandardParameterRef {
  parameterCode: string;
  parameterName: string;
  category: string;
  value: string;
  unit: string;
  version: string;
}

export interface ManagementFeeTierInput {
  minVehicleCount: number;
  maxVehicleCount: number | null;
  fee: string;
}

export interface LeaseTypeConfigInput {
  code: string;
  name: string;
  showDownPayment: boolean;
  showInstallment: boolean;
  showMonthlyRent: boolean;
  downPaymentRequired: boolean;
  installmentRequired: boolean;
  monthlyRentRequired: boolean;
  cashFlowRule: LeaseCashFlowRule;
  /** Excel E3：纯租赁 vs 非纯租赁。未填时按 code/name 推断 */
  isPureLease?: boolean;
}

export interface LeaseCashFlowRule {
  downPaymentMonth: number;
  rentStartMonth: number;
  rentDurationMode: "INSTALLMENT_MONTHS" | "ALL_MONTHS" | "NONE";
  treatDownPaymentAsFullPurchase: boolean;
}

export interface InputVatRuleInput {
  code: string;
  name: string;
  deductibleCostCodes: string[];
  inputVatRate: string;
  negativeVatHandling: "CARRY_FORWARD" | "RECOGNIZE_NEGATIVE";
}

export type EnergyUnit = "KWH_PER_KM" | "KWH_PER_100KM";
export type EnergyLoadMode = "SEGMENT_LOAD_STATE" | "BOTH_LOADED_AND_EMPTY";
export type FixedCostAnnualization = "NONE" | "TIMES_12_DIV_OPERATING_MONTHS";
export type WorkingCapitalBase = "REVENUE_TIMES_LOAN_CYCLE" | "EXCEL_RENT_PLUS_AC42_AC55";
export type CycleUnit = "DAYS" | "MONTHS";
export type VatMode = "CONFIG_RATE" | "EXCEL_INCLUSIVE";
export type AllocationWeight = "REVENUE" | "DISTANCE_TIMES_TRIPS";
export type InspectionInsuranceUnit = "ANNUAL" | "MONTHLY";

export interface EnergyMileageRule {
  loadedDistanceMode: "USE_DISTANCE_KM" | "DISTANCE_TIMES_RATIO";
  emptyDistanceMode: "USE_DISTANCE_KM" | "DISTANCE_TIMES_RATIO" | "ZERO";
  loadedRatio: string;
  emptyRatio: string;
}

export interface RevenueRule {
  formulaByUnit: Record<string, "PER_TON" | "PER_TRIP" | "PER_TON_KM">;
}

export interface FinanceRule {
  advanceRateSource: "WORKING_CAPITAL_INTEREST_RATE" | "DISCOUNT_RATE";
  workingCapitalPrincipalMode: "REVENUE_TIMES_LOAN_CYCLE_MONTHS";
  daysPerMonth: number;
}

export interface MaintenanceRule {
  mode: "PER_VEHICLE_MONTH" | "PER_KM";
}

export interface RuleSet {
  ruleVersionId: string;
  energyMileage: EnergyMileageRule;
  revenue: RevenueRule;
  finance: FinanceRule;
  maintenance: MaintenanceRule;
  driverCostDefaultType: DriverCostType;
  pricesIncludeVat: boolean;
  annualFeeAmortizationMonths: number;
  energyUnit: EnergyUnit;
  energyLoadMode: EnergyLoadMode;
  fixedCostAnnualization: FixedCostAnnualization;
  inspectionInsuranceUnit: InspectionInsuranceUnit;
  workingCapitalBase: WorkingCapitalBase;
  receivableCycleUnit: CycleUnit;
  workingCapitalLoanCycleUnit: CycleUnit;
  vatMode: VatMode;
  allocationWeight: AllocationWeight;
  vatRates: {
    outputInclusiveRate: string;
    inputStandardRate: string;
    inputInsuranceRate: string;
  };
}

export interface SchemeCalculationInput {
  schemeId: string;
  schemeName: string;
  versionNo: string;
  fleetSize: number;
  leaseType: string;
  calculationYears: number;
  routes: RouteInput[];
  vehicle: VehiclePlanInput;
  finance: FinanceTaxPlanInput;
  overrides: ParameterOverrideInput[];
  standardParameters: StandardParameterRef[];
  managementFeeTiers: ManagementFeeTierInput[];
  leaseTypes: LeaseTypeConfigInput[];
  inputVatRules: InputVatRuleInput[];
  freightPriceUnits: { code: string; name: string }[];
  ruleSet: RuleSet;
}

export interface SegmentMetrics {
  segmentId: string;
  routeId: string;
  segmentName: string;
  distanceKm: Decimal;
  freightPrice: Decimal;
  freightPriceUnit: string;
  loadTon: Decimal;
  tripsPerVehicleMonth: Decimal;
  fleetSize: number;
  vehicleMonthlyVolume: Decimal;
  vehicleMonthlyMileage: Decimal;
  segmentMonthlyVolume: Decimal;
  segmentMonthlyMileage: Decimal;
  loadedDistance: Decimal;
  emptyDistance: Decimal;
  loadedMileage: Decimal;
  emptyMileage: Decimal;
  monthlyRevenue: Decimal;
  energyQuantity: Decimal;
  energyCost: Decimal;
  tollCost: Decimal;
  loadingUnloadingCost: Decimal;
  informationFeeCost: Decimal;
  tireCost: Decimal;
  otherVariableCost: Decimal;
  monthlyProfit: Decimal | null;
  allocationWeight: Decimal;
  allocationWeightRaw: Decimal;
  loadState: "LOADED" | "EMPTY";
  allocatedFixedCost: Decimal;
  allocatedFinanceCost: Decimal;
  taxCost: Decimal;
  driverCost: Decimal;
  driverCostSource: DriverCostSource;
}

export interface RouteMetrics {
  routeId: string;
  routeName: string;
  weight: number | null;
  monthlyRevenue: Decimal;
  monthlyVolume: Decimal;
  monthlyMileage: Decimal;
  energyCost: Decimal;
  variableCost: Decimal;
  fixedCost: Decimal;
  financeCost: Decimal;
  taxCost: Decimal;
  monthlyProfit: Decimal;
  profitMargin: Decimal | null;
  segments: SegmentMetrics[];
}

export interface CostBreakdownItem {
  code: string;
  name: string;
  amount: Decimal;
  share: Decimal | null;
}

export interface MonthlyCashFlow {
  monthIndex: number;
  isOperatingMonth: boolean;
  isProjectMonth: boolean;
  revenueCashIn: Decimal;
  operatingCashOut: Decimal;
  vehicleCashOut: Decimal;
  financingCashFlow: Decimal;
  taxCashOut: Decimal;
  currentNetCashFlow: Decimal;
  cumulativeCashFlow: Decimal;
  openingVatCredit: Decimal;
  outputVat: Decimal;
  inputVat: Decimal;
  vatCreditUsed: Decimal;
  closingVatCredit: Decimal;
}

export interface AnnualCashFlow {
  yearIndex: number;
  currentNetCashFlow: Decimal;
  cumulativeCashFlow: Decimal;
  active: boolean;
}

export interface ResultTraceItem {
  resultCode: string;
  resultName: string;
  resultValue: string | null;
  unit: string;
  ruleCode: string;
  ruleVersion: string;
  calculationExpression: string;
  explanation: string;
  sourceParameterSnapshot: Record<string, string>;
  parentCode?: string;
  sortNo: number;
}

export interface FreightPricingSummary {
  mixed: boolean;
  label: string;
  averagePrice: string | null;
  unitCode: string | null;
  byUnit: { code: string; name: string; averagePrice: string; segmentCount: number }[];
}

export interface SchemeCalculationOutput {
  monthlyRevenue: Decimal;
  monthlyFixedCost: Decimal;
  monthlyVariableCost: Decimal;
  monthlyFinanceCost: Decimal;
  monthlyTaxCost: Decimal;
  monthlyTotalCost: Decimal;
  monthlyProfit: Decimal;
  profitMargin: Decimal | null;
  profitMarginReason: string | null;
  vehicleMonthlyRevenue: Decimal;
  vehicleMonthlyProfit: Decimal | null;
  monthlyVolume: Decimal;
  monthlyMileage: Decimal;
  costBreakdown: CostBreakdownItem[];
  routes: RouteMetrics[];
  cashFlows: MonthlyCashFlow[];
  annualCashFlows: AnnualCashFlow[];
  irr: Decimal | null;
  irrReason: string | null;
  irrByYears: { years: number; irr: Decimal | null; reason: string | null }[];
  firstPositiveMonth: number | null;
  cumulativeCashFlow: Decimal;
  traces: ResultTraceItem[];
  warnings: ValidationIssue[];
  ruleVersionId: string;
  freightPricing: FreightPricingSummary;
  operatingMonthsYear: number;
  projectOperatingMonths: number | null;
}

export const SENSITIVITY_VARIABLES = [
  { code: "electricity_price", name: "电价" },
  { code: "freight_price", name: "运价" },
  { code: "trips_per_vehicle_month", name: "单车月趟数" },
  { code: "monthly_rent_per_vehicle", name: "单车月租" },
  { code: "loaded_energy_consumption", name: "满载能耗" },
  { code: "loading_unloading_fee", name: "装卸费" },
  { code: "information_fee", name: "信息费" },
] as const;

export type SensitivityVariableCode = (typeof SENSITIVITY_VARIABLES)[number]["code"];
