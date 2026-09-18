# 项目测算系统 AI 业务助手——领导演示前终审整改指令 V1.0

> 基于最新提交 `d0440417c0ab1d917b46fb291851db52e6c128da` 做最后一轮小范围整改与验收。
> 核心原则：不重构稳定主链路，不修改 Calculation Engine 公式，不让 AI 直接计算核心 KPI。

## 1. 开发前先审计

重点检查：
- `src/demo/ai/assistant.ts`
- `src/demo/ai/tools.ts`
- `src/demo/ai/intent.ts`
- `src/demo/ai/params.ts`
- `src/demo/ai/analyze.ts`
- `src/demo/browser-bridge.ts`
- `demo-frontend-package/calculation-app.js`
- `demo-frontend-package/server.mjs`
- `src/demo/__tests__/ai-assistant.test.ts`
- `tests/demo-e2e/final-demo.spec.ts`

先确认现状再增量修改。禁止重写 Calculation Engine，禁止改变收入、成本、利润、现金流、IRR、敏感性等既有计算口径。

## 2. P0：修复多线路/多路段 AI 参数修改作用域

当前读取参数主要基于第一条线路第一个路段，但修改时可能遍历全部 Route/Segment。这会造成“确认展示一个值，实际修改所有路段”的业务风险。

至少区分：
```ts
type ParamScope = "project" | "vehicle" | "all_routes" | "route" | "segment";
```

车辆数属于 project/vehicle 级；单车月租属于 vehicle 级；电价、运价、里程、载重、能耗、趟次、司机单趟成本属于 route/segment 级。

### 单路段
用户说“把电价改成0.65”，可直接生成确认卡。

### 多路段且原值一致
例如 A/B/C 都是 0.80，可生成：
- 作用范围：全部3个路段
- 电价：0.80 → 0.65 元/kWh
用户确认后才能修改全部路段。

### 多路段且原值不一致
例如 A=0.72、B=0.68、C=0.81，用户只说“把电价改成0.65”时，禁止直接修改。必须提示当前各路段值并要求选择：
1. 全部路段统一修改
2. 指定线路
3. 指定路段

明确 Scope 后才生成 PendingAction。

PendingAssistantAction 应携带 scope，并在确认卡展示字段、原值、新值、单位、作用范围、是否创建新方案、是否重新调用 Calculation Engine。具体字段结合当前真实数据结构实现，不要为匹配示例强改类型。

## 3. P0：继续保持“确认后执行”

必须保持：
```text
用户提出修改
→ 识别参数和作用范围
→ 修改预览
→ 用户确认
→ updateScenarioInput
→ calculateProject()
→ 保存 Scenario
→ 展示真实新结果
```

禁止用户说一句就直接写 LocalStorage；禁止 AI 自己算新利润。

## 4. P1：补齐核心经营参数自然语言修改

至少完整支持：
- 电价：把电价改成0.65元
- 车辆数：车辆增加10台
- 运价：运价调整为120元
- 单车月趟次：调整到28趟
- 运输里程：改成82公里
- 载重：按32吨重新测算
- 重载能耗：调整到1.45kWh/km
- 司机单趟成本：改成120元
- 单车月租：改成9800元

同时合理支持 set/add/subtract/percentage，例如“运价下降10%”“趟次减少3趟”“电价上涨20%”。

## 5. P1：AI 参数校验

AI 参数进入引擎前必须校验。至少拦截：
- 电价 < 0
- 车辆数 <= 0
- 里程 <= 0
- 载重 < 0
- 趟次 < 0
- 能耗 < 0
- 月租 < 0
- 司机成本 < 0

明显异常但数学合法的值（如电价100、车辆10000、载重500）不要白屏或擅自纠正，应提示明显偏离常规范围并二次确认。

## 6. P1：LLM 从“润色器”逐步升级为业务理解层

不要推倒现有架构。目标：
```text
用户问题
→ 确定性规则识别
→ 命中则 Tool Calling
→ 未命中且远端 LLM 可用
→ LLM 输出结构化 Intent/Tool Request
→ Schema Validation
→ Business Validation
→ 必要时用户确认
→ Tool Calling
→ Calculation Engine

LLM 不可用
→ 本地 fallback
```

规则继续作为高频确定性能力和 fallback，但不能成为所有业务问题的唯一理解入口。

LLM 只能输出结构化操作意图，例如 parameter/value/operation/scope/requiresConfirmation；禁止直接写入 monthlyProfit、IRR、cashFlow 等 KPI。

## 7. Tool Layer 保持唯一业务操作入口

继续维护/完善：
- `getProjectContext()`
- `getScenario()`
- `getCalculationResult()`
- `updateScenarioInput()`
- `calculateProject()`
- `compareScenarios()`
- `getSensitivityAnalysis()`
- `generateReport()`

多线路需要时可增加 `getRoutes()`、`getSegments()`、`getParameterScope()`。

UI、LLM、正则解析层不得直接修改 Scenario 数据。

## 8. 上下文与数据隔离

助手必须明确当前 projectId、scenarioId、项目、方案、结果、Route/Segment 和可用方案列表。

若 `scenario.projectId !== currentProjectId`，拒绝执行写操作。继续保证 Project A 的 AI 无法修改 Project B 的 Scenario。

## 9. 区分“修改当前方案”和“创建新方案”

“把当前方案电价改成0.65”：
→ 修改当前 Scenario → 确认 → 重算。

“帮我做一个低电价方案，电价0.65”：
→ Copy 当前 Scenario → 新 Scenario → 改参 → 确认 → Calculation Engine → 保存。

不得混淆。

## 10. 方案比较与敏感性

方案比较至少包含月收入、月总成本、月利润、利润率、IRR、累计现金流，展示 A/B/差值/变化率。差值和变化率由代码计算，AI 只解释。

用户问“哪些参数最影响利润”必须调用真实 `runSensitivity()`，由引擎重算、排序，再由 AI 解释。禁止 LLM 猜测。

## 11. 领导汇报

汇报内容引用真实项目和引擎指标，可由 AI 做归纳、风险表达、经营建议和语言优化，但禁止发明任何收入、成本、利润、IRR、现金流、敏感性数字。

## 12. UI 不做大改

保留现有 AI 项目测算助手、当前项目/方案、快捷问题、聊天记录、参数确认卡、Tool 结果和方案对比。多线路仅增加必要的“修改范围/线路/路段”交互。

## 13. 连续对话

至少保证：
```text
如果电价降到0.65呢？
→ 确认？
→ 确认
→ 重算完成
→ 那车辆再增加10台呢？
→ 确认
→ 重算
→ 帮我比较刚才两个方案
```
上下文正确。

## 14. AI 降级与 Secret

当 DEMO_AI_API_KEY 未配置、超时、5xx、网络异常、JSON解析失败时，AI 区域降级，但 Calculation Engine、Scenario、LocalStorage 和页面必须正常。

API Key 只能存在服务端环境变量，禁止进入 HTML、JS bundle、LocalStorage、URL、前端配置或 GitHub 明文源码。

## 15. 必须补充测试

必须新增/确认：
1. 单线路改单参数：Pending→确认→真实重算。
2. 多线路相同参数：明确“影响全部N个路段”后确认修改。
3. 多线路不同参数：模糊指令必须要求 Scope，未明确前不得修改。这是 P0。
4. 取消 Pending 后原 Scenario 完全不变。
5. 9类核心参数自然语言识别测试。
6. 非法值不进入引擎、不写 Scenario、不白屏。
7. Project A/B AI 写操作隔离。
8. AI 503/timeout/invalid JSON 时测算不受影响。
9. AI/LLM 返回内容不能覆盖 monthlyProfit、monthlyRevenue、monthlyTotalCost、IRR、cashFlow 等引擎字段。

## 16. 最终 Playwright E2E

真实运行：
```text
登录
→ 项目
→ 项目测算
→ 基准方案
→ AI助手
→ “这个项目为什么利润比较低？”
→ 真实业务诊断
→ “如果电价从0.8降到0.65呢？”
→ 修改确认
→ 确认
→ Calculation Engine重算
→ “帮我做一个低电价方案”
→ 创建并测算
→ “车辆增加10台”
→ 确认并重算
→ “帮我比较刚才两个方案”
→ 真实方案比较
→ “哪些参数最影响利润？”
→ Sensitivity Engine
→ “帮我生成一段给领导汇报的结论”
→ 汇报
→ 刷新
→ Scenario仍存在
→ 返回项目详情
```

检查：无白屏、无 NaN、无 Infinity、无阻断 console error、无 projectId 串数据、无未确认自动修改、无 AI 自行计算 KPI。

## 17. 本轮禁止事项

禁止：
1. 重写 Calculation Engine
2. 修改 Excel 对齐公式
3. 修改 IRR/现金流/收入/成本核心公式
4. 大改项目管理或测算页面
5. 替换 LocalStorage Demo 架构
6. 引入 Prisma 到静态 Demo
7. API Key 放浏览器
8. LLM 直接修改 LocalStorage/Scenario
9. LLM 自己计算核心 KPI
10. 删除本地 fallback
11. 加入无关新功能

## 18. 完成后必须输出验收报告

必须提供：
- 最新 Commit SHA
- 修改文件清单、原因、主要变化
- P0/P1 每项 PASS/FAIL
- AI Tool 清单（输入、输出、是否写数据、是否调用引擎）
- Param Scope 实际机制
- Unit Test / Build / Playwright E2E 的真实执行结果
- E2E PASS/FAIL 数量
- 是否修改 Calculation Engine：YES/NO
- 同输入下月收入、月成本、月利润、利润率、IRR、累计现金流是否保持一致
- 已知问题

不要只写“测试通过”或“已完成”。

## 19. 执行顺序

```text
Step 1 审计当前 d0440417
Step 2 列出拟修改文件
Step 3 修 P0 多线路 Scope
Step 4 补 P0 测试
Step 5 补齐核心经营参数自然语言识别
Step 6 完善参数校验
Step 7 在保留规则 fallback 前提下增强 LLM 意图理解
Step 8 跑 Unit Test
Step 9 跑 Calculation Engine Regression
Step 10 跑完整 Playwright E2E
Step 11 检查 Console
Step 12 检查 API Key
Step 13 Git Commit
Step 14 输出完整验收报告
```

## 20. 最终原则

```text
AI负责：
理解、问答、业务分析、操作意图、Tool调用、风险解释、经营建议、汇报表达。

Calculation Engine负责：
收入、成本、利润、现金流、IRR、敏感性及所有核心数值。
```

**AI 可以越来越聪明，但计算口径永远只有一个。**

本轮目标不是继续堆功能，而是保证领导演示稳定、安全、可解释，并为后续正式版 AI Agent 留好架构。
