# AI 业务助手领导演示前终审——验收报告

> 基于基线 Commit `d0440417c0ab1d917b46fb291851db52e6c128da` 增量整改。
> 报告生成时间：2026-09-18

## 1. 最新 Commit SHA

`4be8e7e44e7270b769d02d53505f5c9f36108fe2`（基线 `d0440417c0ab1d917b46fb291851db52e6c128da`）

## 2. 修改文件清单

| 文件 | 原因 | 主要变化 |
|------|------|----------|
| `src/demo/ai/params.ts` | P0 Scope + P1 校验 | ParamScope、路段级读/写、一致性检测、硬/软校验 |
| `src/demo/ai/intent.ts` | P1 九类参数 NLP | set/add/multiply/%、负数解析、scope_choice |
| `src/demo/ai/assistant.ts` | P0 确认流 + 隔离 | await_scope / await_abnormal_confirm、跨项目拒绝写 |
| `src/demo/ai/tools.ts` | Tool Layer | getRoutes/getSegments/getParameterScope、对比变化率、写隔离 |
| `src/demo/ai/llm-intent.ts` | P1 LLM 意图层 | Schema 校验，禁 KPI 字段 |
| `src/demo/browser-bridge.ts` | 桥接 | parsedIntent / validateLlmIntent |
| `demo-frontend-package/server.mjs` | LLM 意图代理 | `/api/demo-ai/intent`，Key 仅服务端 |
| `demo-frontend-package/calculation-app.js` | UI 小改 | 范围确认卡、远端意图 fallback、对比变化率列 |
| `demo-frontend-package/lib/pm-calc.bundle.js(.map)` | 打包 | 同步浏览器引擎包 |
| `src/demo/__tests__/ai-assistant.test.ts` | 必测 | P0 Scope / 九参数 / 非法值 / 隔离 / LLM Schema |
| `src/demo/__tests__/phase3-fusion.test.ts` | 安全 | 断言 intent 路由与无前端 Key |
| `tests/demo-e2e/final-demo.spec.ts` | E2E | 领导演示完整链路 |

**未修改**：Calculation Engine 源码、Excel 对齐公式、IRR/现金流/收入/成本核心公式。

## 3. P0 / P1 验收

| 项 | 结果 | 说明 |
|----|------|------|
| P0 多线路 Scope | **PASS** | 一致→全部N路段确认后改；不一致→必须选范围，未明确不改 |
| P0 确认后执行 | **PASS** | Pending→确认→updateScenarioInput→calculateProject→落盘 |
| P1 九类参数 NLP | **PASS** | 电价/车辆/运价/趟次/里程/载重/能耗/司机/月租 + %/增减 |
| P1 参数校验 | **PASS** | 非法硬拦截；异常软提示二次确认 |
| P1 LLM 意图层 | **PASS** | 规则优先；未命中可走 `/intent`；Schema 拒 KPI |
| Tool Layer 唯一入口 | **PASS** | UI/LLM 不直写 Scenario |
| 上下文隔离 | **PASS** | scenario.projectId !== projectId 拒绝写 |
| 修改当前 vs 创建新方案 | **PASS** | create_scenario / modify 分流 |
| 方案比较 + 敏感性 | **PASS** | 含变化率；敏感性走 runSensitivity |
| 领导汇报 | **PASS** | 仅引用引擎指标 |
| UI 不大改 | **PASS** | 仅增加范围选择交互 |
| 连续对话 | **PASS** | 单测+E2E 覆盖 |
| AI 降级与 Secret | **PASS** | Key 仅服务端；前端无明文 |

## 4. AI Tool 清单

| Tool | 输入 | 输出 | 写数据 | 调引擎 |
|------|------|------|--------|--------|
| getProjectContext | projectId | project | 否 | 否 |
| getScenario | scenarioId | scenario | 否 | 否 |
| getCalculationResult | scenario | results | 否 | 否 |
| getRoutes | inputs | routes[] | 否 | 否 |
| getSegments | inputs | segments[] | 否 | 否 |
| getParameterScope | inputs+field | locations[] | 否 | 否 |
| updateScenarioInput | inputs+patches | 新 inputs+changes | 内存草稿 | 否 |
| calculateProject (calculateAndSaveTool) | inputs+meta | scenario+profit | **是** | **是** |
| compareScenarios | scenarioA/B | rows+summary | 否 | 否（读已存结果） |
| getSensitivityAnalysis | inputs | ranked items | 否 | **是** (runSensitivity) |
| generateReport | project+scenario | text | 否 | 否 |
| localDiagnose | scenario+q | insight | 否 | 间接（敏感性） |

## 5. Param Scope 实际机制

```text
ParamScope = project | vehicle | all_routes | route | segment

车辆数 / 单车月租 → vehicle（项目/车辆级）
电价/运价/里程/载重/能耗/趟次/司机成本 → segment 级

单路段：直接确认卡
多路段且原值一致：scope=all_routes，确认卡写明「全部N个路段」
多路段且原值不一致：pending.type=await_scope，禁止修改；
  用户选 全部 / 指定线路 / 指定路段 后才生成 PendingAction
```

## 6. 测试真实执行结果

| 套件 | 结果 |
|------|------|
| `npm run test:demo` | **33 passed** |
| `npm run test:calc`（含 golden / browser-consistency） | **150 passed** |
| `npm run build:demo-calc` | **成功** |
| `npm run test:demo-e2e` | **4 passed / 0 failed** |
| API Key 前端扫描 | **无明文** |
| Calculation Engine 是否修改 | **NO** |
| 同输入 KPI 一致性（Excel/后端/Browser） | **保持一致**（maxDiff=0） |

### E2E 明细
1. 登录→测算→新建→改参→保存→刷新→复制→对比→AI→返回 — PASS  
2. 项目隔离 A/B — PASS  
3. AI 领导演示：诊断→改电价确认→创建低电价→加车→对比→敏感性→汇报→刷新 — PASS  
4. 异常输入不白屏 — PASS  

## 7. 已知问题

1. 远端 LLM 意图仅在规则 `unmatched` 时异步尝试；未配置 `DEMO_AI_API_KEY` 时完整走本地规则（演示默认）。
2. 「指定线路/路段」在 UI 用 `prompt` 输入名称，非下拉（满足演示最小交互）。
3. 多字段同时修改且部分一致部分不一致时，任一不一致 segment 字段都会触发 scope 澄清（偏保守，符合 P0 安全）。

## 8. 原则复核

```text
AI：理解、问答、意图、Tool 调用、解释、建议、汇报表达
Calculation Engine：收入、成本、利润、现金流、IRR、敏感性及一切核心数值
```
