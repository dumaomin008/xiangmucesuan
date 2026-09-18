"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { CalculationSubnav } from "@/components/nav";
import { EmptyState } from "@/components/empty";
import { PageCanvas } from "@/components/shell/app-shell";
import { Button, Card, PageHeader, StatusBadge } from "@/components/ui";
import { api } from "@/lib/client";
import { formatDateTime, formatMoney, formatPercent } from "@/lib/format";

type Scheme = {
  id: string;
  schemeName: string;
  versionNo: string;
  status: string;
  fleetSize: number;
  routeCount: number;
  monthlyRevenue: string | null;
  monthlyTotalCost: string | null;
  monthlyProfit: string | null;
  profitMargin: string | null;
  irr: string | null;
  createdBy: string;
  updatedAt: string;
  lastCalculatedAt: string | null;
};

type Project = {
  projectName: string;
  projectCode: string;
  customerName: string;
};

export default function SchemeListPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [schemes, setSchemes] = useState<Scheme[]>([]);
  const [copyId, setCopyId] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const load = async () => {
    const [p, s] = await Promise.all([
      api<Project>(`/api/projects/${projectId}`),
      api<Scheme[]>(`/api/projects/${projectId}/calculation-schemes`),
    ]);
    setProject(p);
    setSchemes(s);
  };

  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [projectId]);

  const baseline = useMemo(() => schemes.find((s) => s.status === "baseline"), [schemes]);

  const run = async (id: string, fn: () => Promise<void>) => {
    setBusy(id);
    setError("");
    try {
      await fn();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "操作失败");
    } finally {
      setBusy("");
    }
  };

  return (
    <PageCanvas wide>
      <CalculationSubnav projectId={projectId} />
      <PageHeader
        title="测算方案"
        subtitle={project ? `${project.projectName} · ${project.projectCode} · ${project.customerName}` : ""}
        actions={
          <>
            <Button
              variant="secondary"
              disabled={!copyId}
              onClick={() =>
                run(copyId, async () => {
                  const created = await api<{ id: string }>(`/api/calculation-schemes/${copyId}/copy`, {
                    method: "POST",
                    body: JSON.stringify({}),
                  });
                  router.push(`/projects/${projectId}/calculation/${created.id}`);
                })
              }
            >
              从已有方案复制
            </Button>
            <Button onClick={() => router.push(`/projects/${projectId}/calculation/new`)}>
              新建测算
            </Button>
          </>
        }
      />

      <div className="mb-6 grid gap-4 md:grid-cols-4">
        <Card>
          <div className="text-[13px] text-sn-muted">当前基准方案</div>
          <div className="mt-2 text-[18px] font-semibold">{baseline ? `${baseline.schemeName} ${baseline.versionNo}` : "未设置"}</div>
        </Card>
        <Card>
          <div className="text-[13px] text-sn-muted">基准方案预计利润</div>
          <div className="mt-2 text-[28px] font-extrabold tracking-[-0.02em]">{formatMoney(baseline?.monthlyProfit)}</div>
        </Card>
        <Card>
          <div className="text-[13px] text-sn-muted">基准利润率</div>
          <div className="mt-2 text-[28px] font-extrabold tracking-[-0.02em]">{baseline?.profitMargin ? formatPercent(baseline.profitMargin) : "—"}</div>
        </Card>
        <Card>
          <div className="text-[13px] text-sn-muted">最近测算时间</div>
          <div className="mt-2 text-[18px] font-semibold">{formatDateTime(baseline?.lastCalculatedAt || schemes[0]?.lastCalculatedAt)}</div>
        </Card>
      </div>

      {error && (
        <div className="mb-4 rounded-sn-md bg-sn-error/12 px-4 py-3 text-sm text-[#C44747]">{error}</div>
      )}

      {schemes.length === 0 ? (
        <Card>
          <EmptyState
            title="还没有测算方案"
            body="从一条线路、一个车队规模开始。保存草稿随时可回，正式测算才会冻结参数快照。"
            action={<Button onClick={() => router.push(`/projects/${projectId}/calculation/new`)}>新建测算</Button>}
          />
        </Card>
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="min-w-full text-left text-[14px]">
            <thead className="text-[12px] uppercase tracking-[0.04em] text-sn-muted">
              <tr>
                {["方案名称", "版本", "状态", "线路数", "车辆数", "月营收", "月总成本", "月利润", "利润率", "IRR", "创建人", "更新时间", "操作"].map((h) => (
                  <th key={h} className="px-4 py-4 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {schemes.map((s) => (
                <tr key={s.id} className="border-t border-black/[0.04]">
                  <td className="px-4 py-4">
                    <label className="flex items-center gap-2">
                      <input type="radio" name="copy" checked={copyId === s.id} onChange={() => setCopyId(s.id)} />
                      <span className="font-semibold">{s.schemeName}</span>
                    </label>
                  </td>
                  <td className="px-4 py-4">{s.versionNo}</td>
                  <td className="px-4 py-4">
                    <StatusBadge status={s.status} />
                  </td>
                  <td className="px-4 py-4">{s.routeCount}</td>
                  <td className="px-4 py-4">{s.fleetSize}</td>
                  <td className="px-4 py-4">{formatMoney(s.monthlyRevenue)}</td>
                  <td className="px-4 py-4">{formatMoney(s.monthlyTotalCost)}</td>
                  <td className="px-4 py-4">{formatMoney(s.monthlyProfit)}</td>
                  <td className="px-4 py-4">{s.profitMargin ? formatPercent(s.profitMargin) : "无法计算"}</td>
                  <td className="px-4 py-4">{s.irr ? formatPercent(s.irr) : "无法计算"}</td>
                  <td className="px-4 py-4">{s.createdBy}</td>
                  <td className="px-4 py-4">{formatDateTime(s.updatedAt)}</td>
                  <td className="px-4 py-4">
                    <div className="flex flex-wrap gap-2">
                      <Link className="text-sn-info" href={`/projects/${projectId}/calculation/${s.id}`}>
                        {s.status === "draft" ? "进入测算" : "查看参数"}
                      </Link>
                      {(s.status === "calculated" || s.status === "baseline") && (
                        <Link className="text-sn-info" href={`/projects/${projectId}/calculation/${s.id}/results`}>
                          查看结果
                        </Link>
                      )}
                      <button
                        className="text-sn-info"
                        disabled={busy === s.id}
                        onClick={() =>
                          run(s.id, async () => {
                            const created = await api<{ id: string }>(`/api/calculation-schemes/${s.id}/copy`, {
                              method: "POST",
                              body: JSON.stringify({ asNewVersion: s.status === "baseline" }),
                            });
                            router.push(`/projects/${projectId}/calculation/${created.id}`);
                          })
                        }
                      >
                        复制方案
                      </button>
                      {s.status === "calculated" && (
                        <button
                          className="text-sn-info"
                          disabled={busy === s.id}
                          onClick={() =>
                            run(s.id, async () => {
                              await api(`/api/calculation-schemes/${s.id}/set-baseline`, { method: "POST" });
                            })
                          }
                        >
                          设为基准
                        </button>
                      )}
                      {s.status !== "baseline" && s.status !== "archived" && (
                        <button
                          className="text-sn-secondary"
                          disabled={busy === s.id}
                          onClick={() =>
                            run(s.id, async () => {
                              await api(`/api/calculation-schemes/${s.id}/archive`, { method: "POST" });
                            })
                          }
                        >
                          归档
                        </button>
                      )}
                      {s.status === "draft" && (
                        <button
                          className="text-sn-error"
                          disabled={busy === s.id}
                          onClick={() =>
                            run(s.id, async () => {
                              await api(`/api/calculation-schemes/${s.id}`, { method: "DELETE" });
                            })
                          }
                        >
                          删除草稿
                        </button>
                      )}
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
