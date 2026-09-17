"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppHeader } from "@/components/app-header";
import { Character } from "@/components/empty";
import { Card } from "@/components/ui";
import { api } from "@/lib/client";
import { formatPercent, formatMoney } from "@/lib/format";

type ProjectRow = {
  id: string;
  projectCode: string;
  projectName: string;
  customerName: string;
  projectManager: string;
  projectStatus: string;
  schemeCount: number;
  baselineSchemeName: string | null;
  baselineProfit: string | null;
  baselineMargin: string | null;
};

export default function HomePage() {
  const [rows, setRows] = useState<ProjectRow[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    api<ProjectRow[]>("/api/projects")
      .then(setRows)
      .catch((e) => setError(e.message));
  }, []);

  return (
    <div>
      <AppHeader />
      <main className="mx-auto max-w-[1200px] px-6 py-10">
        <div className="mb-10 flex items-end justify-between gap-6">
          <div>
            <p className="text-[13px] font-medium tracking-[0.04em] text-sn-muted">PROJECT CALCULATION</p>
            <h1 className="mt-2 text-[30px] font-bold tracking-[-0.01em]">选择一个项目，进入经营测算</h1>
            <p className="mt-2 max-w-2xl text-[15px] text-sn-secondary">
              这不是在线 Excel。测算口径来自规则版本，结果可追溯、可对比、可设为基准。
            </p>
          </div>
          <Character mood="welcome" />
        </div>
        {error && <p className="mb-4 text-sn-error">{error}</p>}
        <div className="grid gap-5 md:grid-cols-2">
          {rows.map((p) => (
            <Link key={p.id} href={`/projects/${p.id}/calculation`}>
              <Card hover className="h-full">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[13px] text-sn-muted">{p.projectCode}</div>
                    <h2 className="mt-1 text-[22px] font-semibold">{p.projectName}</h2>
                    <p className="mt-2 text-[15px] text-sn-secondary">客户 {p.customerName}</p>
                  </div>
                  <span className="rounded-full bg-sn-info/12 px-3 py-1 text-[12px] text-sn-info">{p.projectStatus}</span>
                </div>
                <div className="mt-6 grid grid-cols-3 gap-3">
                  <div>
                    <div className="text-[12px] text-sn-muted">测算方案</div>
                    <div className="mt-1 text-[20px] font-bold">{p.schemeCount}</div>
                  </div>
                  <div>
                    <div className="text-[12px] text-sn-muted">基准月利润</div>
                    <div className="mt-1 text-[20px] font-bold">{p.baselineProfit ? formatMoney(p.baselineProfit) : "—"}</div>
                  </div>
                  <div>
                    <div className="text-[12px] text-sn-muted">基准利润率</div>
                    <div className="mt-1 text-[20px] font-bold">{p.baselineMargin ? formatPercent(p.baselineMargin) : "—"}</div>
                  </div>
                </div>
                <p className="mt-4 text-[13px] text-sn-secondary">当前基准：{p.baselineSchemeName || "尚未设置"}</p>
              </Card>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
