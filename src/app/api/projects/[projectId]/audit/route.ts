import { prisma } from "@/lib/db";
import { fail, ok } from "@/lib/api";

export async function GET(_req: Request, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await params;
    const logs = await prisma.auditLog.findMany({
      where: {
        OR: [
          { entityId: projectId },
          {
            entityId: {
              in: (
                await prisma.calculationScheme.findMany({ where: { projectId }, select: { id: true } })
              ).map((s) => s.id),
            },
          },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return ok(logs);
  } catch (err) {
    return fail(err);
  }
}
