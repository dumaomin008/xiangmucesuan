# 项目测算系统------领导演示终版 AI 大模型整改指令 V1.0

> 适用仓库：`dumaomin008/xiangmucesuan`\
> 基线：当前 `main` 分支\
> 目标：在不破坏现有真实测算引擎的前提下，完成"全功能前端 Demo + 真实
> Calculation Engine + 真实 AI 大模型"的领导演示终版。\
> 核心原则：**砍生产工程，不砍业务能力；允许 Mock 数据来源，不允许 Mock
> 测算结果。**

------------------------------------------------------------------------

## 1. 本轮开发目标

本轮不是继续扩展生产级
V2，也不是重新开发项目测算系统，而是在当前已经完成 V1
测算引擎、自动化验收和 AI Workspace 骨架的基础上，完成领导可现场操作的
AI 项目测算 Demo。

领导演示必须能够完整跑通：

**创建项目 → 上传/粘贴尽调资料 → AI真实解析 → 结构化项目参数 →
结构化线路 → 缺失/冲突检查 → 用户确认 → 真实测算 →
KPI/成本/现金流/敏感性图表 → 风险分析 → 下一步尽调建议 → AI对话模拟方案
→ Calculation Engine真实重算 → 前后方案对比。**

不得通过写死利润、写死图表、写死 AI 回复来伪造完整链路。

------------------------------------------------------------------------

## 2. 当前代码审计结论

### 2.1 必须冻结并复用的能力

当前 Calculation Engine 已具备较高可信度，不允许为演示方便重写：

-   Excel Golden 固定样本已建立。
-   原 Excel 核心月度利润表指标已对齐。
-   月营收、总成本、利润、VAT 等 Golden 误差控制在 `<= 0.01 元`。
-   已覆盖 PER_TON / PER_TRIP / PER_TON_KM。
-   已覆盖能源、轮胎、司机、过路、装卸、信息费等变动成本。
-   已覆盖车辆成本、管理费、维护、保险等固定成本。
-   已覆盖现金流 Month 0。
-   已覆盖 VAT 留抵。
-   已覆盖 IRR 边界。
-   已覆盖 Snapshot 不可变。
-   已覆盖 Sensitivity 0% 与 baseline 一致。
-   已覆盖收入/成本/利润守恒。
-   已覆盖路段 → 线路 → 方案汇总守恒。

**本轮禁止修改 Golden expected 以迁就新代码。**

如 AI 接入后测试失败，应优先修复 AI 映射层，而不是修改 Calculation
Engine 公式。

### 2.2 当前 AI 实现存在的演示阻塞项

#### P0-A：LLM Gateway 尚未真正接入供应商

当前：

`src/lib/ai/services/llm-gateway.ts`

`completeStructuredJson()` 最终会抛出 `LLM_NOT_CONFIGURED`。

因此目前不能称为真实 AI。

#### P0-B：当前资料解析主要是启发式/正则

当前：

`src/lib/ai/extract/heuristic.ts`

只能较稳定识别显式表达，例如：

-   A到B
-   100公里
-   每日3000吨
-   80台车
-   运价32元/吨
-   每天3趟
-   单车载重40吨

复杂会议纪要、自然语言、表格描述、上下文关系无法仅靠此方案可靠解析。

#### P0-C：PDF / DOCX / XLSX 当前没有真实读取正文

当前：

`src/lib/ai/services/document-parser.ts`

二进制文件目前会进入 `unsupported_binary`。

领导演示如果上传尽调模板、Excel、Word、PDF，会直接暴露能力缺口。

#### P0-D：AI → Engine 映射还不完整

当前：

`src/lib/ai/map/to-engine.ts`

部分字段仍使用：

-   `tollPerTrip: "0"`
-   `loadingUnloadingFee: "0"`
-   `informationFee: "0"`
-   `driverCostPerTrip: "0"`
-   `operatingMonthsYear: ""`

这些不能在领导演示中被静默当作真实业务输入。

#### P0-E：风险引擎为空

当前：

`src/lib/ai/services/risk-engine.ts`

返回空 `items`，尚无真实风险规则。

#### P0-F：缺少完整 AI Copilot 场景重算闭环

领导现场问：

"运价下降5%会怎么样？"

不能由 LLM 自己估算利润变化。

必须：

AI识别意图 → 参数 patch → 创建临时场景 → Calculation Engine →
返回真实结果 → AI解释差异。

------------------------------------------------------------------------

# 3. 本轮最高原则

## 3.1 Calculation Engine 是唯一数值真相源

以下结果禁止由大模型直接生成：

-   收入
-   成本
-   利润
-   毛利率/利润率
-   月度现金流
-   累计现金流
-   IRR
-   投资回收期
-   VAT
-   车辆成本
-   能源成本
-   轮胎成本
-   司机成本
-   敏感性结果
-   方案对比中的财务结果

统一链路：

`用户/AI输入 → 标准参数 → Schema Validator → Calculation Engine → Calculation Result Schema → AI解释`

## 3.2 AI只能做四类事情

1.  理解资料。
2.  提取/整理参数。
3.  识别用户意图和参数变化。
4.  解释 Calculation Engine 已产生的结果。

## 3.3 允许 Mock 的内容

演示阶段允许：

-   历史项目参考库。
-   同线路参考值。
-   同车型参考值。
-   平台行业基准。
-   部分项目列表初始数据。
-   演示用户/权限。
-   消息通知。
-   非核心审计后台。

但所有 Mock 参考值必须标识来源，例如：

`演示参考值 / 系统默认 / 历史样本`

禁止伪装为当前项目事实。

## 3.4 禁止 Mock 的内容

-   Calculation Engine 输出。
-   AI现场问答的重算结果。
-   敏感性分析结果。
-   方案对比结果。
-   现金流。
-   利润。
-   成本。
-   收入。
-   IRR。

------------------------------------------------------------------------

# 4. 推荐演示版技术架构

``` text
Frontend
   │
   ├── AI Workspace
   ├── Calculation Workspace
   ├── Result Dashboard
   └── AI Copilot
          │
          ▼
AI Orchestrator
   │
   ├── Document Parser
   ├── LLM Gateway
   ├── Schema Validator
   ├── Reference Service
   ├── Risk Engine
   └── Scenario Intent Parser
          │
          ▼
Calculation Service
          │
          ▼
Existing Calculation Engine
          │
          ▼
CalculationResultV1
          │
          ├── Charts
          ├── Risk Rules
          └── AI Explanation
```

**禁止：**

`Frontend → LLM → “利润预计为XXX”`

------------------------------------------------------------------------

# 5. P0-1：接入真实 LLM Gateway

优先复用：

`src/lib/ai/services/llm-gateway.ts`

不要在页面组件里直接调用任何模型 SDK。

## 5.1 环境变量

至少抽象：

``` text
AI_LLM_PROVIDER=
AI_LLM_MODEL=
AI_LLM_API_KEY=
AI_LLM_BASE_URL=
AI_PROMPT_VERSION=
AI_LLM_TIMEOUT_MS=
```

API Key 只能服务端读取。

不得使用：

`NEXT_PUBLIC_AI_LLM_API_KEY`

## 5.2 Provider Adapter

建议：

``` text
src/lib/ai/providers/
  types.ts
  openai-compatible.ts
```

Demo 第一版可以优先实现 OpenAI-compatible provider。

后续可替换不同供应商而不修改业务层。

统一接口建议：

``` ts
interface LlmProvider {
  structuredCompletion<T>(input: {
    model: string;
    systemPrompt: string;
    userContent: string;
    jsonSchema: unknown;
    timeoutMs?: number;
  }): Promise<T>;
}
```

## 5.3 超时与重试

建议：

-   timeout：30\~60 秒。
-   网络失败：最多重试 1 次。
-   Schema 失败：允许带校验错误重试 1 次。
-   仍失败：进入 heuristic fallback。
-   页面必须明确显示"AI解析失败，已切换基础解析"，不能无限 loading。

------------------------------------------------------------------------

# 6. P0-2：真实文档解析

目标支持：

-   TXT
-   Markdown
-   PDF
-   DOCX
-   XLSX

演示优先保证：

**XLSX + DOCX + PDF + 粘贴文本。**

## 6.1 Parser职责

Parser只负责：

`文件 → 可追溯文本/表格内容`

不要让 Parser 直接判断利润或业务风险。

统一输出建议：

``` ts
type ParsedDocument = {
  sourceId: string;
  fileName: string;
  mimeType: string;
  text: string;
  sections?: {
    page?: number;
    sheet?: string;
    table?: string;
    content: string;
  }[];
  warnings: string[];
}
```

## 6.2 XLSX

至少读取：

-   Sheet名称
-   有值单元格
-   行列关系
-   合并单元格尽量保留语义

转成模型易理解的结构化文本。

例如：

``` text
[SHEET: 项目尽调]
项目名称 | 云南玉溪新能源运输项目
客户 | XX钢铁
线路 | 昆钢-大开门
单程里程 | 103 km
日均运量 | 3000 吨
...
```

## 6.3 PDF / DOCX

优先文本抽取。

如果是扫描件导致正文为空：

页面提示：

"该文件可能为扫描件，本次未识别到有效正文，可粘贴关键内容继续演示。"

Demo阶段不要为了 OCR 把整体进度拖死。

------------------------------------------------------------------------

# 7. P0-3：LLM结构化抽取

当前 heuristic 不删除。

调整为：

``` text
Document Parser
      ↓
LLM Structured Extraction
      ↓
Schema Validator
      ↓
成功 → 使用 LLM 结果
失败 → heuristic fallback
```

## 7.1 LLM必须输出现有标准 Schema

尽量复用：

-   `AiExtractResult`
-   `ParameterRecord`
-   `AiRouteDraft`
-   `reference_candidates`
-   `questions`
-   `conflicts`
-   `due_diligence_next`

不要让前端直接消费模型自由文本。

## 7.2 每个参数必须保留

-   field_code
-   value
-   unit
-   raw_value
-   source_type
-   source_ref
-   confidence
-   status
-   editable
-   updated_by

## 7.3 模型禁止行为

模型不得：

-   编造运价。
-   编造合同运量。
-   编造客户承诺。
-   把"预计"识别成"已确认"。
-   把"可能"识别成事实。
-   自动采用冲突值。
-   为了完成测算强行补齐 P0 商务字段。

------------------------------------------------------------------------

# 8. P0-4：AI → Calculation Engine 映射补齐

重点审计：

`src/lib/ai/map/to-engine.ts`

当前映射不能把缺失成本静默写为 0。

## 8.1 字段状态

进入 Calculation Engine 前，每个核心字段必须区分：

-   confirmed
-   extracted
-   reference
-   default
-   missing
-   conflict

## 8.2 缺失字段处理

### P0字段

缺失时阻止"正式测算"。

页面显示：

`还缺 X 项关键参数`

允许用户：

-   手动填写。
-   采用参考值（仅允许的字段）。
-   返回资料补充。

### P1字段

可采用参考值。

必须显示：

`参考值`

并保留来源。

### P2字段

允许系统默认。

必须在结果页显示"假设条件"。

## 8.3 禁止静默0

以下字段如果业务上需要参与成本，禁止因为 AI 没提取到就自动写 `0`：

-   司机成本
-   过路费
-   装卸费
-   信息费
-   电价
-   电耗
-   车辆成本相关核心字段

除非字段定义明确允许默认 0，并且 UI 能看到。

------------------------------------------------------------------------

# 9. P0-5：风险引擎

不要让 LLM 自己决定"高/中/低风险"。

先做规则，再让 AI 解释。

建议 Demo 第一版至少支持：

### RISK-01 运价风险

基准运价下降一定比例后，利润率快速恶化。

来源：

Sensitivity Engine。

### RISK-02 电价风险

电价上涨导致能源成本明显上升。

### RISK-03 趟次风险

日/月趟次下降导致车辆利用率不足、单位固定成本升高。

### RISK-04 运量风险

项目运量不足以支撑当前车队规模。

### RISK-05 空驶风险

存在较高空驶里程/空驶占比。

### RISK-06 数据质量风险

关键字段：

-   missing
-   conflict
-   reference/default占比过高

### RISK-07 投资回收风险

现金流长期未转正或 IRR 不可计算/偏弱。

风险输出统一：

``` ts
{
  risk_code,
  risk_name,
  level,
  evidence,
  affected_metrics,
  trigger_rule,
  recommendation
}
```

其中 `level` 必须来自 Risk Engine。

AI只生成 explanation。

------------------------------------------------------------------------

# 10. P0-6：下一步尽调建议

不要输出泛泛建议。

计算：

`尽调优先级 = 缺失程度 × 指标敏感度 × 当前置信度`

至少展示：

-   优先级 P0/P1/P2
-   需要确认什么
-   当前使用什么假设
-   为什么重要
-   会影响哪些结果
-   建议怎么获取

示例：

``` text
P0｜确认真实月均趟次

当前值：9 趟/月
来源：会议纪要 AI 提取
置信度：68%

影响：
车辆数、月收入、单位固定成本、利润率。

建议：
调取近3个月实际运输台账，按车辆统计月均有效趟次。
```

------------------------------------------------------------------------

# 11. P0-7：AI Copilot

这是领导演示最重要的 AI 能力之一。

## 11.1 入口

结果页右侧固定：

`AI 测算助手`

不要把整个系统做成聊天框。

## 11.2 推荐问题

默认展示快捷问题：

-   为什么这个项目利润率不高？
-   最大成本项是什么？
-   哪个参数对利润最敏感？
-   运价下降5%会怎么样？
-   电价涨到1元会怎么样？
-   车辆减少10台会怎么样？
-   帮我生成保守方案。
-   还需要继续尽调什么？

## 11.3 问题分类

### A. 解释型

例如：

"为什么利润低？"

AI读取真实：

-   CalculationResult
-   Cost Breakdown
-   Sensitivity
-   Risk Result

生成解释。

无需重算。

### B. 场景型

例如：

"运价下降5%会怎么样？"

必须：

``` text
用户问题
 ↓
LLM Intent Parser
 ↓
ScenarioPatch
 ↓
参数合法性校验
 ↓
复制当前 baseline input
 ↓
应用 patch
 ↓
Calculation Engine
 ↓
Scenario Result
 ↓
Difference
 ↓
AI Explanation
```

## 11.4 ScenarioPatch

建议：

``` json
{
  "actions": [
    {
      "field_code": "revenue.freight_price",
      "scope": "all_routes",
      "operation": "multiply",
      "value": 0.95
    }
  ]
}
```

## 11.5 禁止

LLM不能直接回复：

"运价下降5%后利润预计下降12%。"

必须真实重算后才能回答。

------------------------------------------------------------------------

# 12. P0-8：方案对比

AI场景模拟后，不要只回复文字。

生成：

`临时方案`

例如：

-   基准方案
-   运价-5%
-   电价1元/kWh
-   65台车方案
-   保守方案

对比至少展示：

-   月收入
-   月成本
-   月利润
-   利润率
-   能源成本
-   车辆成本
-   首次现金流转正月份
-   IRR（可计算时）

支持：

`保存为正式方案`

Demo阶段至少支持 3 个方案并排。

------------------------------------------------------------------------

# 13. 结果页演示强化

结果页必须成为领导演示核心页面。

## 第一屏 KPI

建议：

-   月收入
-   月总成本
-   月利润
-   利润率
-   月运量
-   月里程
-   首次现金流转正
-   IRR

## 第二屏

成本结构：

-   车辆
-   能源
-   司机
-   轮胎
-   路桥
-   管理
-   财务
-   税费

## 第三屏

线路贡献：

-   线路收入
-   线路成本
-   线路利润
-   线路利润率

## 第四屏

现金流。

## 第五屏

敏感性。

优先：

-   运价
-   电价
-   趟次
-   车辆月租
-   满载电耗

## 第六屏

风险与尽调。

------------------------------------------------------------------------

# 14. AI工作台页面

建议三栏。

## 左侧：资料区

展示：

-   文件
-   文本
-   会议纪要
-   上传状态
-   解析状态

支持：

-   上传
-   删除
-   重新解析
-   粘贴文本

## 中间：结构化结果

Tab：

### 项目参数

字段 + 值 + 单位 + 来源 + 置信度 + 状态。

### 线路

表格字段至少：

-   线路
-   起点
-   终点
-   单程里程
-   运量
-   趟次
-   车辆
-   货物
-   运价
-   载重
-   状态

用户可：

-   修改
-   新增
-   删除
-   拆分
-   合并

## 右侧：AI检查

卡片：

-   P0缺失
-   P1建议确认
-   冲突
-   参考值
-   数据质量

底部主按钮：

`确认并开始测算`

------------------------------------------------------------------------

# 15. AI解析过程状态

不要只显示 spinner。

建议状态：

``` text
正在读取文件
↓
正在识别项目基本信息
↓
正在识别运输线路
↓
正在提取测算参数
↓
正在检查缺失与冲突
↓
正在生成尽调建议
↓
解析完成
```

完成后：

``` text
识别 3 条线路
提取 36 个参数
4 项需要确认
2 项存在冲突
3 项可采用参考值
```

------------------------------------------------------------------------

# 16. 演示资料准备

仓库建议增加：

``` text
/demo
  demo-project-text.md
  demo-meeting-notes.md
  demo-due-diligence.xlsx
  demo-expected.json
  demo-script.md
```

Demo资料必须经过人工核对。

不要临场第一次拿未知复杂文件测试。

------------------------------------------------------------------------

# 17. 推荐领导演示脚本

## Scene 1：创建项目

进入项目测算。

点击：

`AI智能测算`

## Scene 2：上传资料

上传一份尽调 Excel / Word，或者粘贴会议纪要。

AI开始真实解析。

## Scene 3：展示AI结构化能力

重点展示：

"系统不是把Excel搬到网页，而是AI自动把非结构化尽调资料转成可计算参数。"

展示：

-   项目参数
-   线路
-   来源
-   置信度
-   缺失
-   冲突

## Scene 4：AI发现问题

例如：

``` text
已识别 42 项参数
P0待确认 3 项
P1建议确认 4 项
```

点击一项查看原因。

## Scene 5：真实测算

点击：

`确认并开始测算`

Calculation Engine真实执行。

## Scene 6：结果驾驶舱

展示：

收入 → 成本 → 利润 → 现金流 → IRR → 敏感性。

## Scene 7：风险

展示：

"系统不仅告诉我们赚多少钱，还告诉我们为什么、哪里最容易出问题。"

## Scene 8：AI追问

现场输入：

`如果运价下降5%会怎么样？`

必须出现：

`正在创建模拟方案 → 正在重新测算`

随后展示基准 vs 新方案。

## Scene 9：第二次追问

输入：

`如果电价同时涨到1元呢？`

在上一临时方案基础上继续真实重算，或明确让用户选择"基于基准/当前模拟"。

## Scene 10：尽调闭环

输入：

`这个项目下一步最应该调查什么？`

AI结合：

-   missing
-   confidence
-   sensitivity
-   risks

输出下一步尽调清单。

------------------------------------------------------------------------

# 18. 演示中的产品价值话术

产品价值不要讲成：

"把Excel做成了系统。"

应体现：

> 把原来依赖少数熟悉 Excel
> 模型的人才能完成的项目测算，转成业务人员可以标准化使用的项目测算平台；AI负责理解尽调资料、整理参数、发现缺失和辅助分析，底层测算仍由经过
> Excel 对账的确定性引擎执行。

第二层：

> AI不是替代测算模型，而是降低测算模型的使用门槛。

第三层：

> 从"填表算结果"升级为"尽调---测算---分析---风险---决策"的完整闭环。

------------------------------------------------------------------------

# 19. 异常兜底

领导演示不能出现白屏。

## LLM超时

显示：

`AI服务响应较慢，正在重试。`

重试失败：

`已切换基础解析模式，可继续编辑参数和测算。`

## 文件解析失败

允许：

`粘贴文本继续`

## AI Schema失败

服务端：

-   validator
-   retry once
-   fallback heuristic

## Calculation Engine失败

必须展示：

-   code
-   field
-   message

禁止展示 stack trace。

## 网络异常

保留当前页面数据。

------------------------------------------------------------------------

# 20. 演示环境

本轮优先保证：

-   单机/云端稳定访问。
-   页面刷新后关键演示数据不丢。
-   API Key 服务端配置。
-   演示账号直接进入。
-   不需要生产级 SSO。
-   不需要复杂 RBAC。
-   不需要多租户。
-   不需要高并发。
-   不需要消息队列。

------------------------------------------------------------------------

# 21. 自动化测试要求

原有测试全部必须继续通过。

最低：

``` text
Golden
Unit
Typecheck
Build
HTTP/API
E2E
```

## 新增 AI 测试

### AI-01

固定会议纪要 → Schema 校验通过。

### AI-02

同一份演示资料 → 至少识别预期线路数量。

### AI-03

LLM不可用 → heuristic fallback 可继续。

### AI-04

PDF/DOCX/XLSX parser 能得到非空文本（演示样本）。

### AI-05

缺失 P0 → 不允许正式测算。

### AI-06

采用允许的 reference → 来源状态为 reference。

### AI-07

AI → Engine 映射不允许关键成本字段静默0。

### AI-08

"运价下降5%" → ScenarioPatch正确。

### AI-09

Scenario结果来自 Calculation Engine。

### AI-10

Baseline 输入不被场景模拟污染。

### AI-11

风险等级来自 Risk Engine，不来自 LLM自由输出。

### AI-12

LLM输出的任何 KPI 不得覆盖 CalculationResultV1。

------------------------------------------------------------------------

# 22. 本轮不做

为避免演示冲刺失控，本轮明确不做：

-   完整企业权限体系
-   SSO
-   多租户
-   高并发
-   消息队列
-   完整生产审计后台
-   完整历史项目知识库
-   向量数据库
-   RAG大规模知识库
-   复杂 OCR
-   AI Agent 自主执行长任务
-   自动修改正式项目
-   AI自动采用商务参数
-   复杂 Prompt 管理后台
-   模型成本治理平台

这些不影响领导演示核心价值。

------------------------------------------------------------------------

# 23. Cursor 开发顺序

严格按顺序执行。

## Phase 0：建立演示保护线

1.  当前 main 打 tag / branch。
2.  全量测试。
3.  保存测试结果。
4.  禁止修改 Golden expected。

## Phase 1：真实 LLM

1.  Provider Adapter。
2.  LLM Gateway。
3.  Structured JSON。
4.  Validator。
5.  timeout/retry/fallback。

## Phase 2：文件解析

1.  XLSX。
2.  DOCX。
3.  PDF。
4.  演示样本验证。

## Phase 3：AI Extract

1.  Prompt。
2.  Schema。
3.  source/confidence/status。
4.  route extraction。
5.  missing/conflict。
6.  heuristic fallback。

## Phase 4：Engine Mapping

1.  对齐字段字典。
2.  禁止关键字段静默0。
3.  P0/P1/P2。
4.  Reference状态。
5.  Calculation Engine真实执行。

## Phase 5：结果体验

1.  KPI。
2.  成本。
3.  线路。
4.  现金流。
5.  敏感性。
6.  风险。
7.  尽调。

## Phase 6：Copilot

1.  explanation。
2.  Scenario Intent。
3.  ScenarioPatch。
4.  Engine recalculation。
5.  Compare。
6.  save scenario。

## Phase 7：演示加固

1.  Demo资料。
2.  演示脚本。
3.  网络/LLM异常。
4.  全链 E2E。
5.  领导演示彩排。

------------------------------------------------------------------------

# 24. Cursor 开始编码前必须先输出

不要收到本文件后立刻大规模改代码。

先输出：

1.  当前 AI V2 实现现状。
2.  与本整改指令差距。
3.  本轮计划修改文件。
4.  本轮计划新增文件。
5.  哪些 Calculation Engine 文件明确不修改。
6.  AI字段映射缺口。
7.  需要安装的依赖。
8.  LLM Provider 接入方式。
9.  文件 Parser 方案。
10. Scenario Copilot 实现方案。
11. 测试计划。
12. 风险点。

确认技术方案后再编码。

------------------------------------------------------------------------

# 25. Definition of Done

满足以下全部条件才可称为"领导演示终版"。

-   [ ] 原有 Golden 全通过。
-   [ ] 原有自动化测试无回退。
-   [ ] Calculation Engine 核心公式未被 AI 重写。
-   [ ] 真实 LLM 已接入。
-   [ ] API Key 不暴露前端。
-   [ ] 粘贴会议纪要可以真实 AI 解析。
-   [ ] 演示 XLSX 可以读取并解析。
-   [ ] 演示 DOCX/PDF 至少可以读取正文。
-   [ ] AI返回严格结构化数据。
-   [ ] 线路表格可以确认和修改。
-   [ ] 参数来源/置信度/状态可见。
-   [ ] P0缺失会阻止正式测算。
-   [ ] 参考值不会伪装成已确认值。
-   [ ] AI确认后的参数进入真实 Calculation Engine。
-   [ ] KPI来自真实 Calculation Engine。
-   [ ] 图表来自真实 Calculation Engine。
-   [ ] 敏感性来自真实 Calculation Engine。
-   [ ] 风险等级来自确定性 Risk Engine。
-   [ ] AI可以解释真实结果。
-   [ ] "运价下降5%"可以真实重算。
-   [ ] "电价涨到1元"可以真实重算。
-   [ ] 场景模拟不污染 baseline。
-   [ ] 支持基准方案 vs 模拟方案对比。
-   [ ] AI可以输出下一步尽调建议。
-   [ ] LLM失败有 fallback。
-   [ ] 文件失败有 fallback。
-   [ ] Calculation失败有明确错误。
-   [ ] 演示主链路 E2E 通过。
-   [ ] 至少完成一次完整领导演示彩排。

------------------------------------------------------------------------

# 26. 最终产品边界

本轮完成后，系统应达到：

> **"业务功能完整、测算结果可信、AI真实可用、领导可以现场操作"的演示级产品。**

但不宣称已经达到：

> **生产级企业系统。**

后续正式使用阶段，再逐步替换/加强：

``` text
Demo Reference → Historical Reference Service
Demo Storage → Production DB
Simple Auth → Enterprise Auth
Demo Risk Rules → Business Calibrated Rules
Single Provider → Multi-provider LLM Gateway
Basic Parser → Production Document/OCR Pipeline
Demo Deployment → Production Cloud Architecture
```

由于本轮已经坚持：

`UI / AI Orchestrator / Calculation Engine / Data Source`

解耦，因此正式化阶段应以"替换基础设施和补治理"为主，而不是推倒重做。

------------------------------------------------------------------------

## 给 Cursor 的最终一句话

**本轮不要追求生产级工程完备度，优先确保领导能够完整、稳定、真实地体验"AI读资料
→ 自动结构化 → 发现问题 → 确认参数 → 真实测算 → 图表分析 → 风险尽调 →
AI场景重算"的完整价值闭环；任何财务和运营核心数字必须来自现有
Calculation Engine，禁止由大模型编造。**
