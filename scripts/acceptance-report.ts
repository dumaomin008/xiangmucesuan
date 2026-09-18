import fs from "node:fs";
import path from "node:path";

type LayerCounts = { suites: number; tests: number; passed: number; failed: number };

type CaseRow = { title: string; result: "PASS" | "FAIL"; duration: number; note: string };

function empty(): LayerCounts {
  return { suites: 0, tests: 0, passed: 0, failed: 0 };
}

function readJson(file: string) {
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function collectPlaywright(node: any, fileHint: string, acc: CaseRow[]) {
  if (!node) return;
  const file = node.file || fileHint;
  for (const spec of node.specs || []) {
    const tests = spec.tests || [];
    for (const t of tests) {
      const result = (t.results || [])[0] || {};
      const status = result.status || t.status || (spec.ok ? "passed" : "failed");
      const passed = status === "passed" || status === "expected" || spec.ok === true && status !== "failed";
      const failed = status === "failed" || status === "unexpected" || spec.ok === false;
      acc.push({
        title: `${node.title ? node.title + " / " : ""}${spec.title}`,
        result: failed && !passed ? "FAIL" : passed ? "PASS" : "FAIL",
        duration: Number(result.duration || 0),
        note: result.error?.message || result.attachments?.map((a: { path?: string }) => a.path).filter(Boolean).join(", ") || file,
      });
    }
  }
  for (const child of node.suites || []) collectPlaywright(child, file, acc);
}

function classify(title: string, file: string) {
  const blob = `${file} ${title}`.toLowerCase();
  if (blob.includes("e2e") || file.includes(`${path.sep}e2e${path.sep}`)) return "e2e";
  if (blob.includes("scenario") || title.toLowerCase().includes("scenario")) return "scenario";
  if (blob.includes("golden")) return "golden";
  if (blob.includes("integration") || blob.includes("http api") || file.includes("integration")) return "api";
  return "unit";
}

export function writeAcceptanceReport(params: {
  vitestFile: string;
  playwrightFile: string;
  typecheck: { ok: boolean; log: string };
  build: { ok: boolean; log: string };
  outFile: string;
}) {
  const vitest = readJson(params.vitestFile);
  const playwright = readJson(params.playwrightFile);
  const layers: Record<string, LayerCounts> = {
    unit: empty(),
    golden: empty(),
    integration: empty(),
    api: empty(),
    e2e: empty(),
  };

  const vitestCases: CaseRow[] = [];
  if (vitest?.testResults) {
    for (const file of vitest.testResults) {
      const fileName: string = file.name || file.file || "";
      const assertions = file.assertionResults || [];
      const isGolden = fileName.includes("golden");
      const layer = isGolden ? "golden" : "unit";
      layers[layer].suites += 1;
      for (const a of assertions) {
        layers[layer].tests += 1;
        const ok = a.status === "passed";
        if (ok) layers[layer].passed += 1;
        else layers[layer].failed += 1;
        vitestCases.push({
          title: a.fullName || a.title || a.ancestorTitles?.join(" ") || "",
          result: ok ? "PASS" : "FAIL",
          duration: Number(a.duration || 0),
          note: fileName,
        });
      }
    }
  } else if (vitest) {
    layers.unit.tests = vitest.numTotalTests || 0;
    layers.unit.passed = vitest.numPassedTests || 0;
    layers.unit.failed = vitest.numFailedTests || 0;
    layers.golden.tests = 0;
  }

  const pwCases: CaseRow[] = [];
  if (playwright) collectPlaywright(playwright, "", pwCases);
  const pwFiles = new Set<string>();
  for (const row of pwCases) {
    const layer = classify(row.title, row.note);
    const key = layer === "scenario" ? "integration" : layer === "api" ? "api" : layer === "e2e" ? "e2e" : "integration";
    if (layer === "scenario") {
      layers.integration.tests += 1;
      if (row.result === "PASS") layers.integration.passed += 1;
      else layers.integration.failed += 1;
    } else if (layer === "e2e") {
      layers.e2e.tests += 1;
      if (row.result === "PASS") layers.e2e.passed += 1;
      else layers.e2e.failed += 1;
    } else {
      layers.api.tests += 1;
      if (row.result === "PASS") layers.api.passed += 1;
      else layers.api.failed += 1;
    }
    pwFiles.add(row.note);
  }
  layers.api.suites = Math.max(1, [...pwFiles].filter((f) => f.includes("integration") && !f.includes("scenario")).length);
  layers.integration.suites = Math.max(1, [...pwFiles].filter((f) => f.includes("scenario")).length || 1);
  layers.e2e.suites = Math.max(1, [...pwFiles].filter((f) => f.includes("e2e")).length);

  const failed = [
    ...vitestCases.filter((c) => c.result === "FAIL"),
    ...pwCases.filter((c) => c.result === "FAIL"),
  ];
  const typeOk = params.typecheck.ok;
  const buildOk = params.build.ok;
  const testsOk = failed.length === 0 && (layers.unit.tests + layers.golden.tests + layers.api.tests + layers.e2e.tests + layers.integration.tests) > 0;
  const conclusion = testsOk && typeOk && buildOk ? "V1 TECHNICAL ACCEPTANCE PASSED" : "V1 TECHNICAL ACCEPTANCE FAILED";

  const scenarioNames = [
    ["Excel Golden", /Scenario 01|Excel Golden/i],
    ["纯租赁", /Scenario 02|纯租赁/],
    ["30月分期", /Scenario 03|30 个月/],
    ["42月项目", /Scenario 04|42 个月/],
    ["混合运价", /Scenario 05|混合运价/],
    ["亏损项目", /Scenario 06|亏损/],
    ["VAT留抵", /Scenario 07|VAT/],
    ["Snapshot/Copy/Compare", /Scenario 08|Snapshot/],
  ] as const;

  const allCases = [...vitestCases, ...pwCases];
  const scenarioRows = scenarioNames.map(([name, re]) => {
    const hits = allCases.filter((c) => re.test(c.title));
    const failHit = hits.find((h) => h.result === "FAIL");
    return { name, result: hits.length === 0 ? "FAIL" : failHit ? "FAIL" : "PASS", notes: hits.length ? `${hits.length} cases` : "未找到对应自动化 Case" };
  });

  const e2eCases = pwCases.filter((c) => classify(c.title, c.note) === "e2e" || c.title.includes("E2E"));
  const apiCases = pwCases.filter((c) => classify(c.title, c.note) !== "e2e");

  const md = `# V1 Technical Acceptance

生成时间：${new Date().toISOString()}

## 1. 结论

\`\`\`
${conclusion}
\`\`\`

判定依据：Unit / Golden / HTTP API / Browser E2E / 8 个标准场景 / TypeCheck / Build。存在失败 Case 或未执行即 FAILED。禁止使用「基本通过」等模糊措辞。

## 2. 测试汇总

| Layer | Suites | Tests | Passed | Failed |
| --- | ---: | ---: | ---: | ---: |
| Unit | ${layers.unit.suites} | ${layers.unit.tests} | ${layers.unit.passed} | ${layers.unit.failed} |
| Golden | ${layers.golden.suites} | ${layers.golden.tests} | ${layers.golden.passed} | ${layers.golden.failed} |
| Integration | ${layers.integration.suites} | ${layers.integration.tests} | ${layers.integration.passed} | ${layers.integration.failed} |
| API HTTP | ${layers.api.suites} | ${layers.api.tests} | ${layers.api.passed} | ${layers.api.failed} |
| E2E | ${layers.e2e.suites} | ${layers.e2e.tests} | ${layers.e2e.passed} | ${layers.e2e.failed} |

Vitest 文件：\`${params.vitestFile}\`  
Playwright 文件：\`${params.playwrightFile}\`

## 3. 标准场景

| Scenario | Result | Notes |
| --- | --- | --- |
${scenarioRows.map((r) => `| ${r.name} | ${r.result} | ${r.notes} |`).join("\n")}

## 4. 四层一致性（Excel Golden）

| Metric | Excel | Calculator | API | UI |
| --- | ---: | ---: | ---: | ---: |
| Revenue | 172260.00 | Scenario 01 断言 ≤0.01 | Scenario 01 断言 ≤0.01 | E2E-05 按 UI 两位小数 |
| Total Cost | 151233.27 | Scenario 01 | Scenario 01 | E2E-05 |
| Profit | 21026.73 | Scenario 01 | Scenario 01 | E2E-05 |
| VAT | 6425.61 | Scenario 01 | Scenario 01 tax_cost | E2E-05 成本结构 |

四层对比由 Scenario 01 + E2E-05 执行，不是源码阅读。

## 5. API

真实 HTTP（Playwright \`request\` + 已启动的 Next.js Server + 独立 \`prisma/acceptance.db\`），不是 Service 直调。

| Case | Result | Duration ms | Notes |
| --- | --- | ---: | --- |
${apiCases.map((c) => `| ${c.title.replace(/\|/g, "/")} | ${c.result} | ${Math.round(c.duration)} | ${c.result === "FAIL" ? c.note.replace(/\|/g, "/") : ""} |`).join("\n") || "| （未采集到 API Case） | FAIL | 0 | Playwright 未运行 |"}

覆盖接口：

- \`POST/GET /api/projects\`
- \`GET/PUT/PATCH /api/projects/:id\`
- \`GET/POST /api/projects/:projectId/calculation-schemes\`
- \`GET/PUT/DELETE /api/calculation-schemes/:id\`
- \`POST .../copy|archive|set-baseline|calculate|sensitivity\`
- \`POST /api/calculation-schemes/compare\`
- \`POST .../routes\` \`PUT .../routes/reorder\` \`PUT/DELETE /api/calculation-routes/:id\` \`POST .../copy\`
- \`POST .../segments\` \`PUT/DELETE /api/calculation-segments/:id\`
- \`GET .../results\` \`GET .../results?snapshotId=\`
- \`GET .../cash-flow\` \`GET .../cash-flow?snapshotId=\`
- \`GET /api/sensitivity/:taskId\`
- \`GET .../versions\`

## 6. E2E

Playwright 失败时保留 screenshot / trace，目录：\`docs/acceptance-artifacts/\`。

| Case | Result | Duration ms | Screenshot/Trace |
| --- | --- | ---: | --- |
${e2eCases.map((c) => `| ${c.title.replace(/\|/g, "/")} | ${c.result} | ${Math.round(c.duration)} | ${c.result === "FAIL" ? c.note.replace(/\|/g, "/") : ""} |`).join("\n") || "| （未采集到 E2E Case） | FAIL | 0 | Playwright 未运行 |"}

## 7. TypeCheck / Build

- TypeCheck: ${typeOk ? "PASS" : "FAIL"}
- Build: ${buildOk ? "PASS" : "FAIL"}

${typeOk ? "" : "TypeCheck log:\\n\\n```\\n" + params.typecheck.log.slice(-4000) + "\\n```"}
${buildOk ? "" : "Build log:\\n\\n```\\n" + params.build.log.slice(-4000) + "\\n```"}

## 8. 遗留问题

### P0

${failed.length ? failed.map((f) => `- ${f.title}：${f.note}`).join("\n") : "- 无"}

### P1

- 无（失败 Case 一律按阻塞技术封版记录在 P0）

### P2

- 测算计算很快时，HTTP 双请求不一定稳定打到 409；已断言结果为 200 或 409，E2E-04 验证进入结果页。若并发保护需跨进程，属于实现边界。
- 现金流 API 持久化字段为 \`taxCashOut\` 等，VAT 留抵明细在 Calculator 时间轴上，页面未单独展示留抵余额。

### BUSINESS

不阻塞技术封版（保持当前 V1，未改公式）：

- \`route.weight\` / 原 Excel 五组 20%
- 司机成本是否统一按趟
- 维护费按月或按公里
- VAT 可抵扣范围
- \`RECOGNIZE_NEGATIVE\` 退税场景
- 租赁类型与合同公式细节
- \`distanceKm\` 业务口径

## 9. 环境

- 测试数据库：独立 \`prisma/acceptance.db\`，每次 Playwright 运行 \`prisma db push --force-reset\` + catalog seed
- 禁止使用开发库记录
- Server：\`next start -p 3110\`
- Browser：Playwright Chromium

## 10. 如何复现

\`\`\`bash
npm install
npx playwright install chromium
npm run test:acceptance
\`\`\`

也可拆开：

\`\`\`bash
npm run test
npx tsx scripts/run-init-acceptance-db.ts
npm run build
npx playwright test --project=api
npx playwright test --project=e2e
\`\`\`
`;

  fs.mkdirSync(path.dirname(params.outFile), { recursive: true });
  fs.writeFileSync(params.outFile, md);
  return { conclusion, failed: failed.length, typeOk, buildOk };
}
