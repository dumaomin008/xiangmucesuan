import { prisma } from "@/lib/db";
import { fail, ok } from "@/lib/api";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const latest = await prisma.calculationResult.findFirst({
      where: { schemeId: id },
      orderBy: { calculatedAt: "desc" },
    });
    if (!latest) return ok([]);
    const rows = await prisma.cashFlowResult.findMany({
      where: { schemeId: id, snapshotId: latest.snapshotId },
      orderBy: { monthIndex: "asc" },
    });
    return ok(rows);
  } catch (err) {
    return fail(err);
  }
}
