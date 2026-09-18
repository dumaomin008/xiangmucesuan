"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { EmptyState } from "@/components/empty";
import { Button, Card, PageHeader } from "@/components/ui";
import { PageCanvas } from "@/components/shell/app-shell";
import { StatusPill } from "@/components/ai/status-pill";
import { api } from "@/lib/client";
import { formatDateTime } from "@/lib/format";

type WorkspaceRow = {
  id: string;
  title: string;
  status: string;
  schemeId: string | null;
  documentCount: number;
  routeCount: number;
  p0Open: number;
  updatedAt: string;
  createdBy: string;
};

export default function AiWorkspaceListPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const router = useRouter();
  const [rows, setRows] = useState<WorkspaceRow[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = () =>
    api<WorkspaceRow[]>(`/api/projects/${projectId}/ai/workspaces`)
      .then(setRows)
      .catch((e) => setError(e.message));

  useEffect(() => {
    load();
  }, [projectId]);

  return (
    <PageCanvas>
      <PageHeader
        title="AI 智能测算"
        subtitle="把尽调资料变成可审阅的标准测算草稿。核心数字仍由测算引擎计算。"
        actions={
          <Button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                const created = await api<{ id: string }>(`/api/projects/${projectId}/ai/workspaces`, {
                  method: "POST",
                  body: JSON.stringify({ createMode: "AI_IMPORT" }),
                });
                router.push(`/projects/${projectId}/ai/${created.id}`);
              } catch (e) {
                setError(e instanceof Error ? e.message : "创建失败");
              } finally {
                setBusy(false);
              }
            }}
          >
            新建 AI 导入
          </Button>
        }
      />
      {error && <div className="mb-4 rounded-sn-md bg-sn-error/12 px-4 py-3 text-sm text-[#C44747]">{error}</div>}
      {rows.length === 0 ? (
        <Card>
          <EmptyState
            title="还没有 AI 测算草稿"
            body="上传尽调资料或粘贴会议纪要，系统会整理成线路表和待确认问题，不会静默补全运价或起终点。"
            action={
              <Button onClick={() => router.push(`/projects/${projectId}/calculation/new`)}>从新建测算开始</Button>
            }
          />
        </Card>
      ) : (
        <div className="grid gap-4">
          {rows.map((row) => (
            <Link key={row.id} href={`/projects/${projectId}/ai/${row.id}`}>
              <Card hover>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-[20px] font-semibold">{row.title}</h2>
                    <p className="mt-1 text-[13px] text-sn-secondary">
                      {row.documentCount} 份资料 · {row.routeCount} 条线路 · {row.createdBy} · {formatDateTime(row.updatedAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusPill value={row.status} />
                    {row.p0Open > 0 && <StatusPill value="P0" />}
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </PageCanvas>
  );
}
