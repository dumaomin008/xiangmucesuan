import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { writeAcceptanceReport } from "./acceptance-report";

const root = process.cwd();
const artifacts = path.join(root, "docs", "acceptance-artifacts");
fs.mkdirSync(artifacts, { recursive: true });

function run(command: string, opts: { allowFail?: boolean } = {}) {
  const result = spawnSync(command, {
    cwd: root,
    env: process.env,
    shell: true,
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
  });
  const log = `${result.stdout || ""}${result.stderr || ""}`;
  if (result.status !== 0 && !opts.allowFail) {
    console.error(log);
    console.error(`Command failed (${result.status}): ${command}`);
  }
  return { ok: result.status === 0, log, status: result.status ?? 1 };
}

console.log("1/5 Unit + Golden (vitest)");
const vitestFile = path.join(artifacts, "vitest.json");
const vitest = run(`npx vitest run --reporter=default --reporter=json --outputFile=${JSON.stringify(vitestFile)}`);

console.log("2/5 TypeCheck");
const typecheck = run("npx tsc --noEmit", { allowFail: true });
fs.writeFileSync(path.join(artifacts, "typecheck.log"), typecheck.log);

console.log("3/5 Build");
fs.rmSync(path.join(root, ".next"), { recursive: true, force: true });
const build = run("npm run build", { allowFail: true });
fs.writeFileSync(path.join(artifacts, "build.log"), build.log);

console.log("4/5 Playwright HTTP + E2E");
const playwright = build.ok
  ? run("npx playwright test", { allowFail: true })
  : { ok: false, log: "skipped: production build failed", status: 1 };
fs.writeFileSync(path.join(artifacts, "playwright-run.log"), playwright.log);

console.log("5/5 Acceptance report");
const report = writeAcceptanceReport({
  vitestFile,
  playwrightFile: path.join(artifacts, "playwright.json"),
  typecheck: { ok: typecheck.ok, log: typecheck.log },
  build: { ok: build.ok, log: build.log },
  outFile: path.join(root, "docs", "V1_TECHNICAL_ACCEPTANCE.md"),
});

console.log(report.conclusion);
if (!vitest.ok || !report.typeOk || !report.buildOk || !playwright.ok || report.failed > 0) {
  process.exit(1);
}
