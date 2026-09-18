import { prisma } from "@/lib/db";
import { actorFrom, fail, ok } from "@/lib/api";
import { canEdit } from "@/lib/auth";
import { EngineError } from "@/lib/engine/decimal";
import { readJson } from "@/lib/guards";

export async function GET() {
  const projects = await prisma.project.findMany({
    include: {
      schemes: {
        include: {
          results: { orderBy: { calculatedAt: "desc" }, take: 1 },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
  const rows = projects.map((p) => {
    const baseline = p.schemes.find((s) => s.status === "baseline");
    const latestScheme = [...p.schemes].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0];
    const latest = (baseline ?? latestScheme)?.results[0];
    const displayScheme = baseline ?? latestScheme;
    return {
      id: p.id,
      projectCode: p.projectCode,
      projectName: p.projectName,
      customerName: p.customerName,
      projectManager: p.projectManager,
      projectStatus: p.projectStatus,
      startDate: p.startDate,
      endDate: p.endDate,
      updatedAt: p.updatedAt,
      schemeCount: p.schemes.length,
      currentSchemeId: displayScheme?.id ?? null,
      currentSchemeName: displayScheme ? `${displayScheme.schemeName} ${displayScheme.versionNo}` : null,
      currentSchemeStatus: displayScheme?.status ?? null,
      baselineSchemeName: baseline ? `${baseline.schemeName} ${baseline.versionNo}` : null,
      baselineProfit: latest?.monthlyProfit ?? null,
      baselineMargin: latest?.profitMargin ?? null,
      latestResultAt: latest?.calculatedAt ?? null,
    };
  });
  return ok(rows);
}

export async function POST(req: Request) {
  try {
    const { role, actor } = actorFrom(req);
    if (!canEdit(role)) return fail(new EngineError("FORBIDDEN", "role", "当前角色不能新建项目"), 403);
    const body = await readJson(req);
    const projectName = String(body.projectName || "").trim();
    const customerName = String(body.customerName || "").trim();
    const projectManager = String(body.projectManager || "").trim();
    if (!projectName) return fail(new EngineError("CALC_PARAMETER_INVALID", "projectName", "项目名称不能为空"));
    if (!customerName) return fail(new EngineError("CALC_PARAMETER_INVALID", "customerName", "客户名称不能为空"));
    if (!projectManager) return fail(new EngineError("CALC_PARAMETER_INVALID", "projectManager", "项目经理不能为空"));

    const projectCode =
      String(body.projectCode || "").trim() || `PRJ-${Date.now().toString(36).toUpperCase()}`;
    const exists = await prisma.project.findUnique({ where: { projectCode } });
    if (exists) return fail(new EngineError("CALC_PARAMETER_INVALID", "projectCode", "项目编号已存在"));

    const project = await prisma.project.create({
      data: {
        projectCode,
        projectName,
        customerName,
        projectManager,
        projectStatus: String(body.projectStatus || "测算中"),
        startDate: body.startDate ? new Date(String(body.startDate)) : null,
        endDate: body.endDate ? new Date(String(body.endDate)) : null,
      },
    });
    await prisma.auditLog.create({
      data: {
        action: "CREATE_PROJECT",
        entityType: "Project",
        entityId: project.id,
        actor,
        detailJson: JSON.stringify({ projectCode, projectName }),
      },
    });
    return ok(project, 201);
  } catch (err) {
    return fail(err);
  }
}
