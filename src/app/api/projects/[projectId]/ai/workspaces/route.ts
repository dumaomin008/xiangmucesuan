import { actorFrom, fail, ok } from "@/lib/api";
import { canEdit } from "@/lib/auth";
import { EngineError } from "@/lib/engine/decimal";
import { readJson } from "@/lib/guards";
import { createWorkspace, listWorkspaces } from "@/lib/services/ai-workspace";
import type { CreateMode } from "@/lib/ai/schema/types";

export async function GET(_req: Request, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await params;
    return ok(await listWorkspaces(projectId));
  } catch (err) {
    return fail(err);
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await params;
    const { role, actor } = actorFrom(req);
    if (!canEdit(role)) return fail(new EngineError("FORBIDDEN", "role", "当前角色不能创建 AI 测算"), 403);
    const body = await readJson(req);
    const workspace = await createWorkspace(projectId, actor, {
      title: body.title != null ? String(body.title) : undefined,
      createMode: (body.createMode as CreateMode) || "AI_IMPORT",
    });
    return ok(workspace, 201);
  } catch (err) {
    return fail(err);
  }
}
