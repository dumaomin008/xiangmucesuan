"use client";

import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CalculationSubnav } from "@/components/nav";
import { Card, MetricCard, PageHeader } from "@/components/ui";
import { PageCanvas } from "@/components/shell/app-shell";
import { api } from "@/lib/client";
import { explainUnavailable, formatFirstPositiveMonth, formatMoney, formatMonthLabel, formatPercent } from "@/lib/format";

type Row = {
  monthIndex: number;
  revenueCashIn: string;
  operatingCashOut: string;
  vehicleCashOut: string;
  financingCashFlow: string;
  taxCashOut: string;
  currentNetCashFlow: string;
  cumulativeCashFlow: string;
};

type Annual = {
  yearIndex: number;
  currentNetCashFlow: string;
  cumulativeCashFlow: string;
  active: boolean;
};

type ResultPayload = {
  firstPositiveMonth?: number | null;
  payload: {
    annualCashFlows?: Annual[];
    irrByYears?: { years: number; irr: string | null; reason: string | null }[];
  };
};

export default function CashFlowPage() {
  const { projectId, schemeId } = useParams<{ projectId: string; schemeId: string }>();
  const snapshotId = useSearchParams().get("snapshotId");
  const [rows, setRows] = useState<Row[]>([]);
  const [annual, setAnnual] = useState<Annual[]>([]);
  const [irrByYears, setIrrByYears] = useState<{ years: number; irr: string | null; reason: string | null }[]>([]);
  const [firstPositive, setFirstPositive] = useState<number | null>(null);
  useEffect(() => {
    const qs = snapshotId ? `?snapshotId=${snapshotId}` : "";
    api<Row[]>(`/api/calculation-schemes/${schemeId}/cash-flow${qs}`).then(setRows);
    api<ResultPayload>(`/api/calculation-schemes/${schemeId}/results${qs}`)
      .then((res) => {
        setAnnual(res.payload.annualCashFlows ?? []);
        setIrrByYears(res.payload.irrByYears ?? []);
        setFirstPositive(res.firstPositiveMonth ?? null);
      })
      .catch(() => undefined);
  }, [schemeId, snapshotId]);

  const month0 = rows.find((r) => r.monthIndex === 0);
  const last = rows[rows.length - 1];
  const chart = rows.map((r) => ({
    month: r.monthIndex,
    current: Number(r.currentNetCashFlow),
    cumulative: Number(r.cumulativeCashFlow),
  }));

  return (
    <PageCanvas wide>
      <CalculationSubnav projectId={projectId} schemeId={schemeId} />
      <PageHeader
        title="现金流"
        subtitle="Month 0 计入初始投资。月度现金流聚合为年度，IRR 与投资回收期使用同一套时间轴。"
      />
      <div className="mb-5 grid gap-4 md:grid-cols-3">
        <MetricCard label="初始投资" value={formatMoney(month0?.currentNetCashFlow)} hint="0期 / 初始投入，含车辆首付" />
        <MetricCard label="累计现金流" value={formatMoney(last?.cumulativeCashFlow)} hint="已包含 Month 0 初始投资" />
        <MetricCard label="首次转正月份" value={formatFirstPositiveMonth(firstPositive)} hint="previous < 0 且 current ≥ 0" />
      </div>
      <Card className="mb-5 h-[360px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chart}>
            <defs>
              <linearGradient id="c1" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#667EEA" />
                <stop offset="100%" stopColor="#F093FB" />
              </linearGradient>
              <linearGradient id="c2" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#56CCF2" />
                <stop offset="100%" stopColor="#2AF598" />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="rgba(0,0,0,0.04)" />
            <XAxis dataKey="month" />
            <YAxis />
            <Tooltip
              labelFormatter={(label) => formatMonthLabel(Number(label))}
              contentStyle={{
                borderRadius: 16,
                border: "1px solid rgba(255,255,255,0.5)",
                background: "rgba(255,255,255,0.86)",
                backdropFilter: "blur(20px)",
              }}
            />
            <Area type="monotone" dataKey="current" name="当期净现金流" stroke="#667EEA" fill="url(#c1)" />
            <Area type="monotone" dataKey="cumulative" name="累计现金流" stroke="#2AF598" fill="url(#c2)" />
          </AreaChart>
        </ResponsiveContainer>
      </Card>
      <Card className="overflow-x-auto p-0">
        <table className="min-w-full text-left text-sm">
          <thead className="text-[12px] text-sn-muted">
            <tr>
              {["月份", "经营现金流入", "经营现金流出", "车辆现金流出", "融资现金流", "税务现金流出", "当期净现金流", "累计现金流"].map((h) => (
                <th key={h} className="px-4 py-3 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.monthIndex} className={`border-t border-black/[0.04] ${r.monthIndex === 0 ? "bg-[#667EEA]/[0.04]" : ""}`}>
                <td className="px-4 py-3 font-medium">{formatMonthLabel(r.monthIndex)}</td>
                <td className="px-4 py-3">{formatMoney(r.revenueCashIn)}</td>
                <td className="px-4 py-3">{formatMoney(r.operatingCashOut)}</td>
                <td className="px-4 py-3">{formatMoney(r.vehicleCashOut)}</td>
                <td className="px-4 py-3">{formatMoney(r.financingCashFlow)}</td>
                <td className="px-4 py-3">{formatMoney(r.taxCashOut)}</td>
                <td className="px-4 py-3">{formatMoney(r.currentNetCashFlow)}</td>
                <td className="px-4 py-3">{formatMoney(r.cumulativeCashFlow)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      {annual.length > 0 && (
        <Card className="mt-5 overflow-x-auto p-0">
          <div className="px-4 pt-4 text-[16px] font-semibold">年度现金流（由月度聚合，IRR 用这一套）</div>
          <table className="mt-2 min-w-full text-left text-sm">
            <thead className="text-[12px] text-sn-muted">
              <tr>
                {["年", "是否经营", "当期净现金流", "累计现金流"].map((h) => (
                  <th key={h} className="px-4 py-3 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {annual.map((r) => (
                <tr key={r.yearIndex} className="border-t border-black/[0.04]">
                  <td className="px-4 py-3">{r.yearIndex === 0 ? "0期 / 初始投入" : `第 ${r.yearIndex} 年`}</td>
                  <td className="px-4 py-3">{r.active ? "是" : "否"}</td>
                  <td className="px-4 py-3">{formatMoney(r.currentNetCashFlow)}</td>
                  <td className="px-4 py-3">{formatMoney(r.cumulativeCashFlow)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {irrByYears.length > 0 && (
            <div className="flex flex-wrap gap-4 px-4 py-4 text-[13px] text-sn-secondary">
              {irrByYears.map((row) => (
                <span key={row.years}>
                  IRR {row.years}年 {row.irr ? formatPercent(row.irr) : "无法计算"}
                  {row.reason ? `（${explainUnavailable(row.reason)}）` : ""}
                </span>
              ))}
            </div>
          )}
        </Card>
      )}
    </PageCanvas>
  );
}
