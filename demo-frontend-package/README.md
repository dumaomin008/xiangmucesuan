# Demo Frontend

## 项目用途

该项目仅用于 DEMO 演示及前端功能扩展。

- 不包含后端服务、数据库或真实账号体系。
- 不连接生产环境，不包含真实 API Key、Token 或数据库配置。
- 页面中的客户、项目、人员、车辆和账号均为虚构 DEMO 数据。
- 所有保存、上传、导入和关联行为仅在当前浏览器会话内模拟。

## 安装

运行环境：Node.js 18 或更高版本。

```bash
pnpm install
```

当前项目没有第三方运行依赖；执行安装命令用于校验 Node.js 环境并保持标准交付流程。

## 启动

```bash
pnpm run dev
```

默认访问地址：<http://127.0.0.1:4173/#/login>

端口被占用时，可临时指定其他端口：

```bash
PORT=4174 pnpm run dev
```

## 登录 DEMO

登录页可快速选择虚构演示身份，也可输入以下任一演示账号：

- `demo.sales.east`
- `demo.director.east`
- `demo.executive`
- `demo.admin`

密码仅校验非空，不代表真实认证逻辑。请勿在此项目中录入真实密码。

## 技术栈

- Framework：无框架，原生静态单页应用
- Language：HTML、CSS、JavaScript（ES2020+）
- CSS/UI 方案：原生 CSS、项目内 Design Tokens 和复用样式类
- 路由：浏览器 Hash 路由
- 数据：本地虚构 mock 数据
- 主要依赖：无第三方运行依赖

## 目录说明

```text
demo-frontend-package/
├── assets/                 # 页面静态图标资源
├── docs/                   # UI 设计规范和前端验收说明
├── lib/pm-calc.bundle.js   # 浏览器测算引擎（由仓库根目录 npm run build:demo-calc 生成）
├── calculation-app.js      # 项目测算页面与交互（Demo 壳层内）
├── app.js                  # 页面结构、组件片段和交互逻辑
├── project-data.js         # 扩展交互与虚构 DEMO 数据
├── styles.css              # 全局样式和组件样式
├── index.html              # 前端入口
├── server.mjs              # 仅用于本地启动的零依赖静态服务器
├── package.json
└── pnpm-lock.yaml
```

## 项目测算（Phase 3–6）

- 入口：项目详情 Header「项目测算」，或侧栏「项目测算中心」
- 路由：`#/projects/{projectId}/calculation`、`#/calculation`
- 计算：浏览器真实引擎（`window.PmCalc`），结果写入 LocalStorage
- UI：对齐 Design Spec（面包屑、object-header、扁平指标、方案对比表；无 Card 套 Card / 无紫色）
- AI 项目测算助手（Phase 6，由「结果解读」升级）：
  - 自然语言查询结果 / 修改参数（确认后执行）/ 调用 `calculateProject` 重算 / 方案对比 / 风险诊断 / 汇报结论
  - 默认本地洞察引擎（零配置、无 Secret）；可选远端润色仍走 `/api/demo-ai/explain`
  - **数字只来自 Calculation Engine**；AI 故障只降级助手文案，不阻塞测算
- 重建引擎包（在仓库根目录）：`npm run build:demo-calc`

## 部署模式

领导演示默认是 **mock**。第一次打开不请求 DeepSeek；只有用户在演示工具里主动切到 deepseek 后，才会走服务端润色。清除演示数据 / 重置演示后回到 mock。DeepSeek 失败不会改写 CalculationResult。

开发时如需看到模式切换和「模拟 AI 超时」，在浏览器执行 `localStorage.setItem("pm-demo-tools","1")` 后刷新，或打开带 `tools=1` 的地址。页面上的 AI 状态只显示「AI 服务正常」或「AI 深度分析暂不可用，测算功能不受影响」。

### 纯静态部署支持

只发布静态文件、不另起 API 时，以下能力可用：

- 项目测算
- Calculation Engine
- Mock AI
- 本地经营分析
- 项目对比
- 敏感性分析
- LocalStorage
- 可视化
- 演示资料流程（Demo Parser，内置演示资料与本地模拟解析）

### 纯静态部署不支持

如果没有额外 API 服务，以下能力不可用，页面会降级而不是白屏：

- 真实 DeepSeek 调用
- `/api/demo-ai/explain`
- 服务端真实文件解析（PDF / Word / Excel / 图片，依赖 `server.mjs` 与 `document-import.server.mjs`）

Real Parser 不可用时，导入页提示改用演示资料或手动确认，不把上传失败当成测算失败。

### 联网 AI 部署

需要同时具备：

```text
静态前端
+
Node API / Serverless Function（demo-frontend-package/server.mjs）
+
DeepSeek Key（仅服务端环境变量 AI_API_KEY 或 DEMO_AI_API_KEY）
```

调用路径：

```text
Browser → DemoApi（DEMO_API_BASE_URL，同源可留空）→ server.mjs → DeepSeek
```

静态站和 API 不同源时，设置 `DEMO_API_BASE_URL` 为 API 源，并在 API 进程设置 `DEMO_CORS_ORIGINS` 为前端 Origin。不要使用 `*`。`AI_MODEL` 没有内置默认值，必须写成演示环境实际调用成功的模型。

DeepSeek 只润色解释，不计算利润。超时约 9 秒；401 / 403 / 429 / 5xx / 网络异常 / 非 JSON / 空内容 / 无法核对的数字，都保留 Calculation Engine 结果并使用本地解读。

禁止把 DeepSeek Key 放进 `index.html`、JS bundle、LocalStorage 或 `VITE_*` 等浏览器可读取位置。

## 开发要求

- 必须复用现有组件。
- 必须遵循 `docs/design-spec.md` 和现有设计规范。
- 不修改与新增功能无关的页面。
- 不擅自调整现有 UI 风格。
- 不接真实生产数据。
- 优先使用 mock 数据，并明确标识为 DEMO。
- 不明确的交互或业务规则需要先确认，不自行补充。
- 不要将真实账号、手机号、VIN、车牌、合同、融资信息或客户资料提交到此项目。

## 环境变量

默认零配置可运行（测算 + 本地 AI 解读）。可选启用远端大模型润色：

| 变量 | 说明 |
|------|------|
| `AI_PROVIDER` | 例如 `deepseek`。未设置时按 Base URL 推断 |
| `AI_API_KEY` | 仅服务端。也可回退读取 `DEMO_AI_API_KEY`。禁止写入前端 |
| `AI_BASE_URL` | 例如 `https://api.deepseek.com`。未设置时按 provider 选择官方地址 |
| `AI_MODEL` | 必填才算 AI 已配置。不要依赖代码里的模型默认值 |
| `DEMO_API_BASE_URL` | 静态前端指向 API 的源。同源留空 |
| `DEMO_CORS_ORIGINS` | 允许调用 API 的前端 Origin，逗号分隔。不要使用 `*` |
| `DOCUMENT_PARSER_MODE` | `demo` 或 `real`。未设置时为演示解析 |

约束：

1. 只在 `.env.example` 中保留变量名；
2. 本地值写入不提交的 `.env`；
3. 不得使用真实生产密钥或内部服务地址；
4. DEMO 必须提供无需环境变量的本地降级路径（已实现）。

## 本次新增功能

- 功能名称：
- 入口页面：
- 入口位置：
- 是否新增路由：
- 主要交互：
- 使用的 mock 数据：
- 备注：

## 验证

```bash
pnpm run check
pnpm run dev
```

启动后至少检查：登录页、项目列表、客户列表、项目详情、牵引车管理和挂车管理。

当前项目阶段、项目状态、客户类型、车辆可租状态及角色视角均有对应 DEMO 数据，详见 `docs/DEMO数据覆盖说明.md`。

## 外发安全说明

本交付包已排除原项目的 Git 历史、部署配置、完整需求资料、构建产物和本地缓存。原型中疑似来源于内部库存表的车辆标识、企业主体及融资字段已替换为虚构 DEMO 数据。详见 `SECURITY-NOTICE.md`。
