"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Character } from "@/components/empty";
import { StatusPill } from "@/components/ai/status-pill";
import { Button, Card, Select, TextArea, TextInput } from "@/components/ui";
import { PageCanvas } from "@/components/shell/app-shell";
import { api } from "@/lib/client";
import { FREIGHT_UNIT_LABEL } from "@/lib/ai/schema/field-dictionary";

type Workspace = {
  id: string;
  title: string;
  status: string;
  schemeId: string | null;
  completeness: { p0Open: number; p1Open: number; p2Open: number; extracted: number; conflict: number };
  calculation_request: { ready: boolean; blocking_p0: string[]; routes_confirmed: boolean; blocking?: Array<{ field_code: string; name: string; reason: string }> };
  fallbackNotice: string | null;
  parseSummary: { routes: number; parameters: number; p0: number; conflicts: number; references: number } | null;
  extractorKind: string | null;
  documents: Array<{
    id: string;
    sourceType: string;
    fileName: string | null;
    contentText: string;
    parseStatus: string;
    parseMessage: string | null;
  }>;
  routes: Array<{
    id: string;
    route_name: string;
    origin_name: string;
    destination_name: string;
    distance_km: string | null;
    volume_value: string | null;
    volume_unit: string | null;
    trips_per_day: string | null;
    trips_per_vehicle_month: string | null;
    vehicle_count: string | null;
    cargo_name: string | null;
    freight_price: string | null;
    freight_price_unit: string | null;
    load_ton: string | null;
    status: string;
  }>;
  parameters: Array<{
    id?: string;
    field_code: string;
    value: string | null;
    status: string;
    source_type: string;
    source_ref: string | null;
    raw_value: string | null;
    route_id?: string | null;
    reference_meta: { source_level: string; suggested_value: string | null } | null;
  }>;
  conflicts: Array<{
    id: string;
    field_code: string;
    status: string;
    candidates: Array<{ value: string; source_ref: string | null; raw_value: string | null }>;
  }>;
  questions: Array<{
    id: string;
    priority: "P0" | "P1" | "P2";
    field_code: string;
    question: string;
    reason: string;
    impact_metrics: string[];
    has_reference: boolean;
    status: string;
  }>;
  reference_candidates: Array<{
    id: string;
    field_code: string;
    suggested_value: string | null;
    source_level: string;
    applicable_condition: string | null;
    status: string;
  }>;
};

const SOURCE_OPTIONS = [
  { value: "due_diligence", label: "尽调模板" },
  { value: "meeting", label: "会议纪要" },
  { value: "chat", label: "聊天内容" },
  { value: "free_text", label: "自由文本" },
];

export default function AiWorkspacePage() {
  const { projectId, workspaceId } = useParams<{ projectId: string; workspaceId: string }>();
  const router = useRouter();
  const [data, setData] = useState<Workspace | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [sourceType, setSourceType] = useState("free_text");
  const [text, setText] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [engineErrors, setEngineErrors] = useState<string[]>([]);
  const [parseStep, setParseStep] = useState(-1);

  const PARSE_STEPS = ["正在读取文件", "正在识别项目基本信息", "正在识别运输线路", "正在提取测算参数", "正在检查缺失与冲突", "正在生成尽调建议", "解析完成"];

  const load = async () => {
    const next = await api<Workspace>(`/api/ai/workspaces/${workspaceId}`);
    setData(next);
  };

  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [workspaceId]);

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

  const paramStatus = (field: string, routeId?: string) =>
    data?.parameters.find((item) => item.field_code === field && (item.route_id ?? undefined) === routeId)?.status ||
    (data?.routes.find((r) => r.id === routeId) ? "missing" : "missing");

  const canCalculate = useMemo(() => {
    if (!data) return false;
    return data.calculation_request.ready && data.conflicts.every((item) => item.status !== "open");
  }, [data]);

  if (!data) {
    return <p className="text-sn-secondary">{error || "正在打开草稿…"}</p>;
  }

  return (
    <PageCanvas wide>
      <div className="pb-28">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[13px] font-medium tracking-[0.04em] text-sn-muted">AI PROJECT INTAKE</p>
          <h1 className="mt-2 text-[30px] font-bold tracking-[-0.01em]">{data.title}</h1>
          <p className="mt-2 text-[15px] text-sn-secondary">AI 负责把尽调资料变成可计算参数。正式测算前必须确认线路，且 P0 不得缺失。核心数字仍由测算引擎计算。</p>
        </div>
        <StatusPill value={data.status} />
      </div>

      {error && <div className="mb-4 rounded-sn-md bg-sn-error/12 px-4 py-3 text-sm text-[#C44747]">{error}</div>}
      {data.fallbackNotice && (
        <div className="mb-4 rounded-sn-md bg-sn-warning/15 px-4 py-3 text-sm text-[#C47B12]">{data.fallbackNotice}</div>
      )}
      {data.parseSummary && (
        <div className="mb-4 rounded-sn-md bg-white px-4 py-3 text-sm text-sn-secondary shadow-sn-card">
          识别 {data.parseSummary.routes} 条线路，提取 {data.parseSummary.parameters} 个参数，{data.parseSummary.p0} 项需要确认，{data.parseSummary.conflicts} 项存在冲突，{data.parseSummary.references} 项可采用参考值。
          {data.extractorKind && <span className="ml-2"><StatusPill value={data.extractorKind} /></span>}
        </div>
      )}
      {engineErrors.length > 0 && (
        <div className="mb-4 rounded-sn-md bg-sn-warning/15 px-4 py-3 text-sm text-[#C47B12]">
          输入版本已生成，但测算引擎仍缺必要字段：{engineErrors.join("；")}。请在本页补全后重试，或进入手动参数页。核心数字不会由 AI 代算。
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[280px_minmax(0,1fr)_320px]">
        <Card className="h-fit">
          <h2 className="text-[18px] font-semibold">资料</h2>
          <p className="mt-1 text-[13px] text-sn-secondary">支持粘贴文本，以及上传 XLSX / DOCX / PDF。扫描件若无正文，可继续粘贴关键内容。</p>
          <div className="mt-4 space-y-3">
            <Select value={sourceType} onChange={(e) => setSourceType(e.target.value)}>
              {SOURCE_OPTIONS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </Select>
            <TextArea rows={8} value={text} onChange={(e) => setText(e.target.value)} placeholder="粘贴尽调结论、会议纪要或聊天记录…" />
            <input
              type="file"
              accept=".txt,.md,.pdf,.doc,.docx,.xls,.xlsx"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file) return;
                run("file", async () => {
                  const buffer = await file.arrayBuffer();
                  const bytes = new Uint8Array(buffer);
                  let binary = "";
                  bytes.forEach((b) => {
                    binary += String.fromCharCode(b);
                  });
                  await api(`/api/ai/workspaces/${workspaceId}/sources`, {
                    method: "POST",
                    body: JSON.stringify({
                      sourceType,
                      fileName: file.name,
                      mimeType: file.type,
                      fileBase64: btoa(binary),
                    }),
                  });
                  await load();
                });
              }}
            />
            <Button
              className="w-full"
              disabled={busy !== "" || !text.trim()}
              onClick={() =>
                run("source", async () => {
                  await api(`/api/ai/workspaces/${workspaceId}/sources`, {
                    method: "POST",
                    body: JSON.stringify({ sourceType, text, fileName: "粘贴文本.txt", mimeType: "text/plain" }),
                  });
                  setText("");
                  await load();
                })
              }
            >
              加入资料
            </Button>
          </div>
          <div className="mt-5 space-y-3">
            {data.documents.length === 0 && (
              <div className="rounded-sn-md bg-sn-subtle p-4 text-center">
                <Character mood="empty" />
                <p className="text-[13px] text-sn-secondary">还没有资料。先贴一段项目描述，再点解析。</p>
              </div>
            )}
            {data.documents.map((doc) => (
              <div key={doc.id} className="rounded-sn-md bg-sn-subtle p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <StatusPill value={doc.sourceType} />
                    <div className="mt-1 text-[13px] font-medium">{doc.fileName || "未命名资料"}</div>
                    <p className="mt-1 line-clamp-3 text-[12px] text-sn-muted">{doc.contentText || doc.parseMessage}</p>
                  </div>
                  <button
                    className="text-[12px] text-sn-error"
                    onClick={() =>
                      run("del", async () => {
                        await api(`/api/ai/workspaces/${workspaceId}/sources/${doc.id}`, { method: "DELETE" });
                        await load();
                      })
                    }
                  >
                    删除
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <div className="space-y-5">
          <Card>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-[18px] font-semibold">线路确认</h2>
              <div className="flex gap-2">
                <Button variant="ghost" disabled={busy !== ""} onClick={() => run("add", async () => setData(await api(`/api/ai/workspaces/${workspaceId}/routes`, { method: "POST", body: JSON.stringify({ action: "add" }) })))}>
                  新增
                </Button>
                <Button
                  variant="ghost"
                  disabled={selected.length < 2 || busy !== ""}
                  onClick={() =>
                    run("merge", async () => {
                      setData(await api(`/api/ai/workspaces/${workspaceId}/routes`, { method: "POST", body: JSON.stringify({ action: "merge", routeIds: selected }) }));
                      setSelected([]);
                    })
                  }
                >
                  合并所选
                </Button>
                <Button variant="secondary" disabled={busy !== ""} onClick={() => run("confirmRoutes", async () => setData(await api(`/api/ai/workspaces/${workspaceId}/routes`, { method: "POST", body: JSON.stringify({ action: "confirm_all" }) })))}>
                  确认全部线路
                </Button>
              </div>
            </div>
            {data.routes.length === 0 ? (
              <p className="text-[14px] text-sn-secondary">解析后会在这里生成可编辑线路表。未确认线路前，不能生成正式测算版本。</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-[13px]">
                  <thead className="text-[12px] uppercase tracking-[0.04em] text-sn-muted">
                    <tr>
                      {["", "线路", "起点", "终点", "里程km", "日运量", "运价", "单位", "车辆", "载重", "月趟数", "状态", ""].map((h) => (
                        <th key={h} className="px-2 py-2 font-medium">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.routes.map((route) => (
                      <tr key={route.id} className="border-t border-black/[0.04] align-top">
                        <td className="px-2 py-2">
                          <input type="checkbox" checked={selected.includes(route.id)} onChange={() => setSelected((prev) => (prev.includes(route.id) ? prev.filter((id) => id !== route.id) : [...prev, route.id]))} />
                        </td>
                        <td className="px-2 py-2"><TextInput defaultValue={route.route_name} onBlur={(e) => patchRoute(route.id, { route_name: e.target.value })} /></td>
                        <td className="px-2 py-2">
                          <TextInput defaultValue={route.origin_name} onBlur={(e) => patchRoute(route.id, { origin_name: e.target.value })} />
                          <div className="mt-1"><StatusPill value={paramStatus("route.origin", route.id)} /></div>
                        </td>
                        <td className="px-2 py-2">
                          <TextInput defaultValue={route.destination_name} onBlur={(e) => patchRoute(route.id, { destination_name: e.target.value })} />
                          <div className="mt-1"><StatusPill value={paramStatus("route.destination", route.id)} /></div>
                        </td>
                        <td className="px-2 py-2">
                          <TextInput defaultValue={route.distance_km || ""} onBlur={(e) => patchRoute(route.id, { distance_km: e.target.value })} />
                          <div className="mt-1"><StatusPill value={paramStatus("route.distance_km", route.id)} /></div>
                        </td>
                        <td className="px-2 py-2">
                          <TextInput defaultValue={route.volume_value || ""} onBlur={(e) => patchRoute(route.id, { volume_value: e.target.value })} />
                          <div className="mt-1 text-[11px] text-sn-muted">{route.volume_unit || "吨/日"} · 不自动换算载重</div>
                        </td>
                        <td className="px-2 py-2">
                          <TextInput defaultValue={route.freight_price || ""} onBlur={(e) => patchRoute(route.id, { freight_price: e.target.value })} />
                          <div className="mt-1"><StatusPill value={paramStatus("revenue.freight_price", route.id)} /></div>
                        </td>
                        <td className="px-2 py-2">
                          <Select defaultValue={route.freight_price_unit || ""} onChange={(e) => patchRoute(route.id, { freight_price_unit: e.target.value })}>
                            <option value="">请选择</option>
                            {Object.entries(FREIGHT_UNIT_LABEL).map(([code, label]) => (
                              <option key={code} value={code}>{label}</option>
                            ))}
                          </Select>
                        </td>
                        <td className="px-2 py-2"><TextInput defaultValue={route.vehicle_count || ""} onBlur={(e) => patchRoute(route.id, { vehicle_count: e.target.value })} /></td>
                        <td className="px-2 py-2"><TextInput defaultValue={route.load_ton || ""} onBlur={(e) => patchRoute(route.id, { load_ton: e.target.value })} /></td>
                        <td className="px-2 py-2"><TextInput defaultValue={route.trips_per_vehicle_month || ""} onBlur={(e) => patchRoute(route.id, { trips_per_vehicle_month: e.target.value })} /></td>
                        <td className="px-2 py-2"><StatusPill value={route.status} /></td>
                        <td className="px-2 py-2">
                          <div className="flex flex-col gap-1">
                            <button className="text-sn-info" onClick={() => run("split", async () => setData(await api(`/api/ai/workspaces/${workspaceId}/routes/${route.id}`, { method: "POST" })))}>拆分</button>
                            <button className="text-sn-error" onClick={() => run("rm", async () => setData(await api(`/api/ai/workspaces/${workspaceId}/routes/${route.id}`, { method: "DELETE" })))}>删除</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card>
            <h2 className="text-[18px] font-semibold">字段来源</h2>
            <p className="mt-1 text-[13px] text-sn-secondary">原始值与标准化值同时保留。参考值不会被标成已确认。</p>
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-left text-[13px]">
                <thead className="text-[12px] text-sn-muted">
                  <tr>
                    {["字段", "值", "状态", "来源", "原文"].map((h) => (
                      <th key={h} className="px-2 py-2 font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.parameters.map((item) => (
                    <tr key={`${item.field_code}-${item.route_id || "p"}`} className="border-t border-black/[0.04]">
                      <td className="px-2 py-2">{item.field_code}</td>
                      <td className="px-2 py-2">{item.value || "—"}</td>
                      <td className="px-2 py-2"><StatusPill value={item.status} /></td>
                      <td className="px-2 py-2">{item.source_ref || item.source_type}</td>
                      <td className="px-2 py-2 text-sn-muted">{item.raw_value || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <h2 className="text-[18px] font-semibold">完整度</h2>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div>
                <div className="text-[12px] text-sn-muted">P0 未解决</div>
                <div className="mt-1 text-[28px] font-extrabold">{data.completeness.p0Open}</div>
              </div>
              <div>
                <div className="text-[12px] text-sn-muted">已提取字段</div>
                <div className="mt-1 text-[28px] font-extrabold">{data.completeness.extracted}</div>
              </div>
              <div>
                <div className="text-[12px] text-sn-muted">P1 / P2</div>
                <div className="mt-1 text-[18px] font-semibold">{data.completeness.p1Open} / {data.completeness.p2Open}</div>
              </div>
              <div>
                <div className="text-[12px] text-sn-muted">冲突</div>
                <div className="mt-1 text-[18px] font-semibold">{data.completeness.conflict}</div>
              </div>
            </div>
          </Card>

          {data.conflicts.filter((item) => item.status === "open").map((conflict) => (
            <Card key={conflict.id}>
              <h3 className="text-[16px] font-semibold">冲突 · {conflict.field_code}</h3>
              <p className="mt-1 text-[13px] text-sn-secondary">同一字段出现多个值，系统不会自动覆盖。</p>
              <div className="mt-3 space-y-2">
                {conflict.candidates.map((c) => (
                  <button
                    key={`${c.value}-${c.source_ref}`}
                    className="w-full rounded-sn-sm bg-sn-subtle px-3 py-2 text-left text-[13px]"
                    onClick={() => run("conflict", async () => setData(await api(`/api/ai/workspaces/${workspaceId}/conflicts/${conflict.id}`, { method: "POST", body: JSON.stringify({ value: c.value }) })))}
                  >
                    采用 {c.value}
                    <span className="mt-1 block text-[12px] text-sn-muted">{c.source_ref} · {c.raw_value}</span>
                  </button>
                ))}
              </div>
            </Card>
          ))}

          <Card>
            <h2 className="text-[18px] font-semibold">待确认问题</h2>
            <div className="mt-3 space-y-3">
              {data.questions.filter((q) => q.status === "open").length === 0 && (
                <p className="text-[13px] text-sn-secondary">当前没有未处理问题。</p>
              )}
              {data.questions
                .filter((q) => q.status === "open")
                .map((q) => (
                  <div key={q.id} className="rounded-sn-md bg-sn-subtle p-3">
                    <div className="flex items-center gap-2">
                      <StatusPill value={q.priority} />
                      <span className="text-[13px] font-medium">{q.question}</span>
                    </div>
                    <p className="mt-1 text-[12px] text-sn-secondary">{q.reason}</p>
                    <p className="mt-1 text-[12px] text-sn-muted">影响：{q.impact_metrics.join("、") || "测算完整性"}</p>
                    <TextInput className="mt-2" value={answers[q.id] || ""} onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))} placeholder="填写实际值" />
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button className="text-[12px] text-sn-info" onClick={() => answer(q.id, "fill", answers[q.id])}>填写实际值</button>
                      <button className="text-[12px] text-sn-info" disabled={!q.has_reference} onClick={() => answer(q.id, "adopt_reference")}>采用参考值</button>
                      <button className="text-[12px] text-sn-secondary" disabled={q.priority === "P0"} onClick={() => answer(q.id, "skip")}>暂不确认</button>
                    </div>
                  </div>
                ))}
            </div>
          </Card>

          <Card>
            <h2 className="text-[18px] font-semibold">参考值</h2>
            <p className="mt-1 text-[13px] text-sn-secondary">演示参考值 / 系统默认必须醒目标识，不能伪装成当前项目事实。</p>
            <Button
              variant="ghost"
              className="mt-2 w-full"
              disabled={busy !== ""}
              onClick={() => run("refs", async () => setData(await api(`/api/ai/workspaces/${workspaceId}/references/adopt`, { method: "POST" })))}
            >
              采用全部允许参考值
            </Button>
            <div className="mt-3 space-y-2">
              {data.reference_candidates.length === 0 && <p className="text-[13px] text-sn-muted">暂无候选。</p>}
              {data.reference_candidates.map((item) => (
                <div key={item.id} className="rounded-sn-md bg-sn-subtle p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[13px]">{item.field_code}</span>
                    <StatusPill value={item.source_level} />
                  </div>
                  <div className="mt-1 text-[18px] font-semibold">{item.suggested_value || "—"}</div>
                  <p className="mt-1 text-[12px] text-sn-muted">{item.applicable_condition}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 border-t border-white/50 bg-white/72 px-6 py-4 backdrop-blur-[20px]">
        <div className="mx-auto flex max-w-[1280px] flex-wrap items-center justify-between gap-3">
          <div className="text-[13px] text-sn-secondary">
            {canCalculate
              ? "P0 已齐、线路已确认，可以提交测算引擎。"
              : `还缺 ${data.calculation_request.blocking?.length || data.completeness.p0Open} 项关键参数。线路${data.calculation_request.routes_confirmed ? "已确认" : "未确认"}。补齐前不会调用测算引擎。`}
            {!canCalculate && (data.calculation_request.blocking || []).length > 0 && (
              <span className="mt-1 block text-[12px] text-[#C44747]">
                {(data.calculation_request.blocking || []).slice(0, 6).map((item) => item.name).join("、")}
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" disabled={busy !== ""} onClick={() => run("draft", async () => {
              const res = await api<{ workspace: Workspace }>(`/api/ai/workspaces/${workspaceId}/confirm`, { method: "POST", body: JSON.stringify({ mode: "draft" }) });
              setData(res.workspace);
            })}>
              保存草稿
            </Button>
            <Button variant="secondary" disabled={busy !== "" || data.documents.length === 0} onClick={() => run("parse", async () => {
              setParseStep(0);
              const timer = window.setInterval(() => setParseStep((n) => Math.min(n + 1, PARSE_STEPS.length - 2)), 700);
              try {
                setData(await api(`/api/ai/workspaces/${workspaceId}/parse`, { method: "POST" }));
                setParseStep(PARSE_STEPS.length - 1);
              } finally {
                window.clearInterval(timer);
              }
            })}>
              {busy === "parse" ? PARSE_STEPS[Math.max(parseStep, 0)] : "开始 / 重新解析"}
            </Button>
            <Button
              disabled={busy !== "" || !canCalculate}
              title={!canCalculate ? "还缺关键参数，禁止正式测算" : undefined}
              onClick={() =>
                run("calc", async () => {
                  const res = await api<{ workspace: Workspace; calculated: boolean; schemeId: string; engineErrors: string[] }>(
                    `/api/ai/workspaces/${workspaceId}/confirm`,
                    { method: "POST", body: JSON.stringify({ mode: "calculate" }) },
                  );
                  setData(res.workspace);
                  setEngineErrors(res.engineErrors || []);
                  if (res.calculated) router.push(`/projects/${projectId}/ai/${workspaceId}/result`);
                  else if (res.schemeId) setError("输入版本已保存。请补全测算引擎仍缺的字段后再测算。");
                })
              }
            >
              确认并测算
            </Button>
          </div>
        </div>
      </div>
      </div>
    </PageCanvas>
  );

  async function patchRoute(routeId: string, patch: Record<string, string>) {
    await run("route", async () => {
      setData(await api(`/api/ai/workspaces/${workspaceId}/routes/${routeId}`, { method: "PATCH", body: JSON.stringify(patch) }));
    });
  }

  async function answer(questionId: string, action: "fill" | "adopt_reference" | "skip", value?: string) {
    await run("q", async () => {
      setData(await api(`/api/ai/workspaces/${workspaceId}/questions/${questionId}`, { method: "POST", body: JSON.stringify({ action, value }) }));
    });
  }
}
