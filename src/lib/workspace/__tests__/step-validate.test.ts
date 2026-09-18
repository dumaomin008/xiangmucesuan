import { describe, expect, it } from "vitest";
import { calcCompleteness } from "../completeness";
import { flattenSchemeParams } from "../flatten";
import { diffSchemeParams } from "../param-diff";
import {
  engineFieldToUi,
  mergeIssues,
  validateStep1,
  validateStep2,
  validateStep3,
  validateStep4,
  validateWizardStep,
} from "../step-validate";
import type { Meta, Scheme, Std } from "../types";

function scheme(partial: Partial<Scheme> = {}): Scheme {
  return {
    id: "s1",
    projectId: "p1",
    schemeName: "方案A",
    description: null,
    leaseType: "PURE_LEASE",
    fleetSize: 20,
    calculationYears: 5,
    expectedStartDate: null,
    expectedEndDate: null,
    status: "draft",
    versionNo: "V1",
    sourceSchemeId: null,
    project: {
      id: "p1",
      projectName: "项目A",
      projectCode: "P1",
      customerName: "客户A",
      projectManager: "经理A",
      projectStatus: "draft",
    },
    routes: [],
    vehiclePlan: { monthlyRentPerVehicle: "6500" },
    financeTaxPlan: { operatingMonthsYear: 12 },
    overrides: [],
    ...partial,
  };
}

const meta: Meta = {
  leaseTypes: [
    {
      code: "PURE_LEASE",
      name: "纯租赁",
      showDownPayment: false,
      showInstallment: false,
      showMonthlyRent: true,
      downPaymentRequired: false,
      installmentRequired: false,
      monthlyRentRequired: true,
    },
  ],
  units: [{ code: "YUAN_PER_TON", name: "元/吨" }],
  vatRules: [],
  driverCostTypes: [],
};

describe("step validation", () => {
  it("blocks step 1 when required project fields are empty", () => {
    const issues = validateStep1(
      scheme({
        schemeName: "",
        project: {
          id: "p1",
          projectName: "",
          projectCode: "P1",
          customerName: "",
          projectManager: "",
          projectStatus: "draft",
        },
      }),
    );
    expect(issues.map((i) => i.field)).toEqual(
      expect.arrayContaining(["project.projectName", "project.customerName", "project.projectManager", "schemeName"]),
    );
  });

  it("blocks step 2 when destination is missing or distance is 0", () => {
    const s = scheme({
      routes: [
        {
          id: "r1",
          routeName: "线路1",
          routeCode: "R1",
          description: null,
          weight: null,
          sortNo: 1,
          segments: [
            {
              id: "seg1",
              segmentName: "路段1",
              originName: "昆明",
              destinationName: "",
              distanceKm: "0",
              freightPrice: "",
              freightPriceUnit: "YUAN_PER_TON",
              loadTon: "30",
              tripsPerVehicleMonth: "10",
              operatingMonthsYear: "12",
              electricityPrice: "",
              loadedEnergyConsumption: "",
              emptyEnergyConsumption: "",
              tollPerTrip: "",
              loadingUnloadingFee: "",
              informationFee: "",
              driverCostPerTrip: "",
              sortNo: 1,
            },
          ],
        },
      ],
    });
    const issues = validateStep2(s);
    expect(issues.some((i) => i.field.includes("destinationName"))).toBe(true);
    expect(issues.some((i) => i.field.includes("distanceKm"))).toBe(true);
    expect(validateWizardStep(1, s, meta, [], {}).length).toBeGreaterThan(0);
  });

  it("blocks step 3 when trips are 0", () => {
    const s = scheme({
      fleetSize: 8,
      routes: [
        {
          id: "r1",
          routeName: "线路1",
          routeCode: "R1",
          description: null,
          weight: null,
          sortNo: 1,
          segments: [
            {
              id: "seg1",
              segmentName: "路段1",
              originName: "昆明",
              destinationName: "玉溪",
              distanceKm: "90",
              freightPrice: "220",
              freightPriceUnit: "YUAN_PER_TON",
              loadTon: "30",
              tripsPerVehicleMonth: "0",
              operatingMonthsYear: "12",
              electricityPrice: "0.8",
              loadedEnergyConsumption: "1.2",
              emptyEnergyConsumption: "0.9",
              tollPerTrip: "",
              loadingUnloadingFee: "",
              informationFee: "",
              driverCostPerTrip: "",
              sortNo: 1,
            },
          ],
        },
      ],
    });
    expect(validateStep3(s).some((i) => i.field.includes("tripsPerVehicleMonth"))).toBe(true);
  });

  it("blocks step 4 when monthly rent or freight is missing", () => {
    const s = scheme({
      vehiclePlan: { monthlyRentPerVehicle: "" },
      routes: [
        {
          id: "r1",
          routeName: "线路1",
          routeCode: "R1",
          description: null,
          weight: null,
          sortNo: 1,
          segments: [
            {
              id: "seg1",
              segmentName: "路段1",
              originName: "昆明",
              destinationName: "玉溪",
              distanceKm: "90",
              freightPrice: "",
              freightPriceUnit: "YUAN_PER_TON",
              loadTon: "30",
              tripsPerVehicleMonth: "10",
              operatingMonthsYear: "12",
              electricityPrice: "",
              loadedEnergyConsumption: "",
              emptyEnergyConsumption: "0.9",
              tollPerTrip: "",
              loadingUnloadingFee: "",
              informationFee: "",
              driverCostPerTrip: "",
              sortNo: 1,
            },
          ],
        },
      ],
    });
    const issues = validateStep4(s, meta, [], {});
    expect(issues.some((i) => i.field.includes("freightPrice"))).toBe(true);
    expect(issues.some((i) => i.field === "monthlyRentPerVehicle")).toBe(true);
  });

  it("requires override reason when company standard is changed in this session", () => {
    const std: Std[] = [{ parameterCode: "STD_DRIVER_COST", parameterName: "司机成本", value: "8000", unit: "元", category: "driver" }];
    const s = scheme({ vehiclePlan: { monthlyRentPerVehicle: "6500", driverCost: "9000" } });
    expect(validateStep4(s, meta, std, {}).some((i) => i.field === "override.STD_DRIVER_COST")).toBe(false);
    expect(validateStep4(s, meta, std, { STD_DRIVER_COST: "" }).some((i) => i.field === "override.STD_DRIVER_COST")).toBe(true);
  });

  it("maps engine fields to UI field ids", () => {
    expect(engineFieldToUi("segment.abc.freight_price")).toBe("segment.abc.freightPrice");
    expect(engineFieldToUi("fleet_size")).toBe("fleetSize");
  });

  it("merges local and engine issues without duplicate messages", () => {
    const merged = mergeIssues(
      [{ field: "fleetSize", message: "车队规模必须大于 0", step: 2 }],
      [{ field: "fleet_size", message: "车辆数必须为正整数" }],
    );
    expect(merged).toHaveLength(2);
  });
});

describe("completeness is fill progress not calculate gate", () => {
  it("can be high while still missing engine-only checks", () => {
    const result = calcCompleteness(scheme({ schemeName: "A", fleetSize: 20, calculationYears: 5 }), false);
    expect(result.percent).toBeLessThan(100);
    expect(result.missing.length).toBeGreaterThan(0);
  });
});

describe("param diff uses stable keys after copy", () => {
  it("ignores auto-renamed schemeName and reports business changes", () => {
    const source = scheme({
      schemeName: "基准A",
      fleetSize: 20,
      routes: [
        {
          id: "r-src",
          routeName: "线路1",
          routeCode: "R1",
          description: null,
          weight: null,
          sortNo: 1,
          segments: [
            {
              id: "seg-src",
              segmentName: "路段1",
              originName: "昆明",
              destinationName: "玉溪",
              distanceKm: "90",
              freightPrice: "220",
              freightPriceUnit: "YUAN_PER_TON",
              loadTon: "30",
              tripsPerVehicleMonth: "10",
              operatingMonthsYear: "12",
              electricityPrice: "0.82",
              loadedEnergyConsumption: "1.35",
              emptyEnergyConsumption: "0.95",
              tollPerTrip: "",
              loadingUnloadingFee: "",
              informationFee: "",
              driverCostPerTrip: "",
              sortNo: 1,
            },
          ],
        },
      ],
    });
    const copy = {
      ...source,
      id: "s2",
      schemeName: "基准A（副本）",
      fleetSize: 18,
      routes: source.routes.map((route) => ({
        ...route,
        id: "r-copy",
        segments: route.segments.map((seg) => ({ ...seg, id: "seg-copy", freightPrice: "260" })),
      })),
    };
    const changes = diffSchemeParams(copy, source);
    expect(changes.some((c) => c.key === "schemeName")).toBe(false);
    expect(changes.some((c) => c.key === "fleetSize")).toBe(true);
    expect(changes.some((c) => c.label.includes("运价"))).toBe(true);
    expect(flattenSchemeParams(copy).find((r) => r.key === "route.0.seg.0.freightPrice")?.value).toBe("260");
  });
});
