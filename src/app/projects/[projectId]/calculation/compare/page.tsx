"use client";

import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { CalculationSubnav } from "@/components/nav";
import { Button, Card, PageHeader, StatusBadge } from "@/components/ui";
import { api } from "@/lib/client";
import { formatFirstPositiveMonth, formatMoney, formatPercent } from "@/lib/format";

type Scheme = {
  id: string;
  schemeName: string;
  versionNo: string;
  status: string;
};
type CompareRow = {
  id: string;
  schemeName: string;
  versionNo: string;
  status: string;
  fleetSize: number;
  routeCount: number;
  avgFreightPrice: string | null;
  freightPricingLabel?: string | null;
  freightPricingMixed?: boolean;
  freightPricingByUnit?: { name: string; averagePrice: string; segmentCount: number }[];
  avgTrips: string | null;
  avgElectricityPrice: string | null;
  avgLoadedEnergy: string | null;
  monthlyRent: string | null;
  monthlyRevenue: string | null;
  monthlyCost: string | null;
  monthlyProfit: string | null;
  profitMargin: string | null;
  irr: string | null;
  firstPositiveMonth: number | null;
};

const FIELDS: { key: keyof CompareRow; label: string; format?: (v: CompareRow) => string }[] = [
  { key: "fleetSize", label: "车辆规模", format: (r) => String(r.fleetSize) },
  { key: "routeCount", label: "线路", format: (r) => String(r.routeCount) },
  { key: "avgFreightPrice", label: "运价", format: (r) => r.freightPricingLabel || (r.freightPricingMixed ? "多计价口径" : r.avgFreightPrice || "—") },
  { key: "avgTrips", label: "趟数(均)", format: (r) => r.avgTrips || "—" },
  { key: "avgElectricityPrice", label: "电价(均)", format: (r) => r.avgElectricityPrice || "—" },
  { key: "avgLoadedEnergy", label: "能耗(均)", format: (r) => r.avgLoadedEnergy || "—" },
  { key: "monthlyRent", label: "月租", format: (r) => r.monthlyRent || "—" },
  { key: "monthlyRevenue", label: "月营收", format: (r) => formatMoney(r.monthlyRevenue) },
  { key: "monthlyCost", label: "月成本", format: (r) => formatMoney(r.monthlyCost) },
  { key: "monthlyProfit", label: "月利润", format: (r) => formatMoney(r.monthlyProfit) },
  { key: "profitMargin", label: "利润率", format: (r) => (r.profitMargin ? formatPercent(r.profitMargin) : "无法计算") },
  { key: "irr", label: "IRR", format: (r) => (r.irr ? formatPercent(r.irr) : "无法计算") },
  { key: "firstPositiveMonth", label: "首次转正月份", format: (r) => (r.firstPositiveMonth == null ? "—" : formatFirstPositiveMonth(r.firstPositiveMonth)) },
];

export default function ComparePage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [schemes, setSchemes] = useState<Scheme[]>([]);
  const [picked, setPicked] = useState<string[]>([]);
  const [rows, setRows] = useState<CompareRow[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    api<Scheme[]>(`/api/projects/${projectId}/calculation-schemes`).then(setSchemes);
  }, [projectId]);

  const toggle = (id: string) => {
    setPicked((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 3) return prev;
      return [...prev, id];
    });
  };

  const diffKeys = useMemo(() => {
    const set = new Set<string>();
    for (const field of FIELDS) {
      const values = rows.map((r) => field.format?.(r) ?? String(r[field.key]));
      if (new Set(values).size > 1) set.add(field.key);
    }
    return set;
  }, [rows]);

  return (
    <div>
      <CalculationSubnav projectId={projectId} />
      <PageHeader title="方案对比" subtitle="最多选择 3 个方案。只高亮差异，不自动给出哪个最好。" />
      <div className="mb-5 grid gap-3 md:grid-cols-3">
        {schemes.map((s) => (
          <button
            key={s.id}
            onClick={() => toggle(s.id)}
            className={`rounded-sn-lg border p-4 text-left shadow-sn-card ${picked.includes(s.id) ? "border-sn-primary bg-white" : "border-transparent bg-white"}`}
          >
            <div className="flex items-center justify-between">
              <span className="font-semibold">{s.schemeName}</span>
              <StatusBadge status={s.status} />
            </div>
            <div className="mt-1 text-[13px] text-sn-muted">{s.versionNo}</div>
          </button>
        ))}
      </div>
      {error && <div className="mb-4 text-sm text-sn-error">{error}</div>}
      <Button
        disabled={picked.length < 2}
        onClick={async () => {
          setError("");
          try {
            const data = await api<{ schemes: CompareRow[] }>("/api/calculation-schemes/compare", {
              method: "POST",
              body: JSON.stringify({ schemeIds: picked }),
            });
            setRows(data.schemes);
          } catch (e) {
            setError(e instanceof Error ? e.message : "对比失败");
          }
        }}
      >
        开始对比
      </Button>
      {rows.length > 0 && (
        <Card className="mt-5 overflow-x-auto p-0">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr>
                <th className="px-4 py-3 text-[12px] text-sn-muted">指标</th>
                {rows.map((r) => (
                  <th key={r.id} className="px-4 py-3">
                    {r.schemeName} {r.versionNo}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {FIELDS.map((field) => (
                <tr key={field.key} className={`border-t border-black/[0.04] ${diffKeys.has(field.key) ? "bg-[#FFF6E8]" : ""}`}>
                  <td className="px-4 py-3 text-sn-secondary">{field.label}</td>
                  {rows.map((r) => (
                    <td key={r.id} className="px-4 py-3 font-medium">
                      {field.format?.(r) ?? String(r[field.key] ?? "—")}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
