import { Decimal } from "@/calculation";
import type { SchemeCalculationInput } from "@/calculation";
import { excelExampleInput } from "@/lib/engine/__tests__/fixture";
import { cloneJson } from "../utils";

export function profitableInput(): SchemeCalculationInput {
  const input = excelExampleInput();
  for (const seg of input.routes[0].segments) {
    seg.freightPrice = new Decimal(seg.freightPrice).mul(1.35).toString();
    seg.loadedEnergyConsumption = "1.2";
    seg.electricityPrice = "0.6";
  }
  input.schemeName = "正常盈利案例";
  return input;
}

export function lossInput(): SchemeCalculationInput {
  const input = excelExampleInput();
  for (const seg of input.routes[0].segments) {
    seg.freightPrice = new Decimal(seg.freightPrice).mul(0.45).toString();
    seg.loadedEnergyConsumption = "2.8";
    seg.emptyEnergyConsumption = "2.0";
    seg.electricityPrice = "1.8";
    seg.tollPerTrip = "2500";
  }
  input.vehicle.monthlyRentPerVehicle = "18000";
  input.schemeName = "明显亏损案例";
  return input;
}

export function highEnergyPriceInput(): SchemeCalculationInput {
  const input = excelExampleInput();
  for (const seg of input.routes[0].segments) {
    seg.electricityPrice = "2.5";
    seg.loadedEnergyConsumption = "3.5";
    seg.emptyEnergyConsumption = "2.8";
  }
  input.schemeName = "高能耗高电价";
  return input;
}

export function financeHirePurchaseInput(): SchemeCalculationInput {
  const input = excelExampleInput();
  input.leaseType = "HIRE_PURCHASE";
  input.vehicle.leaseType = "HIRE_PURCHASE";
  input.vehicle.downPaymentPerVehicle = "60000";
  input.finance.depreciationMonths = 60;
  input.schemeName = "融资非纯租赁";
  return input;
}

export function marginalInput(): SchemeCalculationInput {
  const input = excelExampleInput();
  for (const seg of input.routes[0].segments) {
    seg.electricityPrice = "0.95";
    seg.freightPrice = new Decimal(seg.freightPrice).mul(0.96).toString();
  }
  input.schemeName = "盈利边缘基准";
  return input;
}

export function rescueLossInput(): SchemeCalculationInput {
  const input = lossInput();
  input.vehicle.monthlyRentPerVehicle = "12000";
  for (const seg of input.routes[0].segments) {
    seg.electricityPrice = "1.2";
    seg.tollPerTrip = "1500";
  }
  input.schemeName = "降租自救方案";
  return input;
}

export { cloneJson };
