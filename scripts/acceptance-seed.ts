import { PrismaClient } from "@prisma/client";
import { seedCatalog } from "../prisma/seed-catalog";

const prisma = new PrismaClient();

async function main() {
  await seedCatalog(prisma);
  console.log("Acceptance catalog seeded.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
