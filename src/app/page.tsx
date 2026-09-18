"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Character } from "@/components/empty";
import { PageCanvas } from "@/components/shell/app-shell";
import { Button, Card, Field, TextArea, TextInput } from "@/components/ui";
import { api, getDemoUser } from "@/lib/client";
import { formatDateTime, formatMoney, formatPercent } from "@/lib/format";
import { schemeStatusLabel } from "@/lib/workspace/types";

type ProjectRow = {
  id: string;
  projectCode: string;
  projectName: string;
  customerName: string;
  projectManager: string;
  projectStatus: string;
  schemeCount: number;
  currentSchemeId: string | null;
  currentSchemeName: string | null;
  currentSchemeStatus: string | null;
  baselineSchemeName: string | null;
  baselineProfit: string | null;
  baselineMargin: string | null;
  updatedAt: string;
};

export default function HomePage() {
  const router = useRouter();
  const [rows, setRows] = useState<ProjectRow[]>([]);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState("");
  const [aiText, setAiText] = useState("");
  const [form, setForm] = useState({
    projectName: "",
    projectCode: "",
    customerName: "",
    projectManager: "",
  });

  const load = () =>
    api<ProjectRow[]>("/api/projects")
      .then(setRows)
      .catch((e) => setError(e.message));

  useEffect(() => {
    load();
  }, []);

  const createProject = async (thenScheme: boolean) => {
    setBusy("manual");
    setError("");
    try {
      const created = await api<{ id: string }>("/api/projects", {
        method: "POST",
        body: JSON.stringify({
          projectName: form.projectName,
          projectCode: form.projectCode || undefined,
          customerName: form.customerName,
          projectManager: form.projectManager,
          projectStatus: "测算中",
        }),
      });
      if (thenScheme) {
        const scheme = await api<{ id: string }>(`/api/projects/${created.id}/calculation-schemes`, {
          method: "POST",
          body: JSON.stringify({ schemeName: "新测算方案", fleetSize: 20, calculationYears: 5 }),
        });
        router.push(`/projects/${created.id}/calculation/${scheme.id}`);
      } else {
        router.push(`/projects/${created.id}/calculation`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "新建项目失败");
    } finally {
      setBusy("");
    }
  };

  const aiCreate = async (file?: { name: string; mime: string; base64: string }) => {
    setBusy("ai");
    setError("");
    try {
      const name = aiText.trim().slice(0, 24) || "AI 测算项目";
      const created = await api<{ id: string }>("/api/projects", {
        method: "POST",
        body: JSON.stringify({
          projectName: name,
          customerName: "待确认",
          projectManager: getDemoUser(),
          projectStatus: "测算中",
        }),
      });
      const workspace = await api<{ id: string }>(`/api/projects/${created.id}/ai/workspaces`, {
        method: "POST",
        body: JSON.stringify({ createMode: "AI_IMPORT", title: name }),
      });
      if (aiText.trim() || file) {
        await api(`/api/ai/workspaces/${workspace.id}/sources`, {
          method: "POST",
          body: JSON.stringify(
            file
              ? { sourceType: "pdf", fileName: file.name, mimeType: file.mime, fileBase64: file.base64, text: aiText }
              : { sourceType: "free_text", text: aiText },
          ),
        });
        await api(`/api/ai/workspaces/${workspace.id}/parse`, { method: "POST" }).catch(() => undefined);
      }
      router.push(`/projects/${created.id}/ai/${workspace.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "AI 创建失败，可改为手动新建测算");
    } finally {
      setBusy("");
    }
  };

  return (
    <PageCanvas>
      <div className="mb-8 flex items-end justify-between gap-6">
        <div>
          <p className="text-[13px] font-medium tracking-[0.04em] text-sn-muted">WORKBENCH</p>
          <h1 className="mt-2 text-[30px] font-bold tracking-[-0.01em]">今天要测算什么项目？</h1>
          <p className="mt-2 max-w-2xl text-[15px] text-sn-secondary">
            AI 负责读资料、提参数；车辆数、成本、利润仍由确定性计算引擎给出。
          </p>
        </div>
        <Character mood="welcome" />
      </div>

      {error && <p className="mb-4 text-sn-error">{error}</p>}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_360px]">
        <Card>
          <h2 className="text-[20px] font-semibold">AI 创建项目</h2>
          <p className="mt-1 text-[13px] text-sn-secondary">描述项目情况，或上传 PDF / Excel / Word。提取结果可改，确认后才写入测算参数。</p>
          <TextArea
            className="mt-4 min-h-[140px]"
            placeholder="例如：云南某钢材运输项目，年运量 120 万吨，单程 42km，使用新能源重卡……"
            value={aiText}
            onChange={(e) => setAiText(e.target.value)}
          />
          <div className="mt-4 flex flex-wrap gap-3">
            <Button disabled={busy !== "" || !aiText.trim()} onClick={() => aiCreate()}>
              {busy === "ai" ? "AI 正在分析…" : "AI 开始分析"}
            </Button>
            <label className="inline-flex cursor-pointer items-center rounded-sn-md border border-black/10 bg-white px-4 py-3 text-[14px] font-semibold">
              上传资料
              <input
                type="file"
                className="hidden"
                accept=".pdf,.xlsx,.xls,.docx,.doc,.png,.jpg,.jpeg,.txt"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const buf = await file.arrayBuffer();
                  const bytes = new Uint8Array(buf);
                  let binary = "";
                  bytes.forEach((b) => {
                    binary += String.fromCharCode(b);
                  });
                  await aiCreate({ name: file.name, mime: file.type, base64: btoa(binary) });
                }}
              />
            </label>
          </div>
        </Card>
        <Card className="flex flex-col justify-between">
          <div>
            <h2 className="text-[20px] font-semibold">手动新建</h2>
            <p className="mt-2 text-[14px] leading-6 text-sn-secondary">已经清楚线路和运价时，直接进入五步测算。</p>
          </div>
          <div className="mt-6 flex flex-col gap-3">
            <Button onClick={() => setCreating(true)}>+ 手动新建测算</Button>
            <Button variant="secondary" onClick={() => setCreating(true)}>
              新建项目
            </Button>
          </div>
        </Card>
      </div>

      {creating && (
        <Card className="mt-5">
          <h2 className="mb-4 text-[20px] font-semibold">新建项目</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="项目名称" required>
              <TextInput value={form.projectName} onChange={(e) => setForm({ ...form, projectName: e.target.value })} />
            </Field>
            <Field label="项目编号" hint="可留空，系统自动生成">
              <TextInput value={form.projectCode} onChange={(e) => setForm({ ...form, projectCode: e.target.value })} />
            </Field>
            <Field label="客户名称" required>
              <TextInput value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} />
            </Field>
            <Field label="项目经理" required>
              <TextInput value={form.projectManager} onChange={(e) => setForm({ ...form, projectManager: e.target.value })} />
            </Field>
          </div>
          <div className="mt-5 flex gap-3">
            <Button disabled={busy !== ""} onClick={() => createProject(false)}>
              {busy === "manual" ? "创建中…" : "创建并进入测算"}
            </Button>
            <Button variant="secondary" disabled={busy !== ""} onClick={() => createProject(true)}>
              创建并开始填报
            </Button>
            <Button variant="ghost" onClick={() => setCreating(false)}>
              取消
            </Button>
          </div>
        </Card>
      )}

      <h2 className="mb-4 mt-10 text-[22px] font-semibold">最近项目</h2>
      {rows.length === 0 ? (
        <Card className="flex items-center gap-6">
          <Character mood="empty" />
          <div>
            <h3 className="text-[22px] font-semibold">还没有项目</h3>
            <p className="mt-2 text-sn-secondary">先描述项目或手动新建，再进入运输场景。</p>
            <Button className="mt-4" onClick={() => setCreating(true)}>
              新建项目
            </Button>
          </div>
        </Card>
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="min-w-full text-left text-[14px]">
            <thead className="text-[12px] uppercase tracking-[0.04em] text-sn-muted">
              <tr>
                {["项目名称", "当前状态", "当前方案", "核心结果", "更新时间", "操作"].map((h) => (
                  <th key={h} className="px-4 py-4 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id} className="border-t border-black/[0.04]">
                  <td className="px-4 py-4">
                    <div className="font-semibold">{p.projectName}</div>
                    <div className="text-[12px] text-sn-muted">{p.projectCode} · {p.customerName}</div>
                  </td>
                  <td className="px-4 py-4">{schemeStatusLabel(p.currentSchemeStatus) || p.projectStatus}</td>
                  <td className="px-4 py-4">{p.currentSchemeName || "尚未创建方案"}</td>
                  <td className="px-4 py-4">
                    {p.baselineProfit ? `${formatMoney(p.baselineProfit)} / ${p.baselineMargin ? formatPercent(p.baselineMargin) : "—"}` : "—"}
                  </td>
                  <td className="px-4 py-4">{formatDateTime(p.updatedAt)}</td>
                  <td className="px-4 py-4">
                    <div className="flex flex-wrap gap-3">
                      <Link className="text-sn-info" href={`/projects/${p.id}/calculation`}>
                        继续测算
                      </Link>
                      {p.currentSchemeId && p.currentSchemeStatus && p.currentSchemeStatus !== "draft" && (
                        <Link className="text-sn-info" href={`/projects/${p.id}/calculation/${p.currentSchemeId}/results`}>
                          查看结果
                        </Link>
                      )}
                      <Link className="text-sn-secondary" href={`/projects/${p.id}`}>
                        更多
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </PageCanvas>
  );
}
