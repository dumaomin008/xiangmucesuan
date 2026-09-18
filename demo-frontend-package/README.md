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
| `DEMO_AI_API_KEY` | 仅服务端；未配置时返回 `AI_NOT_CONFIGURED`，前端自动用本地解读 |
| `DEMO_AI_BASE_URL` | 默认 `https://api.openai.com/v1` |
| `DEMO_AI_MODEL` | 默认 `gpt-4o-mini` |

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
