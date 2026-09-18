import { describe, expect, it } from "vitest";
import { Decimal } from "@/lib/engine/decimal";
import { calculateScheme } from "@/lib/engine/calculate";
import { calculateExcelMonthlyPnl } from "@/lib/engine/excel-v5";
import { runSensitivity as engineSensitivity } from "@/lib/engine/sensitivity";
import {
  calculateProject,
  createApiAdapter,
  createBrowserAdapter,
  snapshotKeyMetrics,
} from "@/calculation";
import { CONSISTENCY_CASES, type ConsistencyCase } from "./cases";

const MONEY_TOL = new Decimal("0.01");
const RATE_TOL = new Decimal("0.0001");

type KeyMetricRow = {
  caseId: string;
  name: string;
  excelRevenue: string | null;
  excelProfit: string | null;
  backendRevenue: string;
  backendProfit: string;
  backendIrr: string | null;
  browserRevenue: string;
  browserProfit: string;
  browserIrr: string | null;
  apiLocalRevenue: string;
  apiLocalProfit: string;
  maxDiff: string;
  verdict: "PASS" | "FAIL";
  notes: string[];
};

const reportRows: KeyMetricRow[] = [];

function expectClose(actual: Decimal, expected: Decimal.Value, label: string, tol = MONEY_TOL) {
  const exp = new Decimal(expected);
  const diff = actual.minus(exp).abs();
  expect(diff.lte(tol), `${label}: actual=${actual.toString()} expected=${exp.toString()} diff=${diff.toString()}`).toBe(
    true,
  );
  return diff;
}

function maxDecimal(...values: Decimal[]) {
  return values.reduce((a, b) => (a.gte(b) ? a : b), new Decimal(0));
}

function compareOutputs(
  backend: ReturnType<typeof calculateScheme>,
  browser: ReturnType<typeof calculateProject>,
  apiLocal: ReturnType<typeof calculateProject>,
  label: string,
) {
  const keys: (keyof typeof backend)[] = [
    "monthlyRevenue",
    "monthlyFixedCost",
    "monthlyVariableCost",
    "monthlyFinanceCost",
    "monthlyTaxCost",
    "monthlyTotalCost",
    "monthlyProfit",
    "monthlyVolume",
    "monthlyMileage",
    "cumulativeCashFlow",
  ];
  let maxDiff = new Decimal(0);
  for (const key of keys) {
    const b = backend[key] as Decimal;
    const br = browser[key] as Decimal;
    const a = apiLocal[key] as Decimal;
    expect(br.toString(), `${label}.${key} browser===backend`).toBe(b.toString());
    expect(a.toString(), `${label}.${key} apiLocal===backend`).toBe(b.toString());
    maxDiff = maxDecimal(maxDiff, br.minus(b).abs(), a.minus(b).abs());
  }
  expect(browser.profitMargin?.toString() ?? null).toBe(backend.profitMargin?.toString() ?? null);
  expect(browser.irr?.toString() ?? null).toBe(backend.irr?.toString() ?? null);
  expect(browser.irrReason).toBe(backend.irrReason);
  expect(browser.firstPositiveMonth).toBe(backend.firstPositiveMonth);
  expect(browser.cashFlows.length).toBe(backend.cashFlows.length);
  expect(browser.annualCashFlows.length).toBe(backend.annualCashFlows.length);
  for (let i = 0; i < backend.cashFlows.length; i++) {
    expect(browser.cashFlows[i].currentNetCashFlow.toString()).toBe(backend.cashFlows[i].currentNetCashFlow.toString());
    expect(browser.cashFlows[i].cumulativeCashFlow.toString()).toBe(backend.cashFlows[i].cumulativeCashFlow.toString());
  }
  return maxDiff;
}

function runCase(c: ConsistencyCase): KeyMetricRow {
  const input = c.input();
  const backend = calculateScheme(input);
  const browser = createBrowserAdapter("browser").calculate(input);
  const apiLocal = createApiAdapter({ mode: "api" }).calculateLocal(input);
  const viaProject = calculateProject(input);

  const maxDiff = maxDecimal(
    compareOutputs(backend, browser, apiLocal, c.id),
    compareOutputs(backend, viaProject, apiLocal, `${c.id}/calculateProject`),
  );

  const notes: string[] = [];
  let verdict: "PASS" | "FAIL" = "PASS";

  if (c.excel) {
    const { total } = calculateExcelMonthlyPnl(input);
    try {
      expectClose(total.revenue, c.excel.revenue!, "excel.revenue");
      expectClose(total.profit, c.excel.profit!, "excel.profit");
      expectClose(total.totalCost, c.excel.totalCost!, "excel.totalCost");
      expectClose(total.vatPayable, c.excel.vatPayable!, "excel.vat");
      expectClose(backend.monthlyRevenue, c.excel.revenue!, "backend vs excel revenue");
      expectClose(browser.monthlyRevenue, c.excel.revenue!, "browser vs excel revenue");
      expectClose(backend.monthlyProfit, c.excel.profit!, "backend vs excel profit");
      expectClose(browser.monthlyProfit, c.excel.profit!, "browser vs excel profit");
    } catch (err) {
      verdict = "FAIL";
      notes.push(err instanceof Error ? err.message : String(err));
    }
  }

  if (c.profitSign === "positive" && !backend.monthlyProfit.gt(0)) {
    verdict = "FAIL";
    notes.push(`期望盈利，实际利润=${backend.monthlyProfit.toString()}`);
  }
  if (c.profitSign === "negative" && !backend.monthlyProfit.lt(0)) {
    verdict = "FAIL";
    notes.push(`期望亏损，实际利润=${backend.monthlyProfit.toString()}`);
  }
  if (c.profitSign === "zero" && !backend.monthlyProfit.isZero()) {
    verdict = "FAIL";
    notes.push(`期望零利润，实际=${backend.monthlyProfit.toString()}`);
  }

  if (c.expectIrr) {
    const irr4 = backend.irrByYears.find((row) => row.years === 4);
    if (!irr4?.irr) {
      verdict = "FAIL";
      notes.push(`期望 IRR 可解，reason=${irr4?.reason ?? backend.irrReason}`);
    }
  }

  if (c.runSensitivity) {
    const engineRows = engineSensitivity({
      input,
      variable: "freight_price",
      changeMode: "PERCENT",
      minChange: "-10",
      maxChange: "10",
      step: "5",
    });
    const browserRows = createBrowserAdapter("browser").sensitivity({
      input,
      variable: "freight_price",
      changeMode: "PERCENT",
      minChange: "-10",
      maxChange: "10",
      step: "5",
    });
    expect(JSON.stringify(browserRows)).toBe(JSON.stringify(engineRows));
    const baseline = browserRows.find((r) => r.isBaseline);
    expect(baseline?.monthlyProfit).toBe(backend.monthlyProfit.toFixed(2));
  }

  // 序列化快照可逆关键字段
  const snap = snapshotKeyMetrics(browser);
  expect(snap.monthlyRevenue).toBe(backend.monthlyRevenue.toString());
  expect(snap.monthlyProfit).toBe(backend.monthlyProfit.toString());

  const row: KeyMetricRow = {
    caseId: c.id,
    name: c.name,
    excelRevenue: c.excel?.revenue ?? null,
    excelProfit: c.excel?.profit ?? null,
    backendRevenue: backend.monthlyRevenue.toFixed(2),
    backendProfit: backend.monthlyProfit.toFixed(2),
    backendIrr: backend.irrByYears.find((r) => r.years === 4)?.irr?.toFixed(6) ?? backend.irr?.toFixed(6) ?? null,
    browserRevenue: browser.monthlyRevenue.toFixed(2),
    browserProfit: browser.monthlyProfit.toFixed(2),
    browserIrr: browser.irrByYears.find((r) => r.years === 4)?.irr?.toFixed(6) ?? browser.irr?.toFixed(6) ?? null,
    apiLocalRevenue: apiLocal.monthlyRevenue.toFixed(2),
    apiLocalProfit: apiLocal.monthlyProfit.toFixed(2),
    maxDiff: maxDiff.toString(),
    verdict,
    notes,
  };
  reportRows.push(row);
  expect(verdict, `${c.id} notes=${notes.join("; ")}`).toBe("PASS");
  return row;
}

describe("Phase 1：Browser Engine ↔ 后端引擎 ↔ Excel 一致性", () => {
  it.each(CONSISTENCY_CASES.map((c) => [c.id, c] as const))("%s", (_id, c) => {
    runCase(c);
  });

  it("输出汇总表（供汇报）", () => {
    expect(reportRows.length).toBe(CONSISTENCY_CASES.length);
    // 便于 vitest 输出可读报告
    // eslint-disable-next-line no-console
    console.log(
      "\n=== Phase 1 Golden Consistency Report ===\n" +
        [
          "Case | Excel营收 | Excel利润 | 后端营收 | 后端利润 | Browser营收 | Browser利润 | 后端IRR4 | BrowserIRR4 | maxDiff | 结论",
          ...reportRows.map(
            (r) =>
              `${r.name} | ${r.excelRevenue ?? "-"} | ${r.excelProfit ?? "-"} | ${r.backendRevenue} | ${r.backendProfit} | ${r.browserRevenue} | ${r.browserProfit} | ${r.backendIrr ?? "-"} | ${r.browserIrr ?? "-"} | ${r.maxDiff} | ${r.verdict}`,
          ),
        ].join("\n"),
    );
    expect(reportRows.every((r) => r.verdict === "PASS")).toBe(true);
  });

  it("浏览器核心无服务端依赖符号", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const root = path.resolve(__dirname, "..");
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const name of fs.readdirSync(dir)) {
        const full = path.join(dir, name);
        if (fs.statSync(full).isDirectory()) {
          if (name === "__tests__") continue;
          walk(full);
        } else if (name.endsWith(".ts")) {
          files.push(full);
        }
      }
    };
    walk(root);
    const banned = [/@prisma/, /from ["']fs["']/, /from ["']node:fs["']/, /from ["']path["']/, /DATABASE_URL/, /API_KEY/, /OPENAI/];
    for (const file of files) {
      const text = fs.readFileSync(file, "utf8");
      for (const re of banned) {
        expect(re.test(text), `${file} 命中禁止依赖 ${re}`).toBe(false);
      }
    }
  });
});
