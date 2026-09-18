"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatMoney, formatPercent } from "@/lib/format";
import type { MetricDeltaRow, ParameterChangeView, ScenarioDeltaView } from "@/lib/ai/analysis/answer-plan";

function moneyOrPending(value: number | null) {
  return value === null ? "待确认" : formatMoney(value);
}

function cell(row: MetricDeltaRow, field: "baseline" | "next") {
  const value = row[field];
  if (value === null) return "待确认";
  if (row.unit === "ratio") return formatPercent(value);
  if (row.unit === "月") return value === 0 ? "无需回收" : `${value} 个月`;
  return formatMoney(value);
}

function deltaText(row: MetricDeltaRow) {
  if (row.delta === null) return "待确认";
  if (row.unit === "ratio") {
    const pp = row.delta * 100;
    return `${pp > 0 ? "+" : ""}${pp.toFixed(2)} 个百分点`;
  }
  if (row.unit === "月") return `${row.delta > 0 ? "+" : ""}${row.delta} 个月`;
  const rate = row.deltaRate === null ? "" : ` / ${(row.deltaRate * 100).toFixed(1)}%`;
  return `${formatMoney(row.delta)}${rate}`;
}

export function ParameterChangeCard({ items }: { items: ParameterChangeView[] }) {
  if (!items.length) return null;
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {items.map((item) => (
        <div key={`${item.name}-${item.changeLabel}`} className="rounded-sn-md bg-sn-subtle px-4 py-3">
          <div className="text-[12px] text-sn-muted">{item.name}</div>
          <div className="mt-2 text-[15px] font-semibold text-sn-primary">
            {item.before} {item.unit}
            <span className="mx-2 text-sn-muted">→</span>
            {item.after} {item.unit}
          </div>
          <div className="mt-1 text-[13px] text-[#C47B12]">{item.changeLabel}</div>
        </div>
      ))}
    </div>
  );
}

export function MetricDeltaCard({ rows }: { rows: MetricDeltaRow[] }) {
  return (
    <div className="overflow-x-auto text-[13px]">
      <table className="min-w-full text-left">
        <thead className="text-[12px] text-sn-muted">
          <tr>
            {["指标", "变动前", "新情景", "变化"].map((head) => (
              <th key={head} className="px-2 py-2 font-medium">{head}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} className="border-t border-black/[0.04]">
              <td className="px-2 py-2 font-medium">{row.name}</td>
              <td className="px-2 py-2">{cell(row, "baseline")}</td>
              <td className="px-2 py-2">{cell(row, "next")}</td>
              <td className="px-2 py-2">{deltaText(row)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-[12px] text-sn-muted">数据来源：Calculation Engine。差值为程序计算，不是模型估算。临时情景未覆盖基准方案。</p>
    </div>
  );
}

export function ScenarioDeltaChart({ delta }: { delta: ScenarioDeltaView }) {
  const chart = delta.rows
    .filter((row) => row.unit === "元" && row.baseline !== null && row.next !== null)
    .map((row) => ({ name: row.name, 变动前: row.baseline, 新情景: row.next }));
  if (!chart.length) return <p className="text-[14px] text-sn-secondary">当前没有可对比的金额结果。</p>;
  return (
    <div>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chart}>
            <CartesianGrid stroke="rgba(0,0,0,0.04)" />
            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip formatter={(value) => moneyOrPending(Number(value))} />
            <Legend />
            <Bar dataKey="变动前" fill="#9E9EA8" radius={[6, 6, 0, 0]} />
            <Bar dataKey="新情景" fill="#5B9BF5" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-2 text-[12px] text-sn-muted">数据来源：Calculation Engine</p>
    </div>
  );
}
