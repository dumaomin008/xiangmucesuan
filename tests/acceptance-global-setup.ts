import { initAcceptanceDatabase } from "../scripts/init-acceptance-db";

export default async function globalSetup() {
  const databaseUrl = initAcceptanceDatabase();
  process.env.DATABASE_URL = databaseUrl;
}
