import type {
  EnergyMileageRule,
  FinanceRule,
  InputVatRuleInput,
  LeaseTypeConfigInput,
  ManagementFeeTierInput,
  RuleSet,
  SchemeCalculationInput,
} from "./types";
import { EngineError, toDecimal, Decimal } from "./decimal";

export function getLeaseType(input: SchemeCalculationInput): LeaseTypeConfigInput {
  const found = input.leaseTypes.find((item) => item.code === input.leaseType);
  if (!found) {
    throw new EngineError("CALC_PARAMETER_INVALID", "lease_type", "租赁形式未在配置中定义");
  }
  return found;
}

export function getInputVatRule(input: SchemeCalculationInput): InputVatRuleInput {
  const found = input.inputVatRules.find((item) => item.code === input.finance.inputVatRule);
  if (!found) {
    throw new EngineError("CALC_PARAMETER_INVALID", "input_vat_rule", "进项税规则未在配置中定义");
  }
  return found;
}

export function resolveManagementFee(
  fleetSize: number,
  tiers: ManagementFeeTierInput[],
): Decimal {
  const matched = tiers.find((tier) => {
    const minOk = fleetSize >= tier.minVehicleCount;
    const maxOk = tier.maxVehicleCount == null || fleetSize < tier.maxVehicleCount;
    return minOk && maxOk;
  });
  if (!matched) {
    throw new EngineError(
      "CALC_PARAMETER_INVALID",
      "management_fee",
      `未找到车队规模 ${fleetSize} 对应的管理费阶梯`,
    );
  }
  return toDecimal(matched.fee);
}

export function splitMileage(
  distanceKm: Decimal,
  rule: EnergyMileageRule,
): { loadedDistance: Decimal; emptyDistance: Decimal } {
  const loadedDistance =
    rule.loadedDistanceMode === "DISTANCE_TIMES_RATIO"
      ? distanceKm.mul(toDecimal(rule.loadedRatio))
      : distanceKm;

  let emptyDistance: Decimal;
  if (rule.emptyDistanceMode === "ZERO") {
    emptyDistance = new Decimal(0);
  } else if (rule.emptyDistanceMode === "DISTANCE_TIMES_RATIO") {
    emptyDistance = distanceKm.mul(toDecimal(rule.emptyRatio));
  } else {
    emptyDistance = distanceKm;
  }

  return { loadedDistance, emptyDistance };
}

export function resolveAdvanceRate(input: SchemeCalculationInput, financeRule: FinanceRule): Decimal {
  if (financeRule.advanceRateSource === "DISCOUNT_RATE") {
    return toDecimal(input.finance.discountRate);
  }
  return toDecimal(input.finance.workingCapitalInterestRate);
}

export function getStandardValue(input: SchemeCalculationInput, code: string): string | null {
  return input.standardParameters.find((p) => p.parameterCode === code)?.value ?? null;
}

export function isExcelPureLease(lease: LeaseTypeConfigInput): boolean {
  if (typeof lease.isPureLease === "boolean") return lease.isPureLease;
  return (
    lease.code === "PURE_LEASE" ||
    lease.code === "OPERATING_LEASE" ||
    lease.name === "纯租赁" ||
    lease.name === "经营租赁"
  );
}

export const DEFAULT_RULE_SET: RuleSet = {
  ruleVersionId: "RULE_PACK_V1",
  energyMileage: {
    loadedDistanceMode: "USE_DISTANCE_KM",
    emptyDistanceMode: "ZERO",
    loadedRatio: "1",
    emptyRatio: "0",
  },
  revenue: {
    formulaByUnit: {
      PER_TON: "PER_TON",
      PER_TRIP: "PER_TRIP",
      PER_TON_KM: "PER_TON_KM",
    },
  },
  finance: {
    advanceRateSource: "DISCOUNT_RATE",
    workingCapitalPrincipalMode: "REVENUE_TIMES_LOAN_CYCLE_MONTHS",
    daysPerMonth: 30,
  },
  maintenance: {
    mode: "PER_VEHICLE_MONTH",
  },
  driverCostDefaultType: "PER_TRIP",
  pricesIncludeVat: true,
  annualFeeAmortizationMonths: 12,
  energyUnit: "KWH_PER_KM",
  energyLoadMode: "SEGMENT_LOAD_STATE",
  fixedCostAnnualization: "TIMES_12_DIV_OPERATING_MONTHS",
  inspectionInsuranceUnit: "MONTHLY",
  workingCapitalBase: "EXCEL_RENT_PLUS_AC42_AC55",
  receivableCycleUnit: "MONTHS",
  workingCapitalLoanCycleUnit: "MONTHS",
  vatMode: "EXCEL_INCLUSIVE",
  allocationWeight: "DISTANCE_TIMES_TRIPS",
};
