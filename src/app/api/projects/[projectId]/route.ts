import { prisma } from "@/lib/db";
import { fail, ok } from "@/lib/api";

export async function GET(_req: Request, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await params;
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) return fail(new Error("项目不存在"), 404);
    return ok(project);
  } catch (err) {
    return fail(err);
  }
}
