import { prisma } from "@/lib/db";
import { fail, ok } from "@/lib/api";
import { EngineError } from "@/lib/engine/decimal";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const snapshotId = new URL(req.url).searchParams.get("snapshotId");
    const result = await prisma.calculationResult.findFirst({
      where: snapshotId ? { schemeId: id, snapshotId } : { schemeId: id },
      include: { items: { orderBy: { sortNo: "asc" } } },
      orderBy: { calculatedAt: "desc" },
    });
    if (!result) return fail(new EngineError("NOT_FOUND", "result", "尚未测算"));
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
