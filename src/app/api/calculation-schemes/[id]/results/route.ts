import { prisma } from "@/lib/db";
import { fail, ok } from "@/lib/api";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const result = await prisma.calculationResult.findFirst({
      where: { schemeId: id },
      include: { items: { orderBy: { sortNo: "asc" } } },
      orderBy: { calculatedAt: "desc" },
    });
    if (!result) return fail(new Error("尚未测算"), 404);
    return ok({
      ...result,
      payload: JSON.parse(result.payloadJson),
      items: result.items.map((item) => ({
        ...item,
        sourceParameterSnapshot: JSON.parse(item.sourceParameterSnapshot || "{}"),
      })),
    });
  } catch (err) {
    return fail(err);
  }
}
