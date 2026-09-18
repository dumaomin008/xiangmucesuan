# V1 Technical Acceptance

生成时间：2026-09-18T01:10:01.932Z

## 1. 结论

```
V1 TECHNICAL ACCEPTANCE PASSED
```

判定依据：Unit / Golden / HTTP API / Browser E2E / 8 个标准场景 / TypeCheck / Build。存在失败 Case 或未执行即 FAILED。禁止使用「基本通过」等模糊措辞。

## 2. 测试汇总

| Layer | Suites | Tests | Passed | Failed |
| --- | ---: | ---: | ---: | ---: |
| Unit | 15 | 128 | 128 | 0 |
| Golden | 1 | 19 | 19 | 0 |
| Integration | 1 | 8 | 8 | 0 |
| API HTTP | 1 | 9 | 9 | 0 |
| E2E | 3 | 10 | 10 | 0 |

Vitest 文件：`/Users/dmm/Desktop/项目测算/docs/acceptance-artifacts/vitest.json`  
Playwright 文件：`/Users/dmm/Desktop/项目测算/docs/acceptance-artifacts/playwright.json`

## 3. 标准场景

| Scenario | Result | Notes |
| --- | --- | --- |
| Excel Golden | PASS | 1 cases |
| 纯租赁 | PASS | 10 cases |
| 30月分期 | PASS | 1 cases |
| 42月项目 | PASS | 1 cases |
| 混合运价 | PASS | 1 cases |
| 亏损项目 | PASS | 1 cases |
| VAT留抵 | PASS | 6 cases |
| Snapshot/Copy/Compare | PASS | 2 cases |

## 4. 四层一致性（Excel Golden）

| Metric | Excel | Calculator | API | UI |
| --- | ---: | ---: | ---: | ---: |
| Revenue | 172260.00 | Scenario 01 断言 ≤0.01 | Scenario 01 断言 ≤0.01 | E2E-05 按 UI 两位小数 |
| Total Cost | 151233.27 | Scenario 01 | Scenario 01 | E2E-05 |
| Profit | 21026.73 | Scenario 01 | Scenario 01 | E2E-05 |
| VAT | 6425.61 | Scenario 01 | Scenario 01 tax_cost | E2E-05 成本结构 |

四层对比由 Scenario 01 + E2E-05 执行，不是源码阅读。

## 5. API

真实 HTTP（Playwright `request` + 已启动的 Next.js Server + 独立 `prisma/acceptance.db`），不是 Service 直调。

| Case | Result | Duration ms | Notes |
| --- | --- | ---: | --- |
| HTTP API · Projects / POST/GET/PUT 正常路径 | PASS | 72 |  |
| HTTP API · Projects / 缺字段 / 非法 JSON / 不存在 ID | PASS | 12 |  |
| HTTP API · Calculation Schemes / CRUD / copy / archive / baseline / compare / 仅草稿可删 | PASS | 192 |  |
| HTTP API · Calculation Schemes / 不存在方案 | PASS | 4 |  |
| HTTP API · Routes / Segments / Create/Update/Delete/Copy/Reorder 与跨方案/负数 | PASS | 54 |  |
| HTTP API · Calculate / Results / CashFlow / 正常测算 + 历史 snapshotId | PASS | 76 |  |
| HTTP API · Calculate / Results / CashFlow / 无启用路段 / 负运价 / 不存在方案 / 重复请求 | PASS | 61 |  |
| HTTP API · Sensitivity / -10% / 0% / +10%，0% 等于 baseline | PASS | 54 |  |
| HTTP API · 错误体 / 错误响应含 code/message，且不是 200 | PASS | 5 |  |
| 标准业务场景 / Scenario 01 Excel Golden：Calculator 与 API 对齐 Excel | PASS | 54 |  |
| 标准业务场景 / Scenario 02 纯租赁：initialInvestment=0，展示无需回收初始投资 | PASS | 44 |  |
| 标准业务场景 / Scenario 03 非纯租赁 + 30 个月分期 | PASS | 49 |  |
| 标准业务场景 / Scenario 04 42 个月项目不得截断到 36，第 5 年无租金 | PASS | 53 |  |
| 标准业务场景 / Scenario 05 多路段混合运价：多计价口径，收入守恒 | PASS | 41 |  |
| 标准业务场景 / Scenario 06 亏损项目：负利润、利润率、IRR 原因、无 NaN | PASS | 57 |  |
| 标准业务场景 / Scenario 07 VAT 留抵：Calculator 两月 Case 与 API 留抵口径 | PASS | 50 |  |
| 标准业务场景 / Scenario 08 Snapshot / Copy / Compare / DB 一致性 | PASS | 152 |  |

覆盖接口：

- `POST/GET /api/projects`
- `GET/PUT/PATCH /api/projects/:id`
- `GET/POST /api/projects/:projectId/calculation-schemes`
- `GET/PUT/DELETE /api/calculation-schemes/:id`
- `POST .../copy|archive|set-baseline|calculate|sensitivity`
- `POST /api/calculation-schemes/compare`
- `POST .../routes` `PUT .../routes/reorder` `PUT/DELETE /api/calculation-routes/:id` `POST .../copy`
- `POST .../segments` `PUT/DELETE /api/calculation-segments/:id`
- `GET .../results` `GET .../results?snapshotId=`
- `GET .../cash-flow` `GET .../cash-flow?snapshotId=`
- `GET /api/sensitivity/:taskId`
- `GET .../versions`

## 6. E2E

Playwright 失败时保留 screenshot / trace，目录：`docs/acceptance-artifacts/`。

| Case | Result | Duration ms | Screenshot/Trace |
| --- | --- | ---: | --- |
| E2E-01 完整新建测算 / 从项目列表走到结果页 | PASS | 1408 |  |
| E2E-02 刷新恢复 / debounce 保存后刷新参数仍在 | PASS | 1273 |  |
| E2E-03 输入错误 / 负运价无法进入正式测算并给出字段错误 | PASS | 740 |  |
| E2E-04 防重复提交 / 测算中按钮 disabled/loading | PASS | 1155 |  |
| E2E-05 结果页与 Golden 四层一致性 / 结果页 KPI 与 API / Excel 一致 | PASS | 243 |  |
| E2E-06 现金流 / 纯租赁显示无需回收初始投资，并有 0 期/月度/年度 | PASS | 242 |  |
| E2E-07 敏感性 / 执行 -10/0/+10，页面有结果且 0% 为基线 | PASS | 313 |  |
| E2E-08 方案复制和对比 / 复制后改运价再测算，对比结果不同且不串数据 | PASS | 642 |  |
| E2E-09 基准方案 / 后设基准的方案成为唯一基准 | PASS | 282 |  |
| E2E-10 历史版本 / 打开 A1 结果保持原值且不同于 A2 | PASS | 320 |  |

## 7. TypeCheck / Build

- TypeCheck: PASS
- Build: PASS




## 8. 遗留问题

### P0

- 无

### P1

- 无（失败 Case 一律按阻塞技术封版记录在 P0）

### P2

- 测算计算很快时，HTTP 双请求不一定稳定打到 409；已断言结果为 200 或 409，E2E-04 验证进入结果页。若并发保护需跨进程，属于实现边界。
- 现金流 API 持久化字段为 `taxCashOut` 等，VAT 留抵明细在 Calculator 时间轴上，页面未单独展示留抵余额。

### BUSINESS

不阻塞技术封版（保持当前 V1，未改公式）：

- `route.weight` / 原 Excel 五组 20%
- 司机成本是否统一按趟
- 维护费按月或按公里
- VAT 可抵扣范围
- `RECOGNIZE_NEGATIVE` 退税场景
- 租赁类型与合同公式细节
- `distanceKm` 业务口径

## 9. 环境

- 测试数据库：独立 `prisma/acceptance.db`，每次 Playwright 运行 `prisma db push --force-reset` + catalog seed
- 禁止使用开发库记录
- Server：`next start -p 3110`
- Browser：Playwright Chromium

## 10. 如何复现

```bash
npm install
npx playwright install chromium
npm run test:acceptance
```

也可拆开：

```bash
npm run test
npx tsx scripts/run-init-acceptance-db.ts
npm run build
npx playwright test --project=api
npx playwright test --project=e2e
```
