# 项目测算 V1 第二轮验收报告

生成时间：2026-09-18  
范围：按《项目测算_V1验收问题清单_Cursor第二轮修改指令》全量修复，未新增 AI/OCR/审批等 V2 能力。

## 修改结果

| ID | 问题 | 状态 | 修改文件 | 说明 |
| --- | --- | --- | --- | --- |
| P0-01 | 运价单位进入正式计算 | PASS | `src/lib/engine/revenue.ts` `src/lib/engine/excel-v5.ts` | 正式收入走 `calcSegmentRevenue`。元/吨、元/趟、元/吨公里公式进入 RuleEngine。空载时元/吨与元/吨公里收入为 0，元/趟保留收入，成本仍产生。 |
| P0-02 | 年运营月数层级统一 | PASS | `prisma/schema.prisma` `excel-v5.ts` `validate.ts` 向导页 | 方案级 `finance.operatingMonthsYear` 为正式计算唯一来源。界面区分年运营月数 / 项目经营月数 / 测算年限。路段不一致时告警并按方案级统一。 |
| P1-01 | 路段编辑 debounce | PASS | `src/app/projects/.../page.tsx` | 输入先写本地 state，debounce 800ms + blur 双保险保存。状态：正在保存... / 已自动保存 / 保存失败，请重试。 |
| P1-02 | Excel 黄金样本 | PASS | `tests/golden/golden.test.ts` | 覆盖单路段、多路段分摊、空载能耗、管理费边界、非纯租赁、长周期现金流。金额误差 ≤ 0.01 元。 |
| P1-03 | 司机成本层级 | PASS | `variable-cost.ts` `excel-v5.ts` `trace.ts` | PER_TRIP 时路段有值用覆盖值，否则用方案默认。解释写明「路段覆盖值」或「方案默认值」。 |
| P1-04 | 禁止混合运价平均 | PASS | `revenue.ts` 结果页 / 对比 API | 单位一致显示平均运价；不一致显示「多计价口径」并分口径展示。 |
| P1-05 | IRR 异常处理 | PASS | `investment.ts` `reasons.ts` 结果/现金流页 | 无正负号变化：`IRR_NO_SIGN_CHANGE`；不收敛：`IRR_NOT_CONVERGED`。UI 显示「无法计算」并解释。不出现 NaN / Infinity / #NUM!。 |
| P1-06 | 利润率除零 | PASS | `profit.ts` `reasons.ts` | `revenue=0` → `profitMargin=null`，`profitMarginReason=REVENUE_ZERO`。UI 文案：当前方案营收为0，因此利润率无法计算。 |
| P1-07 | VAT 配置化 | PASS | `rule-engine.ts` `tax.ts` `seed.ts` | 9%/13%/6% 收入 RuleSet.vatRates，不再散落在 Calculator。规则码 `VAT_RATES`。 |
| 快照冻结 | 正式测算不可变快照 | PASS | `src/lib/services/scheme.ts` | 每次测算新建 Snapshot Vn + Result，不再删除历史结果。结果绑定 snapshotId + ruleVersion。 |
| 可解释 | 公式可追溯 | PASS | `trace.ts` `calculate.ts` | 核心指标含 resultCode/公式/规则版本/参数快照。能源成本展示 `车辆数 × 电价 × 能耗 × 里程 × 趟数`。 |
| 敏感性 | 完整重算 | PASS | `sensitivity.ts` + golden | `clone → override → calculateScheme()`。0% 与 baseline 完全一致。覆盖运价/电价/月趟数/月租/满载能耗。 |
| P2-01 | 结果可视化 | PASS | 结果页、现金流页 | 成本构成、线路利润贡献柱状图；现金流趋势图已有。 |
| P2-02 | 参数来源标签 | PARTIAL | Field / 结果页 | 已支持公司标准、项目填写、路段填写、系统计算、人工覆盖。路段宽表未给每个单元格单独打标。 |

## 自动化测试结果

- Test Suites：13 passed / 13
- Tests：88 passed / 88
- Failed：0
- Duration：758ms
- Type Check：`tsc --noEmit` 通过
- Lint：通过（方案列表页既有 `useEffect` 依赖告警，本轮未改）
- Build：`next build` 通过

## 黄金样本

对照原表「示例」AC39–AC62 缓存值，系统金额误差 ≤ 0.01 元。

| 指标 | Excel | System | Difference | Result |
| --- | ---: | ---: | ---: | --- |
| 月营收 | 172260.00 | 172260.00 | 0.00 | PASS |
| 月成本 | 151233.27 | 151233.27 | ≤ 0.01 | PASS |
| 月利润 | 21026.73 | 21026.73 | ≤ 0.01 | PASS |
| VAT | 6425.61 | 6425.61 | ≤ 0.01 | PASS |
| IRR | 无正负号变化 | null / IRR_NO_SIGN_CHANGE | — | PASS |

分摊权重验证：`360×9 / 206×9 / 550×9 = 3240 / 1854 / 4950`，固定成本按该权重分摊，不按路段数平均。

## 未解决问题

| 问题 | 原因 | 影响 | 建议 | 是否阻塞 V1 |
| --- | --- | --- | --- | --- |
| 完整用户链路未做浏览器点击验收 | 本轮以引擎黄金样本、边界测试和 build 为主 | 交互回归需产品走一遍 | 手工走：建项目 → 方案 → 路段输入 360 → 测算 → 解释 → 现金流 → 敏感性 0% → 复制 → 对比 → 设基准 | 否 |
| 存量方案 `operatingMonthsYear` 为空 | 新字段，旧数据未回填 | 计算回退到第一条路段年运营月数 | 打开方案后在基础信息保存一次即可写入方案级值 | 否 |
| 存量库没有 `VAT_RATES` 规则行 | 需重新 seed 才会写入规则表 | 运行时回退 `DEFAULT_RULE_SET.vatRates`，口径不变 | 需要改税率时执行 seed 或在规则管理中补版本 | 否 |
| 路段宽表未逐字段打来源标签 | 表格密度高 | 来源靠模块说明，不是每格徽章 | V1.1 可在字段 focus 时显示来源 | 否 |
| 方案列表页 lint warning | 既有 `useEffect` 依赖 | 不影响测算 | 下轮顺手修 | 否 |

## 验收标准对照

| 标准 | 结果 |
| --- | --- |
| A. 计算正确 | PASS，黄金样本对齐 Excel |
| B. 边界正确 | PASS，空载/计价单位/管理费/IRR 均有测试 |
| C. 结果稳定 | PASS，输出中无 NaN / Infinity / #DIV/0! / #NUM! |
| D. 可解释 | PASS，核心指标可点开公式与参数 |
| E. 可复算 | PASS，同一 Snapshot + Rule Version 两次计算一致 |
| F. 可版本化 | PASS，新测算生成新快照，历史结果不再被删除覆盖 |

本轮完成后停止继续加功能，等待产品验收。
