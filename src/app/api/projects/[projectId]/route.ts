import { prisma } from "@/lib/db";
import { actorFrom, fail, ok } from "@/lib/api";
import { canEdit } from "@/lib/auth";
import { EngineError } from "@/lib/engine/decimal";
import { readJson } from "@/lib/guards";

export async function GET(_req: Request, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await params;
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) return fail(new EngineError("NOT_FOUND", "project", "项目不存在"));
    return ok(project);
  } catch (err) {
    return fail(err);
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ projectId: string }> }) {
  return updateProject(req, params);
}

export async function PATCH(req: Request, { params }: { params: Promise<{ projectId: string }> }) {
  return updateProject(req, params);
}

async function updateProject(req: Request, params: Promise<{ projectId: string }>) {
  try {
    const { projectId } = await params;
    const { role, actor } = actorFrom(req);
    if (!canEdit(role)) return fail(new EngineError("FORBIDDEN", "role", "当前角色不能编辑项目"), 403);
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) return fail(new EngineError("NOT_FOUND", "project", "项目不存在"));
    const body = await readJson(req);
    const updated = await prisma.project.update({
      where: { id: projectId },
      data: {
        projectName: body.projectName != null ? String(body.projectName) : project.projectName,
        customerName: body.customerName != null ? String(body.customerName) : project.customerName,
        projectManager: body.projectManager != null ? String(body.projectManager) : project.projectManager,
        projectStatus: body.projectStatus != null ? String(body.projectStatus) : project.projectStatus,
        startDate: body.startDate != null ? (body.startDate ? new Date(String(body.startDate)) : null) : project.startDate,
        endDate: body.endDate != null ? (body.endDate ? new Date(String(body.endDate)) : null) : project.endDate,
      },
    });
    await prisma.auditLog.create({
      data: {
        action: "UPDATE_PROJECT",
        entityType: "Project",
        entityId: projectId,
        actor,
        detailJson: JSON.stringify({ keys: Object.keys(body) }),
      },
    });
    return ok(updated);
  } catch (err) {
    return fail(err);
  }
}
