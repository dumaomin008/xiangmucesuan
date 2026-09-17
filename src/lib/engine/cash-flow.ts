import { Decimal } from "./decimal";
import { calcExcelInputVat, calcExcelOutputVat, settleMonthlyVat } from "./tax";
import type {
  AnnualCashFlow,
  InputVatRuleInput,
  MonthlyCashFlow,
} from "./types";

export const IRR_MAX_YEARS = 8;

export type ActualMonthlyCosts = {
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

export type OperatingPnlSlice = {
  driverCost: Decimal;
  tollCost: Decimal;
  loadingCost: Decimal;
  infoCost: Decimal;
  energyCost: Decimal;
  tireCost: Decimal;
};

export function monthInYear(monthIndex: number): number {
  if (monthIndex <= 0) return 0;
  return ((monthIndex - 1) % 12) + 1;
}

export function yearOfMonth(monthIndex: number): number {
  if (monthIndex <= 0) return 0;
  return Math.ceil(monthIndex / 12);
}

export function isProjectMonth(monthIndex: number, projectHorizonMonths: number): boolean {
  return monthIndex >= 1 && monthIndex <= projectHorizonMonths;
}

export function isOperatingMonth(
  monthIndex: number,
  projectHorizonMonths: number,
  operatingMonthsYear: number,
): boolean {
  if (!isProjectMonth(monthIndex, projectHorizonMonths)) return false;
  return monthInYear(monthIndex) <= operatingMonthsYear;
}

export function isRentMonth(monthIndex: number, installmentMonths: number): boolean {
  return monthIndex >= 1 && installmentMonths > 0 && monthIndex <= installmentMonths;
}

export function accumulateCurrentNet(
  month0Net: Decimal,
  monthlyNets: Decimal[],
): { monthIndex: number; currentNetCashFlow: Decimal; cumulativeCashFlow: Decimal }[] {
  const rows: { monthIndex: number; currentNetCashFlow: Decimal; cumulativeCashFlow: Decimal }[] = [];
  let cumulative = new Decimal(0);
  const all = [month0Net, ...monthlyNets];
  for (let i = 0; i < all.length; i++) {
    cumulative = cumulative.plus(all[i]);
    rows.push({
      monthIndex: i,
      currentNetCashFlow: all[i],
      cumulativeCashFlow: cumulative,
    });
  }
  return rows;
}

function zeroRow(monthIndex: number, vatOpening: Decimal, projectHorizonMonths: number, operatingMonthsYear: number): MonthlyCashFlow {
  const zero = new Decimal(0);
  return {
    monthIndex,
    isOperatingMonth: isOperatingMonth(monthIndex, projectHorizonMonths, operatingMonthsYear),
    isProjectMonth: isProjectMonth(monthIndex, projectHorizonMonths),
    revenueCashIn: zero,
    operatingCashOut: zero,
    vehicleCashOut: zero,
    financingCashFlow: zero,
    taxCashOut: zero,
    currentNetCashFlow: zero,
    cumulativeCashFlow: zero,
    openingVatCredit: vatOpening,
    outputVat: zero,
    inputVat: zero,
    vatCreditUsed: zero,
    closingVatCredit: vatOpening,
  };
}

export function buildHorizonCashFlows(params: {
  calculationYears: number;
  irrMaxYears?: number;
  projectHorizonMonths: number;
  operatingMonthsYear: number;
  installmentMonths: number;
  downPaymentTotal: Decimal;
  inputStandardRate: Decimal;
  inputInsuranceRate: Decimal;
  outputVatRate: Decimal;
  monthlyRevenue: Decimal;
  actualMonthly: ActualMonthlyCosts;
  operatingPnl: OperatingPnlSlice;
  discountRate: Decimal;
  receivableMonths: Decimal;
  wcRate: Decimal;
  loanCycleMonths: Decimal;
  vatHandling: InputVatRuleInput["negativeVatHandling"];
}): { monthly: MonthlyCashFlow[]; annual: AnnualCashFlow[] } {
  const irrMaxYears = params.irrMaxYears ?? IRR_MAX_YEARS;
  const seriesMonths = Math.max(params.calculationYears * 12, 0);
  const operatingMonthsYear = params.operatingMonthsYear;
  const horizon = params.projectHorizonMonths;
  const zero = new Decimal(0);

  const down = params.downPaymentTotal.gt(0) ? params.downPaymentTotal : zero;
  const downInputVat = down.gt(0)
    ? down.mul(params.inputStandardRate).div(params.inputStandardRate.plus(1))
    : zero;

  const monthly: MonthlyCashFlow[] = [];
  let cumulative = zero;
  let openingVatCredit = zero;

  const month0Vat = settleMonthlyVat({
    openingVatCredit,
    outputVat: zero,
    inputVat: downInputVat,
    handling: params.vatHandling,
  });
  const month0Net = zero
    .minus(down)
    .minus(month0Vat.vatCashOut);
  cumulative = month0Net;
  monthly.push({
    monthIndex: 0,
    isOperatingMonth: false,
    isProjectMonth: false,
    revenueCashIn: zero,
    operatingCashOut: zero,
    vehicleCashOut: down,
    financingCashFlow: zero,
    taxCashOut: month0Vat.vatCashOut,
    currentNetCashFlow: month0Net,
    cumulativeCashFlow: cumulative,
    openingVatCredit: month0Vat.openingVatCredit,
    outputVat: month0Vat.outputVat,
    inputVat: month0Vat.inputVat,
    vatCreditUsed: month0Vat.vatCreditUsed,
    closingVatCredit: month0Vat.closingVatCredit,
  });
  openingVatCredit = month0Vat.closingVatCredit;

  for (let month = 1; month <= seriesMonths; month++) {
    const inProject = isProjectMonth(month, horizon);
    const operating = isOperatingMonth(month, horizon, operatingMonthsYear);
    if (!inProject) {
      const idle = zeroRow(month, openingVatCredit, horizon, operatingMonthsYear);
      idle.cumulativeCashFlow = cumulative;
      monthly.push(idle);
      continue;
    }

    const revenue = operating ? params.monthlyRevenue : zero;
    const rent = isRentMonth(month, params.installmentMonths) ? params.actualMonthly.rent : zero;
    const managementFee = params.actualMonthly.managementFee;
    const roadFee = params.actualMonthly.roadFee;
    const maintenanceFee = params.actualMonthly.maintenanceFee;
    const inspectionFee = params.actualMonthly.inspectionFee;
    const insuranceFee = params.actualMonthly.insuranceFee;
    const parkingFee = params.actualMonthly.parkingFee;
    const heaterFee = params.actualMonthly.heaterFee;
    const consumableFee = params.actualMonthly.consumableFee;
    const driverCost = operating ? params.operatingPnl.driverCost : zero;
    const tollCost = operating ? params.operatingPnl.tollCost : zero;
    const loadingCost = operating ? params.operatingPnl.loadingCost : zero;
    const infoCost = operating ? params.operatingPnl.infoCost : zero;
    const energyCost = operating ? params.operatingPnl.energyCost : zero;
    const tireCost = operating ? params.operatingPnl.tireCost : zero;
    const advanceCost = revenue.mul(params.discountRate).div(12).mul(params.receivableMonths);
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
    const wcInterest = sum5to19.mul(params.wcRate).div(12).mul(params.loanCycleMonths);
    const outputVat = calcExcelOutputVat(revenue, params.outputVatRate);
    const inputVat = calcExcelInputVat({
      vehicleCost: rent,
      energyCost,
      tireCost,
      insuranceCost: insuranceFee,
      inputStandardRate: params.inputStandardRate,
      inputInsuranceRate: params.inputInsuranceRate,
    });
    const vat = settleMonthlyVat({
      openingVatCredit,
      outputVat,
      inputVat,
      handling: params.vatHandling,
    });
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
    const current = revenue.minus(sum5to19).minus(advanceCost).minus(wcInterest).minus(vat.vatCashOut);
    cumulative = cumulative.plus(current);
    openingVatCredit = vat.closingVatCredit;
    monthly.push({
      monthIndex: month,
      isOperatingMonth: operating,
      isProjectMonth: true,
      revenueCashIn: revenue,
      operatingCashOut,
      vehicleCashOut: rent,
      financingCashFlow: wcInterest,
      taxCashOut: vat.vatCashOut,
      currentNetCashFlow: current,
      cumulativeCashFlow: cumulative,
      openingVatCredit: vat.openingVatCredit,
      outputVat: vat.outputVat,
      inputVat: vat.inputVat,
      vatCreditUsed: vat.vatCreditUsed,
      closingVatCredit: vat.closingVatCredit,
    });
  }

  return {
    monthly,
    annual: aggregateAnnualFromMonthly(monthly, irrMaxYears),
  };
}

export function aggregateAnnualFromMonthly(monthly: MonthlyCashFlow[], maxYear = IRR_MAX_YEARS): AnnualCashFlow[] {
  const month0 = monthly.find((row) => row.monthIndex === 0);
  const year0Net = month0?.currentNetCashFlow ?? new Decimal(0);
  const rows: AnnualCashFlow[] = [
    {
      yearIndex: 0,
      currentNetCashFlow: year0Net,
      cumulativeCashFlow: month0?.cumulativeCashFlow ?? year0Net,
      active: true,
    },
  ];
  let cumulative = rows[0].cumulativeCashFlow;
  for (let year = 1; year <= maxYear; year++) {
    const start = (year - 1) * 12 + 1;
    const end = year * 12;
    const months = monthly.filter((row) => row.monthIndex >= start && row.monthIndex <= end);
    const current = months.reduce((sum, row) => sum.plus(row.currentNetCashFlow), new Decimal(0));
    const active = months.some((row) => row.isProjectMonth);
    cumulative = cumulative.plus(current);
    rows.push({
      yearIndex: year,
      currentNetCashFlow: current,
      cumulativeCashFlow: cumulative,
      active,
    });
  }
  return rows;
}

export function sumMonthlyField(
  monthly: MonthlyCashFlow[],
  yearIndex: number,
  field: keyof Pick<MonthlyCashFlow, "vehicleCashOut" | "revenueCashIn" | "taxCashOut" | "currentNetCashFlow">,
): Decimal {
  if (yearIndex === 0) {
    const month0 = monthly.find((row) => row.monthIndex === 0);
    return month0 ? (month0[field] as Decimal) : new Decimal(0);
  }
  const start = (yearIndex - 1) * 12 + 1;
  const end = yearIndex * 12;
  return monthly
    .filter((row) => row.monthIndex >= start && row.monthIndex <= end)
    .reduce((sum, row) => sum.plus(row[field] as Decimal), new Decimal(0));
}
