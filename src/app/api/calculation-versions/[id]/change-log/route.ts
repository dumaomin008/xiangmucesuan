import { prisma } from "@/lib/db";
import { fail, ok } from "@/lib/api";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const logs = await prisma.parameterChangeLog.findMany({
      where: { OR: [{ versionId: id }, { schemeId: id }] },
      orderBy: { changedAt: "desc" },
    });
    return ok(logs);
  } catch (err) {
    return fail(err);
  }
}
