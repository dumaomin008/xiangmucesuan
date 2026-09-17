import { prisma } from "@/lib/db";
import { fail, ok } from "@/lib/api";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const versions = await prisma.calculationSchemeVersion.findMany({
      where: { schemeId: id },
      orderBy: { createdAt: "desc" },
    });
    const related = await prisma.calculationScheme.findMany({
      where: { OR: [{ id }, { sourceSchemeId: id }, { parentVersionId: id }] },
      orderBy: { createdAt: "desc" },
    });
    return ok({ versions, related });
  } catch (err) {
    return fail(err);
  }
}
