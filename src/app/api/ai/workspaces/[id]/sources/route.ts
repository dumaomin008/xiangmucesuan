import { actorFrom, fail, ok } from "@/lib/api";
import { canEdit } from "@/lib/auth";
import { EngineError } from "@/lib/engine/decimal";
import { readJson } from "@/lib/guards";
import { addSource } from "@/lib/services/ai-workspace";
import type { SourceType } from "@/lib/ai/schema/types";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { role, actor } = actorFrom(req);
    if (!canEdit(role)) return fail(new EngineError("FORBIDDEN", "role", "当前角色不能上传资料"), 403);
    const body = await readJson(req);
    const doc = await addSource(id, actor, {
      sourceType: (body.sourceType as SourceType) || "free_text",
      fileName: body.fileName != null ? String(body.fileName) : null,
      mimeType: body.mimeType != null ? String(body.mimeType) : null,
      text: body.text != null ? String(body.text) : null,
    });
    return ok(doc, 201);
  } catch (err) {
    return fail(err);
  }
}
