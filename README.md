# 项目测算 V1

Next.js 15 + Prisma/SQLite 经营测算工具。

## 本地开发

```bash
npm install
npx prisma db push
npx prisma db seed
npm run dev
```

开发库使用 `.env` 中的 `DATABASE_URL`（默认 `file:./dev.db`）。**不要**把开发库用于自动化验收。

## 自动化验收

无人业务 UAT 时，用独立测试库跑：

```text
Excel Golden + Unit + HTTP API + Browser E2E + 8 个标准场景
```

```bash
npm install
npx playwright install chromium
npm run test:acceptance
```

这条命令会：

1. 跑 Vitest（Unit / Golden）
2. `tsc --noEmit`
3. `next build`
4. 重置 `prisma/acceptance.db` 并只种规则/标准库
5. `next start -p 3110` 后跑真实 HTTP 与 Playwright 浏览器
6. 写出 `docs/V1_TECHNICAL_ACCEPTANCE.md`

拆开执行：

```bash
npm run test
npm run test:db:init
npm run build
npm run test:integration
npm run test:e2e
```

CI 若不方便起完整 Server，至少在 README 所在环境按上面步骤跑 `test:acceptance`。验收结论只允许：

```text
V1 TECHNICAL ACCEPTANCE PASSED
```

或

```text
V1 TECHNICAL ACCEPTANCE FAILED
```
