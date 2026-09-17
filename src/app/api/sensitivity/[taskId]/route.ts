import { prisma } from "@/lib/db";
import { fail, ok } from "@/lib/api";

export async function GET(_req: Request, { params }: { params: Promise<{ taskId: string }> }) {
  try {
    const { taskId } = await params;
    const task = await prisma.sensitivityTask.findUnique({
      where: { id: taskId },
      include: { results: true },
    });
    if (!task) return fail(new Error("任务不存在"), 404);
    return ok(task);
  } catch (err) {
    return fail(err);
  }
}
