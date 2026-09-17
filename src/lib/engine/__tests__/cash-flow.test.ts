import { describe, expect, it } from "vitest";
import { Decimal } from "../decimal";
import {
  accumulateCurrentNet,
  isOperatingMonth,
  isProjectMonth,
  isRentMonth,
  monthInYear,
  sumMonthlyField,
  yearOfMonth,
} from "../cash-flow";
import { calculateExcelV5, resolveProjectHorizonMonths, buildExcelContext } from "../excel-v5";
import { firstPositiveMonth } from "../investment";
import { settleMonthlyVat } from "../tax";
import { excelExampleInput } from "./fixture";

function rentOfYear(flows: ReturnType<typeof calculateExcelV5>["cashFlows"], year: number) {
  return sumMonthlyField(flows, year, "vehicleCashOut");
}

describe("Golden CashFlow 01：初始投资进入累计与转正", () => {
  it("手算 Month0=-1800000, 每月+100000 → Month17累计=-100000, Month18累计=0, firstPositiveMonth=18", () => {
    const rows = accumulateCurrentNet(
      new Decimal(-1800000),
      Array.from({ length: 24 }, () => new Decimal(100000)),
    );
    expect(rows[0].monthIndex).toBe(0);
    expect(rows[0].currentNetCashFlow.toString()).toBe("-1800000");
    expect(rows[0].cumulativeCashFlow.toString()).toBe("-1800000");
    expect(rows[17].monthIndex).toBe(17);
    expect(rows[17].cumulativeCashFlow.toString()).toBe("-100000");
    expect(rows[18].monthIndex).toBe(18);
    expect(rows[18].cumulativeCashFlow.toString()).toBe("0");
    expect(firstPositiveMonth(rows)).toBe(18);
  });

  it("Month 0 已经 >= 0 时不得返回 Month 1", () => {
    const rows = accumulateCurrentNet(new Decimal(0), [new Decimal(100), new Decimal(100)]);
    expect(firstPositiveMonth(rows)).toBe(0);
  });

  it("测算期内未转正返回 null", () => {
    const rows = accumulateCurrentNet(
      new Decimal(-1000000),
      Array.from({ length: 12 }, () => new Decimal(10000)),
    );
    expect(rows[12].cumulativeCashFlow.toString()).toBe("-880000");
    expect(firstPositiveMonth(rows)).toBeNull();
  });
});

describe("Golden CashFlow 02/03：非整年项目经营周期", () => {
  it.each([12, 18, 24, 30, 36, 42, 54, 60])("projectOperatingMonths=%i 按月生成，不按年截断", (months) => {
    const input = excelExampleInput();
    input.leaseType = "HIRE_PURCHASE";
    input.vehicle.leaseType = "HIRE_PURCHASE";
    input.vehicle.downPaymentPerVehicle = "60000";
    input.finance.projectOperatingMonths = months;
    input.calculationYears = 5;
    input.finance.calculationYears = 5;
    const v5 = calculateExcelV5(input);
    const operating = v5.cashFlows.filter((row) => row.isOperatingMonth || row.isProjectMonth);
    const lastProject = v5.cashFlows.filter((row) => row.isProjectMonth).at(-1);
    expect(lastProject?.monthIndex).toBe(months);
    expect(v5.cashFlows.some((row) => row.monthIndex === months + 1 && row.isProjectMonth)).toBe(false);
    expect(v5.cashFlows.find((row) => row.monthIndex === months)?.isProjectMonth).toBe(true);
    expect(operating.length).toBeGreaterThan(0);
  });

  it("Golden 02：30个月经营期，Month1~30存在，Month31停止经营，Year3包含Month25~30", () => {
    const input = excelExampleInput();
    input.leaseType = "HIRE_PURCHASE";
    input.vehicle.leaseType = "HIRE_PURCHASE";
    input.finance.projectOperatingMonths = 30;
    const v5 = calculateExcelV5(input);
    expect(v5.cashFlows.find((row) => row.monthIndex === 30)?.isProjectMonth).toBe(true);
    expect(v5.cashFlows.find((row) => row.monthIndex === 31)?.isProjectMonth).toBe(false);
    expect(v5.cashFlows.find((row) => row.monthIndex === 31)?.isOperatingMonth).toBe(false);
    const year3Months = v5.cashFlows.filter((row) => row.monthIndex >= 25 && row.monthIndex <= 30);
    expect(year3Months).toHaveLength(6);
    expect(year3Months.every((row) => row.isProjectMonth)).toBe(true);
    expect(v5.annualCashFlows.find((row) => row.yearIndex === 3)?.active).toBe(true);
    expect(v5.annualCashFlows.find((row) => row.yearIndex === 4)?.active).toBe(false);
  });

  it("Golden 03：18个月经营期，Year1=Month1~12，Year2=Month13~18", () => {
    const input = excelExampleInput();
    input.leaseType = "HIRE_PURCHASE";
    input.vehicle.leaseType = "HIRE_PURCHASE";
    input.finance.projectOperatingMonths = 18;
    const v5 = calculateExcelV5(input);
    expect(v5.cashFlows.filter((row) => row.monthIndex >= 1 && row.monthIndex <= 12).every((row) => row.isProjectMonth)).toBe(true);
    expect(v5.cashFlows.filter((row) => row.monthIndex >= 13 && row.monthIndex <= 18).every((row) => row.isProjectMonth)).toBe(true);
    expect(v5.cashFlows.find((row) => row.monthIndex === 19)?.isProjectMonth).toBe(false);
    expect(v5.annualCashFlows.find((row) => row.yearIndex === 1)?.active).toBe(true);
    expect(v5.annualCashFlows.find((row) => row.yearIndex === 2)?.active).toBe(true);
    expect(v5.annualCashFlows.find((row) => row.yearIndex === 3)?.active).toBe(false);
  });

  it("18/30/42/54 不得只算成 12/24/36/48 个月", () => {
    for (const months of [18, 30, 42, 54]) {
      expect(isProjectMonth(months, months)).toBe(true);
      expect(isProjectMonth(months + 1, months)).toBe(false);
      expect(Math.floor(months / 12) * 12).toBeLessThan(months);
    }
  });

  it("年运营月数仍生效：30个月项目、每年10个运营月", () => {
    const input = excelExampleInput();
    input.finance.projectOperatingMonths = 30;
    input.finance.operatingMonthsYear = 10;
    const v5 = calculateExcelV5(input);
    expect(v5.cashFlows.find((row) => row.monthIndex === 10)?.isOperatingMonth).toBe(true);
    expect(v5.cashFlows.find((row) => row.monthIndex === 11)?.isOperatingMonth).toBe(false);
    expect(v5.cashFlows.find((row) => row.monthIndex === 12)?.isOperatingMonth).toBe(false);
    expect(v5.cashFlows.find((row) => row.monthIndex === 13)?.isOperatingMonth).toBe(true);
    expect(v5.cashFlows.find((row) => row.monthIndex === 22)?.isOperatingMonth).toBe(true);
    expect(v5.cashFlows.find((row) => row.monthIndex === 23)?.isOperatingMonth).toBe(false);
    expect(v5.cashFlows.find((row) => row.monthIndex === 25)?.isOperatingMonth).toBe(true);
    expect(v5.cashFlows.find((row) => row.monthIndex === 30)?.isOperatingMonth).toBe(true);
  });
});

describe("Golden CashFlow 04/05：尾期租金不重复计提", () => {
  it.each([1, 6, 12, 18, 24, 30, 36, 42, 54, 60])("installmentMonths=%i 只在 monthIndex<=分期月发生租金", (installmentMonths) => {
    const input = excelExampleInput();
    input.vehicle.installmentMonths = installmentMonths;
    input.finance.projectOperatingMonths = 60;
    input.calculationYears = 5;
    const v5 = calculateExcelV5(input);
    const monthlyRent = new Decimal("13900").mul(2);
    for (const row of v5.cashFlows) {
      if (row.monthIndex <= 0) continue;
      if (row.monthIndex <= installmentMonths) {
        expect(row.vehicleCashOut.toString(), `month ${row.monthIndex} rent`).toBe(monthlyRent.toString());
      } else {
        expect(row.vehicleCashOut.toString(), `month ${row.monthIndex} no rent`).toBe("0");
      }
    }
  });

  it("Golden 04：30个月分期 Year1=12, Year2=12, Year3=6, Year4=0, Year5=0", () => {
    const input = excelExampleInput();
    input.vehicle.installmentMonths = 30;
    input.finance.projectOperatingMonths = 60;
    const v5 = calculateExcelV5(input);
    const monthlyRent = new Decimal("13900").mul(2);
    expect(rentOfYear(v5.cashFlows, 1).toString()).toBe(monthlyRent.mul(12).toString());
    expect(rentOfYear(v5.cashFlows, 2).toString()).toBe(monthlyRent.mul(12).toString());
    expect(rentOfYear(v5.cashFlows, 3).toString()).toBe(monthlyRent.mul(6).toString());
    expect(rentOfYear(v5.cashFlows, 4).toString()).toBe("0");
    expect(rentOfYear(v5.cashFlows, 5).toString()).toBe("0");
  });

  it("Golden 05：42个月分期 12+12+12+6，后续为 0", () => {
    const input = excelExampleInput();
    input.vehicle.installmentMonths = 42;
    input.finance.projectOperatingMonths = 60;
    const v5 = calculateExcelV5(input);
    const monthlyRent = new Decimal("13900").mul(2);
    expect(rentOfYear(v5.cashFlows, 1).toString()).toBe(monthlyRent.mul(12).toString());
    expect(rentOfYear(v5.cashFlows, 2).toString()).toBe(monthlyRent.mul(12).toString());
    expect(rentOfYear(v5.cashFlows, 3).toString()).toBe(monthlyRent.mul(12).toString());
    expect(rentOfYear(v5.cashFlows, 4).toString()).toBe(monthlyRent.mul(6).toString());
    expect(rentOfYear(v5.cashFlows, 5).toString()).toBe("0");
  });

  it("54个月分期 12+12+12+12+6，后续为 0", () => {
    const input = excelExampleInput();
    input.vehicle.installmentMonths = 54;
    input.finance.projectOperatingMonths = 60;
    const v5 = calculateExcelV5(input);
    const monthlyRent = new Decimal("13900").mul(2);
    expect(rentOfYear(v5.cashFlows, 1).toString()).toBe(monthlyRent.mul(12).toString());
    expect(rentOfYear(v5.cashFlows, 4).toString()).toBe(monthlyRent.mul(12).toString());
    expect(rentOfYear(v5.cashFlows, 5).toString()).toBe(monthlyRent.mul(6).toString());
  });
});

describe("Golden CashFlow 06：VAT CARRY_FORWARD 留抵", () => {
  it("手算 Month1 销项50000/进项80000 → vatCashOut=0, closing=30000", () => {
    const month1 = settleMonthlyVat({
      openingVatCredit: new Decimal(0),
      outputVat: new Decimal(50000),
      inputVat: new Decimal(80000),
      handling: "CARRY_FORWARD",
    });
    expect(month1.vatCashOut.toString()).toBe("0");
    expect(month1.closingVatCredit.toString()).toBe("30000");
    expect(month1.vatCreditUsed.toString()).toBe("50000");
  });

  it("手算 Month2 销项70000/进项20000/期初30000 → vatCashOut=20000, closing=0", () => {
    const month2 = settleMonthlyVat({
      openingVatCredit: new Decimal(30000),
      outputVat: new Decimal(70000),
      inputVat: new Decimal(20000),
      handling: "CARRY_FORWARD",
    });
    expect(month2.vatCashOut.toString()).toBe("20000");
    expect(month2.closingVatCredit.toString()).toBe("0");
    expect(month2.vatCreditUsed.toString()).toBe("50000");
  });

  it("负增值税不默认形成现金流入；RECOGNIZE_NEGATIVE 才把差额记入当期现金流", () => {
    const carry = settleMonthlyVat({
      openingVatCredit: new Decimal(0),
      outputVat: new Decimal(50000),
      inputVat: new Decimal(80000),
      handling: "CARRY_FORWARD",
    });
    expect(carry.vatCashOut.gte(0)).toBe(true);
    expect(carry.vatCashOut.toString()).toBe("0");
    const recognize = settleMonthlyVat({
      openingVatCredit: new Decimal(0),
      outputVat: new Decimal(50000),
      inputVat: new Decimal(80000),
      handling: "RECOGNIZE_NEGATIVE",
    });
    expect(recognize.vatCashOut.toString()).toBe("-30000");
    expect(recognize.closingVatCredit.toString()).toBe("0");
  });
});

describe("Month 0 初始投资与年度聚合 / IRR", () => {
  it("非纯租赁 Month 0 = -首付，进项税留抵不形成现金流入", () => {
    const input = excelExampleInput();
    input.leaseType = "HIRE_PURCHASE";
    input.vehicle.leaseType = "HIRE_PURCHASE";
    input.vehicle.downPaymentPerVehicle = "60000";
    const v5 = calculateExcelV5(input);
    expect(v5.cashFlows[0].monthIndex).toBe(0);
    expect(v5.cashFlows[0].vehicleCashOut.toString()).toBe("120000");
    expect(v5.cashFlows[0].taxCashOut.toString()).toBe("0");
    expect(v5.cashFlows[0].currentNetCashFlow.toString()).toBe("-120000");
    expect(v5.cashFlows[0].cumulativeCashFlow.toString()).toBe("-120000");
    expect(v5.annualCashFlows[0].currentNetCashFlow.toString()).toBe("-120000");
    expect(v5.cashFlows[0].closingVatCredit.gt(0)).toBe(true);
    expect(v5.cashFlows[1].openingVatCredit.toString()).toBe(v5.cashFlows[0].closingVatCredit.toString());
    const irr4 = v5.irrByYears.find((row) => row.years === 4);
    expect(irr4?.irr).not.toBeNull();
    expect(v5.cashFlows[0].currentNetCashFlow.lt(0)).toBe(true);
  });

  it("年度现金流等于对应月份净现金流之和", () => {
    const v5 = calculateExcelV5(excelExampleInput());
    const year1 = v5.cashFlows
      .filter((row) => row.monthIndex >= 1 && row.monthIndex <= 12)
      .reduce((sum, row) => sum.plus(row.currentNetCashFlow), new Decimal(0));
    const year3 = v5.cashFlows
      .filter((row) => row.monthIndex >= 25 && row.monthIndex <= 30)
      .reduce((sum, row) => sum.plus(row.currentNetCashFlow), new Decimal(0));
    expect(v5.annualCashFlows[1].currentNetCashFlow.eq(year1)).toBe(true);
    expect(v5.annualCashFlows[3].currentNetCashFlow.eq(year3)).toBe(true);
  });

  it("时间轴辅助函数按月而不是按年", () => {
    expect(monthInYear(1)).toBe(1);
    expect(monthInYear(12)).toBe(12);
    expect(monthInYear(13)).toBe(1);
    expect(monthInYear(30)).toBe(6);
    expect(yearOfMonth(30)).toBe(3);
    expect(isOperatingMonth(30, 30, 10)).toBe(true);
    expect(isOperatingMonth(31, 30, 10)).toBe(false);
    expect(isRentMonth(30, 30)).toBe(true);
    expect(isRentMonth(31, 30)).toBe(false);
    const ctx = buildExcelContext(
      excelExampleInput({ finance: { ...excelExampleInput().finance, projectOperatingMonths: 30 } }),
    );
    expect(resolveProjectHorizonMonths(ctx)).toBe(30);
  });
});
