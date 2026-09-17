"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CalculationSubnav } from "@/components/nav";
import { Card, PageHeader } from "@/components/ui";
import { api } from "@/lib/client";
import { formatMoney, formatPercent } from "@/lib/format";

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
  payload: {
    annualCashFlows?: Annual[];
    irrByYears?: { years: number; irr: string | null; reason: string | null }[];
  };
};

export default function CashFlowPage() {
  const { projectId, schemeId } = useParams<{ projectId: string; schemeId: string }>();
  const [rows, setRows] = useState<Row[]>([]);
  const [annual, setAnnual] = useState<Annual[]>([]);
  const [irrByYears, setIrrByYears] = useState<{ years: number; irr: string | null; reason: string | null }[]>([]);
  useEffect(() => {
    api<Row[]>(`/api/calculation-schemes/${schemeId}/cash-flow`).then(setRows);
    api<ResultPayload>(`/api/calculation-schemes/${schemeId}/results`)
      .then((res) => {
        setAnnual(res.payload.annualCashFlows ?? []);
        setIrrByYears(res.payload.irrByYears ?? []);
      })
      .catch(() => undefined);
  }, [schemeId]);

  const chart = rows.map((r) => ({
    month: r.monthIndex,
    current: Number(r.currentNetCashFlow),
    cumulative: Number(r.cumulativeCashFlow),
  }));

  return (
    <div>
      <CalculationSubnav projectId={projectId} schemeId={schemeId} />
      <PageHeader title="现金流" subtitle="按月份生成，不只保存最终值。首付与月租按租赁规则落入对应月份。" />
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
              contentStyle={{
                borderRadius: 16,
                border: "1px solid rgba(255,255,255,0.5)",
                background: "rgba(255,255,255,0.86)",
                backdropFilter: "blur(20px)",
              }}
            />
            <Area type="monotone" dataKey="current" name="当期现金流" stroke="#667EEA" fill="url(#c1)" />
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
              <tr key={r.monthIndex} className="border-t border-black/[0.04]">
                <td className="px-4 py-3">{r.monthIndex}</td>
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
          <div className="px-4 pt-4 text-[16px] font-semibold">年度现金流（Excel IRR 用这一套）</div>
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
                  <td className="px-4 py-3">{r.yearIndex === 0 ? "初始期" : `第 ${r.yearIndex} 年`}</td>
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
                </span>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
