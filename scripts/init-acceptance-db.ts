import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

export const ACCEPTANCE_PORT = 3110;
export const ACCEPTANCE_ORIGIN = `http://127.0.0.1:${ACCEPTANCE_PORT}`;

export function acceptanceDatabaseUrl() {
  const abs = path.resolve(process.cwd(), "prisma", "acceptance.db");
  return `file:${abs}`;
}

export function initAcceptanceDatabase() {
  const databaseUrl = acceptanceDatabaseUrl();
  const env = { ...process.env, DATABASE_URL: databaseUrl };
  const dbFile = path.resolve(process.cwd(), "prisma", "acceptance.db");
  for (const suffix of ["", "-journal", "-wal", "-shm"]) {
    const file = `${dbFile}${suffix}`;
    if (fs.existsSync(file)) fs.unlinkSync(file);
  }
  execSync("npx prisma db push", { stdio: "inherit", env });
  execSync("npx tsx scripts/acceptance-seed.ts", { stdio: "inherit", env });
  return databaseUrl;
}
