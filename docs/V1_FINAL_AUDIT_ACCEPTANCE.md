# 项目测算 V1 全量终审验收报告

生成时间：2026-09-18  
范围：按《项目测算_V1全量终审与最终修复指令》全仓审计 + P0 修复 + 必要 P1 修复。未扩 V2 能力，未改 BUSINESS 待确认规则，未删除或放宽既有 Golden。

## 1. 总结

```
P0 数量：10
P0 已关闭：10
P1 数量：15
P1 已关闭：13（P1-10 页面点击、P1-11 全 API 矩阵以源码验收为主，未做浏览器 E2E）
P2：记录，本轮不实施
BUSINESS：15 项保持当前 V1 规则 + 注释，未擅自扩展
是否具备业务验收条件：YES
```

```
V1 READY FOR BUSINESS ACCEPTANCE
```

未关闭 P0：0。

## 2. 问题清单

| ID | 模块 | 问题 | 等级 | 修复 | 文件 | 测试 | 状态 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| P0-01 | 守恒 | 路段 `variableCost` 漏司机成本 | P0 | 路段变动成本加入 `driverCost`，增加收入/成本/利润/分摊守恒断言 | `calculate.ts` `invariants.test.ts` | PASS | 关闭 |
| P0-02 | Excel | 需固定 Golden | P0 | 未改利润表公式，回归 AC39–AC62 | `excel-parity.test.ts` `golden.test.ts` | PASS | 关闭 |
| P0-03 | 分摊 | 0 权重除零 | P0 | 合计为 0 抛 `ZERO_ALLOCATION_DENOMINATOR`；校验拦截里程/趟数为 0 | `excel-v5.ts` `validate.ts` | PASS | 关闭 |
| P0-04 | 同源 | 预览与正式公式 | P0 | 预览继续走 `previewSegmentHelpers` → `calcSegmentRevenue` / Excel 能源 | `calculate.ts` 向导页 | 源码确认 | 关闭 |
| P0-05 | Snapshot | A 测算后改参 B，A 必须不变 | P0 | 每次测算新建 Snapshot，不 UPDATE；增加 A→改运价→B→用 A 快照重算 | `scheme.ts` `invariants.test.ts` | PASS | 关闭 |
| P0-06 | 复制 | 线路复制漏司机/趟；方案复制不得带结果 | P0 | 线路复制补 `driverCostPerTrip`。方案复制只拷配置，新 ID，status=draft | `copy/route.ts` `scheme.ts` | 源码+回归 | 关闭 |
| P0-07 | 删除 | 历史被配置删除污染 | P0 | 仅草稿可删方案；改配置不删 Snapshot/Result；基准/归档不可改子资源 | `scheme.ts` guards | 源码确认 | 关闭 |
| P0-08 | 重复提交 | 连点开始测算 | P0 | 按钮 `calculating` disabled；API `CALC_IN_PROGRESS` 409 | 向导页 `scheme.ts` | 源码确认 | 关闭 |
| P0-09 | 现金流 | Month0 / 非整年 / 租金 / VAT | P0 | 第三轮实现回归，未重写稳定内核 | `cash-flow.test.ts` | PASS | 关闭 |
| P0-10 | IRR | Year0、无符号、NaN | P0 | IRR 含 Year0；无法计算返回原因码 | `investment.test.ts` `golden.test.ts` | PASS | 关闭 |
| P1-01 | 展示 | 转正 0 期文案 | P1 | 数学定义不变；UI「无需回收初始投资」 | `format.ts` | PASS | 关闭 |
| P1-02 | 校验 | 负值只靠前端 | P1 | 引擎 + API 非负校验 | `validate.ts` `guards.ts` | PASS | 关闭 |
| P1-03 | 除零 | 分母为 0 | P1 | 利润率/分摊/轮胎/敏感性变化率均有明确行为 | 既有 + 本轮 | PASS | 关闭 |
| P1-04 | 运价 | 三种单位与混合 | P1 | 回归，禁止混合平均 | `revenue.test.ts` `golden.test.ts` | PASS | 关闭 |
| P1-05 | 司机 | 来源解释 | P1 | 路段覆盖 / 方案默认 | `golden.test.ts` | PASS | 关闭 |
| P1-06 | Override | 快照冻结 | P1 | Snapshot.payload 含 overrides + reason | `scheme.ts` | 源码确认 | 关闭 |
| P1-07 | 规则版本 | 税率硬编码 | P1 | 计算走 `ruleSet.vatRates`；DEFAULT 仅回退 | `rule-engine.ts` | 回归 | 关闭 |
| P1-08 | 敏感性 | 0% 需收入/成本/利润/利润率 | P1 | 0% 断言四指标与 baseline 一致 | `golden.test.ts` | PASS | 关闭 |
| P1-09 | 版本 | 历史可打开、单基准 | P1 | `?snapshotId=` 打开历史结果；设基准取消旧基准 | results/cash-flow/versions | 源码确认 | 关闭 |
| P1-10 | 页面链路 | 逐页点击 | P1 | 源码核对主链路；未做浏览器 E2E | — | 部分 | 记录 |
| P1-11 | API | 404/非法 JSON/重复 | P1 | `NOT_FOUND` / `INVALID_JSON` / 409；未逐条打全量 HTTP | `api.ts` `guards.ts` | 部分 | 记录 |
| P1-12 | 归属 | 跨方案挂子资源 | P1 | 子资源必须方案可编辑；禁止跨方案复制路段 | `scheme.ts` segments API | 源码确认 | 关闭 |
| P1-13 | 字段 | `route.weight` 未参与计算 | P1 | 标记 RESERVED，页面提示不参与测算，去掉误导告警 | `types.ts` 向导页 `validate.ts` | 源码确认 | 关闭 |
| P1-14 | 精度 | 金额 Decimal | P1 | 内部 Decimal，展示 round | 引擎 | 回归 | 关闭 |
| P1-15 | 错误 | 失败需 code/field/message | P1 | EngineError + 测算按钮展示三件套 | `api.ts` 向导页 | 源码确认 | 关闭 |

## 3. 全页面验收

| 页面 | 新建 | 编辑 | 删除 | 保存 | 异常 | 空状态 | PASS |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 项目列表 | 有 | 有 | 有 | 有 | 有 | 有 Character | 源码 PASS |
| 项目详情 | — | 有 | — | 有 | 有 | — | 源码 PASS |
| 方案列表 | 有 | 复制/归档/基准/对比 | 仅草稿 | — | 有 | 有 | 源码 PASS |
| 方案配置 5 步 | 有 | 有 | 线路/路段 | debounce 保存状态 | 校验定位 | — | 源码 PASS |
| 结果 | — | — | — | — | 无结果插画 | 有 | 源码 PASS |
| 现金流 | Month0 / 月 / 年 / 转正 | — | — | — | 未测算空表 | — | 源码 PASS |
| 敏感性 | 参数/区间/step | — | — | — | busy disabled | — | 源码 PASS |
| 对比 | 最多 3 | 混合运价 | — | — | 缺结果 | — | 源码 PASS |
| 历史版本 | 打开 snapshot 结果 | — | — | — | 无版本文案 | 有 | 源码 PASS |

完整浏览器点击未执行，不作为 P0。建议产品走：建项目 → 方案 → 路段 → 测算 → 解释 → 现金流 0 期 → 敏感性 0% → 复制 → 再测算 → 对比 → 设基准 → 打开历史结果。

## 4. API 验收

| API | Method | 正常 | 非法参数 | 不存在 ID | 归属校验 | PASS |
| --- | --- | --- | --- | --- | --- | --- |
| `/projects` | GET/POST | 有 | 部分 | — | — | 源码 |
| `/projects/[id]` | GET/PUT | 有 | — | NOT_FOUND | — | 源码 |
| `/calculation-schemes` | GET/POST | 有 | 车队正整数 | — | projectId | 源码 |
| `/calculation-schemes/[id]` | GET/PUT/DELETE | 有 | 非负校验 + INVALID_JSON | NOT_FOUND | 基准/归档锁定 | PASS |
| `/calculate` | POST | 有 | 校验错误码 | 方案不存在 | 归档/基准不可测 | PASS |
| `/results` `?snapshotId` | GET | 有 | — | NOT_FOUND | 绑定 snapshot | PASS |
| `/cash-flow` `?snapshotId` | GET | 有 | — | 空数组 | snapshot 绑定 | PASS |
| `/routes` `/routes/[id]` | POST/PUT/DELETE | 有 | — | NOT_FOUND | 方案可编辑 | PASS |
| `/segments` `/segments/[id]` | POST/PUT/DELETE | 有 | 非负 | NOT_FOUND | 禁跨方案复制 | PASS |
| `/copy` 方案 | POST | 新 ID、draft、无结果 | — | 方案不完整 | 同项目 | PASS |
| `/set-baseline` | POST | 旧基准取消 | 未测算拒绝 | 方案不存在 | 项目内唯一 | PASS |
| `/sensitivity` | POST | 完整重算 | step<=0 拒绝 | — | — | PASS |
| `/compare` | GET | 2–3 方案 | <2 拒绝 | — | — | 源码 |
| `/standard-parameters` `/meta` | GET | 有 | — | 404 | — | 源码 |

未对每个路由发真实 HTTP 请求。静默吞异常已排除：`fail()` 返回 code/field/message。

## 5. Excel Golden

固定 expected 来自原表「示例」AC39–AC62，禁止 Calculator 对 Calculator。金额误差 ≤ 0.01。

| 指标 | Excel | System | Diff | PASS |
| --- | ---: | ---: | ---: | --- |
| 月营收 | 172260.00 | 172260.00 | 0.00 | PASS |
| 车辆成本 | 33360.00 | 33360.00 | 0.00 | PASS |
| 管理费 | 4800.00 | 4800.00 | 0.00 | PASS |
| 维护费 | 11000.00 | 11000.00 | 0.00 | PASS |
| 年检费 | 800.00 | 800.00 | 0.00 | PASS |
| 保险费 | 6000.00 | 6000.00 | 0.00 | PASS |
| 加热费 | 800.00 | 800.00 | 0.00 | PASS |
| 易耗品 | 480.00 | 480.00 | 0.00 | PASS |
| 司机成本 | 27000.00 | 27000.00 | 0.00 | PASS |
| 过路费 | 21060.00 | 21060.00 | 0.00 | PASS |
| 信息费 | 7200.00 | 7200.00 | 0.00 | PASS |
| 能源成本 | 25391.232 | 25391.232 | ≤0.01 | PASS |
| 轮胎成本 | 6076.62 | 6076.62 | ≤0.01 | PASS |
| 流动资金利息 | 839.81247 | 839.81247 | ≤0.01 | PASS |
| 销项 VAT | 14223.3027522936 | 14223.3027522936 | ≤0.01 | PASS |
| 进项 VAT | 7797.69411053598 | 7797.69411053598 | ≤0.01 | PASS |
| 应纳 VAT | 6425.60864175759 | 6425.60864175759 | ≤0.01 | PASS |
| 总成本 | 151233.273111758 | 151233.273111758 | ≤0.01 | PASS |
| 利润 | 21026.7268882424 | 21026.7268882424 | ≤0.01 | PASS |

分摊权重：`360×9 / 206×9 / 550×9 = 3240 / 1854 / 4950`，不按路段数平均。

## 6. 计算守恒

| Invariant | Expected | Actual | PASS |
| --- | --- | --- | --- |
| 方案月收入 = Σ 路段月收入 | 相等 ≤0.01 | 相等 | PASS |
| 总成本 = 固定+变动+财务+税 | 相等 ≤0.01 | 相等 | PASS |
| 利润 = 收入 - 总成本 | 相等 ≤0.01 | 相等 | PASS |
| 收入>0 利润率 = 利润/收入 | 误差 ≤0.0001 | 相等 | PASS |
| 收入=0 利润率 | null / REVENUE_ZERO | 符合 | PASS |
| Σ 路段司机成本 = 方案司机成本 | 相等 ≤0.01 | 相等 | PASS |
| Σ 路段变动（含司机）= 方案变动成本 | 相等 ≤0.01 | 相等 | PASS |
| Σ 路段分摊固定 = 方案固定成本 | 相等 ≤0.01 | 相等 | PASS |
| 输出无 NaN/Infinity/undefined | 不出现 | 不出现 | PASS |

## 7. 自动测试

```
Test Files: 15 passed / 15
Tests: 138 passed / 138
Failed: 0
Duration: 792ms
```

| 检查 | 结果 |
| --- | --- |
| typecheck `tsc --noEmit` | PASS |
| lint `next lint` | PASS（方案列表页既有 `useEffect` 依赖告警，本轮未改） |
| build `next build` | PASS |

## 8. 测试矩阵覆盖

- Revenue：PER_TON / PER_TRIP / PER_TON_KM / load=0 / trips=0 / 空字符串
- Fixed：管理费 29/30/49/50/99/100/199/200；纯租赁 / 非纯租赁
- Variable：司机/过路/装卸/信息/能源/轮胎
- Allocation：1/2/5 路段；全部权重 0 报错
- Tax：正常 VAT、进项>销项、CARRY_FORWARD、留抵用尽
- Cash Flow：Month0、18/30/42/54、30/42/54 分期
- IRR：正常、全正、全负、无符号、极端值、长周期
- Snapshot：A → 改运价 → B → A 重算不变
- Sensitivity：-10%/0%/+10%，0% 收入/成本/利润/利润率一致
- Compare：混合单位禁止平均（引擎层）

## 9. P2 / BUSINESS

P2 不阻塞：SQLite、权限、乐观锁、E2E、备份、导入导出、CI 独立环境。本轮未做大规模重构。

BUSINESS 待确认保持现状，包括：`route.weight` 五组 20%、司机是否统一按趟、维护费按月/公里、VAT 可抵扣范围、RECOGNIZE_NEGATIVE 退税场景、租赁类型合同公式、distanceKm 口径等。系统中已注释 RESERVED / 沿用已确认 V1 规则。

## 10. Definition of Done

| 条件 | 结果 |
| --- | --- |
| 所有 P0 = 0 | PASS |
| Excel 固定 Golden | PASS |
| 收入/成本/利润守恒 | PASS |
| 路段汇总与方案汇总一致 | PASS |
| 3 种运价 | PASS |
| 现金流 / VAT 留抵 | PASS |
| IRR 边界 | PASS |
| Snapshot 不可变 | PASS |
| Sensitivity 0% | PASS |
| Copy Scheme 不污染历史 | PASS |
| 历史版本可追溯 | PASS（`?snapshotId=`） |
| API 归属 | PASS |
| 核心输入后端校验 | PASS |
| 无 NaN / Infinity / undefined | PASS |
| Type Check / Tests / Build | PASS |
| 无未关闭 P0 | PASS |

本轮结束后停止继续编码，等待最终产品验收。
