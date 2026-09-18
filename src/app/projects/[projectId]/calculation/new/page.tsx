"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { Character } from "@/components/empty";
import { Button, Card, PageHeader } from "@/components/ui";
import { api } from "@/lib/client";

export default function NewCalculationPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "操作失败");
    } finally {
      setBusy("");
    }
  };

  return (
    <div>
      <PageHeader
        title="新建测算"
        subtitle="AI 负责理解资料，测算引擎负责算数。推荐从尽调资料开始，降低填写门槛。"
        actions={
          <Link href={`/projects/${projectId}/calculation`} className="text-[14px] text-sn-secondary">
            返回方案列表
          </Link>
        }
      />
      {error && <div className="mb-4 rounded-sn-md bg-sn-error/12 px-4 py-3 text-sm text-[#C44747]">{error}</div>}
      <div className="grid gap-5 lg:grid-cols-3">
        <Card hover className="relative overflow-hidden">
          <span className="absolute right-5 top-5 rounded-full bg-sn-primary px-3 py-1 text-[11px] font-medium text-white">推荐</span>
          <Character mood="welcome" />
          <h2 className="mt-2 text-[22px] font-semibold">AI 导入资料</h2>
          <p className="mt-2 text-[15px] leading-6 text-sn-secondary">
            上传尽调模板或粘贴纪要/聊天记录。系统抽取线路和参数，标出来源与缺失项，确认后再调用测算引擎。
          </p>
          <Button
            className="mt-6 w-full"
            disabled={busy !== ""}
            onClick={() =>
              run("ai", async () => {
                const created = await api<{ id: string }>(`/api/projects/${projectId}/ai/workspaces`, {
                  method: "POST",
                  body: JSON.stringify({ createMode: "AI_IMPORT" }),
                });
                router.push(`/projects/${projectId}/ai/${created.id}`);
              })
            }
          >
            开始 AI 导入
          </Button>
        </Card>
        <Card hover>
          <Character mood="idle" />
          <h2 className="mt-2 text-[22px] font-semibold">手动填写</h2>
          <p className="mt-2 text-[15px] leading-6 text-sn-secondary">
            直接进入现有参数配置页。适合已经清楚线路、运价和车队口径的项目经理。
          </p>
          <Button
            variant="secondary"
            className="mt-6 w-full"
            disabled={busy !== ""}
            onClick={() =>
              run("manual", async () => {
                const created = await api<{ id: string }>(`/api/projects/${projectId}/calculation-schemes`, {
                  method: "POST",
                  body: JSON.stringify({ schemeName: "新测算方案", fleetSize: 20, calculationYears: 5 }),
                });
                router.push(`/projects/${projectId}/calculation/${created.id}`);
              })
            }
          >
            手动创建方案
          </Button>
        </Card>
        <Card hover>
          <Character mood="empty" />
          <h2 className="mt-2 text-[22px] font-semibold">复制历史测算</h2>
          <p className="mt-2 text-[15px] leading-6 text-sn-secondary">
            从已有方案复制参数后再改。正式/基准方案不会被覆盖，修改会生成新版本。
          </p>
          <Button variant="secondary" className="mt-6 w-full" onClick={() => router.push(`/projects/${projectId}/calculation`)}>
            去方案列表复制
          </Button>
        </Card>
      </div>
    </div>
  );
}
