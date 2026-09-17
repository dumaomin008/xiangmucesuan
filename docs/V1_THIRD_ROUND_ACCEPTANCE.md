# 项目测算 V1 第三轮验收报告

生成时间：2026-09-18  
范围：按《项目测算_V1第三轮现金流修复指令》只处理现金流、项目周期、租金周期、VAT 留抵及对应测试。未新增 AI/OCR/审批等 V2 能力，未改 Excel 已确认月度利润表公式。

## 修改结果

| ID | 问题 | 状态 | 修改文件 | 测试 Case | 说明 |
| --- | --- | --- | --- | --- | --- |
| P0-01 | 初始投资进入月现金流 | PASS | `src/lib/engine/cash-flow.ts` `excel-v5.ts` `investment.ts` `calculate.ts` 现金流页 | Golden CashFlow 01 | 明确 Month 0。累计从初始净现金流开始。首次转正定义为 previous < 0 且 current >= 0。Month 0 已 >= 0 时返回 0，不误判为 Month 1。未转正返回 null，UI 显示「测算期内未转正」。 |
| P0-02 | 非整年项目周期 | PASS | `cash-flow.ts` `excel-v5.ts` | Golden 02/03；12/18/24/30/36/42/54/60 | 经营判断改为 `monthIndex <= projectOperatingMonths`。18/30/42/54 不再被截成 12/24/36/48。年运营月数仍按 `monthInYear <= operatingMonthsYear` 生效。 |
| P0-03 | 尾期租金不重复计提 | PASS | `cash-flow.ts`（删除年度 residual `% 12`） | Golden 04/05；分期 1/6/12/18/24/30/36/42/54/60 | 租金按 `monthIndex <= installmentMonths` 逐月判断，年度由月度 SUM。30 个月：12+12+6+0+0。42 个月：12+12+12+6+0。 |
| P1-01 | VAT 留抵现金流 | PASS | `src/lib/engine/tax.ts` `cash-flow.ts` | Golden CashFlow 06 | `negativeVatHandling` 真正进入现金流。默认 CARRY_FORWARD：进项超过销项形成留抵，当月 `vatCashOut = 0`，不记现金流入。RECOGNIZE_NEGATIVE 表示当月差额全部入现金流（视同退税）。 |

## 口径统一

```
参数快照
→ Month 0 初始投资
→ Month 1~N 月度现金流
→ 按月聚合年度现金流
→ IRR / 累计现金流 / 投资回收期
```

- Year 0 = Month 0
- Year N = SUM(Month (N-1)×12+1 ~ N×12)
- 30 个月项目：Year 3 = SUM(Month 25~30)，不再把 Year 3 判无效
- IRR 序列包含 Year 0，禁止从 Month 1 / Year 1 起算
- 月度利润表 AC39–AC62 未改

## 自动化测试结果

- Test Suites：14 passed / 14
- Tests：124 passed / 124
- Failed：0
- Duration：645ms
- Type Check：`tsc --noEmit` 通过
- Lint：通过（方案列表页既有 `useEffect` 依赖告警，本轮未改）
- Build：`next build` 通过

## 第三轮 Golden Cases（手算 expected，禁止 Calculator 对 Calculator）

| Case | 输入 | Expected | Result |
| --- | --- | --- | --- |
| CashFlow 01 | Month0=-1,800,000；Month1~24=+100,000 | Month17 累计=-100,000；Month18 累计=0；firstPositiveMonth=18 | PASS |
| CashFlow 02 | projectOperatingMonths=30 | Month1~30 存在；Month31 停止经营；Year3 含 Month25~30 | PASS |
| CashFlow 03 | projectOperatingMonths=18 | Year1=Month1~12；Year2=Month13~18 | PASS |
| CashFlow 04 | installmentMonths=30，月租 13,900×2 车 | Year1=333,600；Year2=333,600；Year3=166,800；Year4=0；Year5=0 | PASS |
| CashFlow 05 | installmentMonths=42 | 12+12+12+6，后续 0 | PASS |
| CashFlow 06 | Month1 销项 50,000 / 进项 80,000 | vatCashOut=0；closingCredit=30,000 | PASS |
| CashFlow 06 | Month2 销项 70,000 / 进项 20,000 / 期初 30,000 | vatCashOut=20,000；closingCredit=0 | PASS |

## 第二轮回归

| 标准 | 结果 |
| --- | --- |
| Excel 示例 AC39–AC62 | PASS，误差 ≤ 0.01 元，利润表公式未改 |
| 元/吨、元/趟、元/吨公里 | PASS |
| 空载 | PASS |
| 管理费边界 | PASS |
| 多路段成本分摊 | PASS |
| 司机成本覆盖 | PASS |
| 利润率除零 | PASS |
| IRR 异常 | PASS，无 NaN / Infinity / #NUM! |
| 敏感性 0% | PASS，与 baseline 完全一致 |
| Snapshot 不可变 | PASS，同一输入两次计算一致 |

## 页面回归

现金流页：

- Month 0 显示为「0期 / 初始投入」
- 指标卡：初始投资、累计现金流、首次转正月份
- 累计现金流包含 Month 0
- 图表从 0 期开始
- 未转正文案：测算期内未转正
- 结果页 / 对比页：`firstPositiveMonth === 0` 不再被当成空值

## 未解决问题

| 问题 | 原因 | 影响 | 建议 | 是否阻塞 V1 |
| --- | --- | --- | --- | --- |
| 完整用户链路未做浏览器点击验收 | 本轮以引擎黄金样本、边界测试和 build 为主 | 交互回归需产品走一遍 | 手工走：建项目 → 方案 → 测算 → 现金流看 0 期与转正月份 → 敏感性 0% | 否 |
| 纯租赁无首付时 firstPositiveMonth=0 | Month 0 净现金流为 0，按规范「已 >= 0 不得返回 Month 1」 | UI 显示「0期 / 初始投入已非负」 | 产品确认该文案是否接受 | 否 |
| 方案列表页 lint warning | 既有 `useEffect` 依赖 | 不影响测算 | 下轮顺手修 | 否 |
| 路段宽表未逐字段打来源标签 | 第二轮遗留 | 来源靠模块说明 | V1.1 | 否 |

## Definition of Done

| 条件 | 结果 |
| --- | --- |
| Month 0 初始投资进入现金流 | PASS |
| 累计现金流包含初始投资 | PASS |
| 首次转正月份计算正确 | PASS |
| 18/30/42/54 月项目周期正确 | PASS |
| 30/42/54 月分期租金不重复 | PASS |
| VAT CARRY_FORWARD 正确 | PASS |
| VAT 负值不默认形成现金流入 | PASS |
| 年度/月度现金流口径一致 | PASS |
| IRR 包含初始投资 | PASS |
| 独立手算 Golden Case 通过 | PASS |
| 第二轮 Excel Golden 回归通过 | PASS |
| Snapshot 回归通过 | PASS |
| Sensitivity 回归通过 | PASS |
| Type Check 通过 | PASS |
| Test 通过 | PASS |
| Build 通过 | PASS |
| 输出本报告 | PASS |

本轮完成后停止继续开发，等待产品第三轮验收。
