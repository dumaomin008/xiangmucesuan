import { fail, ok } from "@/lib/api";
import { getWorkspace } from "@/lib/services/ai-workspace";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    return ok(await getWorkspace(id));
  } catch (err) {
    return fail(err);
  }
}
