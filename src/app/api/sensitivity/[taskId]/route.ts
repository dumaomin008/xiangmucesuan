import { prisma } from "@/lib/db";
import { fail, ok } from "@/lib/api";
import { EngineError } from "@/lib/engine/decimal";

export async function GET(_req: Request, { params }: { params: Promise<{ taskId: string }> }) {
  try {
    const { taskId } = await params;
    const task = await prisma.sensitivityTask.findUnique({
      where: { id: taskId },
      include: { results: true },
    });
    if (!task) return fail(new EngineError("NOT_FOUND", "task", "任务不存在"));
    return ok(task);
  } catch (err) {
    return fail(err);
  }
}
