# 项目测算系统——DeepSeek 真实接入 + 复杂资料 AI 验收报告 V1.0

**结论：`CODE PASS / ONLINE MODEL NOT VERIFIED`**

本机没有 `AI_API_KEY` / `DEMO_AI_API_KEY`，真实 DeepSeek 请求没有发出。不能写成 DeepSeek 真实接入 FULL PASS，也不能锁版。

## 版本

| 项 | 值 |
| --- | --- |
| 基线业务提交 | `5f4e68da9b04d7aca1ab05942ba87105ace3e4e1`（当前 HEAD 的祖先） |
| 开发基线 HEAD | `f88c1e7a99e6341d68763c18ae6c840f2da55187` |
| 本轮代码 | 工作区未提交。按指令只交付报告，未做 git commit |
| 实际配置模型 | `deepseek-flash`（`AI_MODEL` / `DEMO_AI_MODEL` 可覆盖，业务代码不写死） |
| Key | 仅服务端环境变量。启动日志已核对，不含 Key |

启动日志（本地 Demo，未配置 Key）：

```text
AI Provider: deepseek
AI Model: deepseek-flash
AI Configured: false
```

## Provider

- `DeepSeekDocumentExtractor`：OpenAI 兼容 `chat/completions`，`response_format: json_object`，本地再做 Schema / 白名单 / evidence / chunkId 校验。
- `TestDocumentExtractor`：离线 E2E 与 Golden 用，不冒充线上模型。
- `DeterministicContentExtractor` 保留。规则语义与模型候选经 `mergeRuleAndLlm` 合并。同值同语义合并来源；值不同进入确认；模型不能无痕覆盖规则。
- 模型输出不能写 Scenario，不能算 KPI。确认后才 `calculateProject()`。

兼容：未设置 `AI_*` 时回退 `DEMO_AI_API_KEY` / `DEMO_AI_BASE_URL` / `DEMO_AI_MODEL`。浏览器只打本机 `/api/demo-import/parse`，不直连 `api.deepseek.com`。

## AI Eval（离线 Golden，不是模型自评）

```text
AI Extraction Evaluation
Cases: 13
Explicit accuracy: 100%
Conflict detection: 100%
Range detection: 100%
Unit accuracy: 100%
Source trace: 100%
Unsafe silent selection: 0
KPI violations: 0
Prompt injection violations: 0
Hallucinations: 0
```

命令：`npm run test:ai-eval`。13 个 case 全部 PASS。

| Case | 资料要点 | 实际结果 |
| --- | --- | --- |
| 01 首批 vs 规划 | 首批 30，后续 35 | `CONFLICT`，候选 30、35，未选值。修饰含首批、规划 |
| 02 里程区间 | 单边约 80~85 公里 | `NEED_CONFIRMATION`，区间 80~85 km。按钮含 80 / 82.5 / 85，未自动采用 |
| 03 综合电价 | 谷 0.62、峰 0.91、综合预计 0.68 | `CONFLICT`，三值都在。0.62/0.91 未覆盖 0.68 |
| 04 历史/当前运价 | 原合同 40，暂按 42 | `CONFLICT`。时间口径 historical + current |
| 05 单程/往返 | 单程 82，往返 164 | `distanceKm=82`。164 未写入单程 |
| 06 含税/未税 | 9800 / 8672 | `CONFLICT`，未代选 |
| 07 日趟次 | 每天 2 趟 × 26 天 | `INFERRED 52`，derivation 写明确定性换算，需确认 |
| 08 模糊载重 | 通常 32，极端 34 | `CONFLICT`，34 未覆盖 32 |
| 09 多文件 | A 30，B 32 | `CONFLICT` |
| 10 缺失 | 没有重载能耗 | `loadedEnergyConsumption=MISSING`，未编造 |
| 11 Prompt Injection | 要求改月利润并自动确认 | 无 KPI 字段。注入成功次数 0 |
| 12 上下文 | 线路不变；电价调整为 0.7 | 只抽出 0.7。未发明线路。伪造 evidence 被拒绝 |
| 13 地图/估算/往返 | 导航 82、估算 85、往返 164 | `CONFLICT` 仅 82 与 85。164 未进入单程 |

## DeepSeek Smoke

```text
SKIPPED: AI_API_KEY not configured
```

- 命令：`npm run test:deepseek-smoke`
- 不进入 `npm test`
- token usage：无。请求次数 0，失败次数 0
- 缺 Key 时输出 SKIPPED，没有记成 PASS

## Fallback

`src/demo/__tests__/deepseek-provider.test.ts`：

- 截断 / 非法 JSON：`degraded=true`，不抛出，资料导入不失败
- HTTP 429：重试一次后继续
- 无 evidence、错误 chunkId、往返里程、KPI 字段：拒绝，规则值保留
- 抽取器抛错：`ai=llm_failed_deterministic`，xlsx 车辆数仍为 30

## Prompt Injection / KPI

- KPI 越权次数：0
- Prompt Injection 成功次数：0
- 无来源编造：0（evidence 不在 chunk 内则拒绝）
- 冲突静默选值：0
- 恶意抽取器写入 `monthlyProfit` / `projectId` / `irr` 被拒绝

## Calculation / E2E

- Calculation Engine core changed：**NO**（`src/lib/engine`、`src/calculation` 无 diff）
- `npx vitest run src/lib/engine/__tests__ tests/golden src/calculation/__tests__ src/demo/__tests__`：**157 passed**
- Excel / 后端 / 浏览器利润与 IRR 对照：maxDiff 0，PASS
- 管线测试：真实 xlsx / pdf / docx → 候选 → 人工确认 30 与 80 → 补系统默认 → Scenario → `calculateProject()`，利润与再次计算一致
- 浏览器（系统 Chrome）：上传含区间和首批/规划的 xlsx，页面显示 `80~85`、首批、35、需要确认；未点选时不能测算；点选并补默认值后进入结果页，无 NaN / Infinity
- 普通回归不调用线上 DeepSeek

## Key 安全

- `.env` / `.env.local` / `uploads/` / `tmp/` 已在 gitignore
- 仓库扫描未发现 `sk-` 真实 Key
- 前端 bundle 无 Key，无直连 DeepSeek
- 服务端日志不打印 Authorization
- 配置接口只返回 `aiConfigured` / `aiProvider` / `aiModel`

## 锁版清单

```text
[ ] DeepSeek真实请求成功          未执行（无 Key）
[x] JSON结构化输出成功            离线 Schema / mock 通过；线上未验证
[x] Key仅服务端
[x] 真实复杂资料能理解            规则层 13 case；线上模型未验证
[x] 区间不擅自选
[x] 首批/规划不混淆
[x] 历史/当前不混淆
[x] 综合电价/峰谷电价不混淆
[x] 单程/往返不混淆
[x] 含税/未税不擅自选
[x] 冲突进入人工确认
[x] 缺失不编造
[x] 来源真实可追溯
[x] Prompt Injection = 0成功
[x] KPI越权 = 0
[x] Scenario必须人工确认
[x] Calculation Engine回归PASS
[x] E2E PASS                      离线 TestExtractor + 浏览器确认流
```

## 已知问题

1. 没有线上 DeepSeek 调用，不能评估 `deepseek-flash` 对脏资料的真实召回。配好 Key 后单独跑 `npm run test:deepseek-smoke`。
2. 离线 100% 来自确定性语义规则 + Golden，不是模型准确率。模型只在有 Key 时追加候选，且不能覆盖规则。
3. 区间中值 82.5 只作为可点按钮出现，系统不预选。
4. 日趟次 52 是规则换算并标 INFERRED，仍要人确认后才能测算。
5. 沙箱里的 Playwright Chromium 未安装；确认页用本机 Chrome 走通。`npx playwright test` 在未安装浏览器时仍会失败。
