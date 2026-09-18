"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PageCanvas } from "@/components/shell/app-shell";
import { Card, PageHeader } from "@/components/ui";
import { api } from "@/lib/client";
import { formatDateTime, formatMoney, formatPercent } from "@/lib/format";
import { schemeStatusLabel } from "@/lib/workspace/types";

type ProjectRow = {
  id: string;
  projectCode: string;
  projectName: string;
  customerName: string;
  currentSchemeName: string | null;
  currentSchemeStatus: string | null;
  baselineProfit: string | null;
  baselineMargin: string | null;
  updatedAt: string;
};

export default function HistoryPage() {
  const [rows, setRows] = useState<ProjectRow[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    api<ProjectRow[]>("/api/projects")
      .then(setRows)
      .catch((e) => setError(e.message));
  }, []);
  return (
    <PageCanvas>
      <PageHeader title="历史项目" subtitle="所有测算项目都保留在这里。刷新后状态可恢复。" />
      {error && <p className="mb-4 text-sn-error">{error}</p>}
      <Card className="overflow-x-auto p-0">
        <table className="min-w-full text-left text-[14px]">
          <thead className="text-[12px] text-sn-muted">
            <tr>
              {["项目", "客户", "状态", "当前方案", "核心结果", "更新时间"].map((h) => (
                <th key={h} className="px-4 py-3 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id} className="border-t border-black/[0.04]">
                <td className="px-4 py-3">
                  <Link className="font-semibold text-sn-primary" href={`/projects/${p.id}/calculation`}>
                    {p.projectName}
                  </Link>
                  <div className="text-[12px] text-sn-muted">{p.projectCode}</div>
                </td>
                <td className="px-4 py-3">{p.customerName}</td>
                <td className="px-4 py-3">{schemeStatusLabel(p.currentSchemeStatus)}</td>
                <td className="px-4 py-3">{p.currentSchemeName || "—"}</td>
                <td className="px-4 py-3">
                  {p.baselineProfit ? `${formatMoney(p.baselineProfit)} · ${p.baselineMargin ? formatPercent(p.baselineMargin) : "—"}` : "—"}
                </td>
                <td className="px-4 py-3">{formatDateTime(p.updatedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </PageCanvas>
  );
}
