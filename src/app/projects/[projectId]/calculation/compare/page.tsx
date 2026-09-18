"use client";

import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { CalculationSubnav } from "@/components/nav";
import { PageCanvas } from "@/components/shell/app-shell";
import { Button, Card, PageHeader, StatusBadge } from "@/components/ui";
import { api } from "@/lib/client";
import { formatFirstPositiveMonth, formatMoney, formatPercent } from "@/lib/format";
import { flattenSchemeParams, type FlatParam } from "@/lib/workspace/flatten";
import type { Scheme } from "@/lib/workspace/types";

type SchemeRow = {
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
  const [schemes, setSchemes] = useState<SchemeRow[]>([]);
  const [picked, setPicked] = useState<string[]>([]);
  const [rows, setRows] = useState<CompareRow[]>([]);
  const [paramMaps, setParamMaps] = useState<Record<string, FlatParam[]>>({});
  const [onlyDiff, setOnlyDiff] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api<SchemeRow[]>(`/api/projects/${projectId}/calculation-schemes`).then(setSchemes);
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

  const paramRows = useMemo(() => {
    const keys = new Map<string, { label: string; group: string }>();
    for (const list of Object.values(paramMaps)) {
      for (const item of list) keys.set(item.key, { label: item.label, group: item.group });
    }
    const result = [...keys.entries()].map(([key, meta]) => {
      const values = rows.map((r) => paramMaps[r.id]?.find((p) => p.key === key)?.value ?? "—");
      const different = new Set(values).size > 1;
      return { key, ...meta, values, different };
    });
    return onlyDiff ? result.filter((r) => r.different) : result;
  }, [paramMaps, rows, onlyDiff]);

  const explain = useMemo(() => {
    if (rows.length < 2) return "";
    const changed = FIELDS.filter((f) => diffKeys.has(f.key)).map((f) => f.label);
    return changed.length
      ? `对比由计算引擎结果直接相减。发生变化的结果包括：${changed.join("、")}。请结合下方差异参数判断原因，系统不会编造未经引擎支持的数字，也不会推荐哪个方案更好。`
      : "所选方案的核心结果一致。";
  }, [diffKeys, rows.length]);

  const decisionSummary = useMemo(() => {
    if (rows.length < 2) return null;
    const moneyFields: { key: keyof CompareRow; label: string }[] = [
      { key: "monthlyRevenue", label: "月营收" },
      { key: "monthlyCost", label: "月成本" },
      { key: "monthlyProfit", label: "月利润" },
    ];
    let maxLabel = "无金额变化";
    let maxDelta = 0;
    if (rows.length === 2) {
      for (const field of moneyFields) {
        const delta = Number(rows[1][field.key] || 0) - Number(rows[0][field.key] || 0);
        if (Math.abs(delta) >= Math.abs(maxDelta) && delta !== 0) {
          maxDelta = delta;
          maxLabel = `${field.label} ${formatMoney(delta)}`;
        }
      }
    }
    const paramLabels = [...new Set(paramRows.filter((row) => row.different).map((row) => row.label.replace(/^.*· /, "")))];
    return {
      schemeCount: rows.length,
      metricDiffCount: diffKeys.size,
      paramDiffCount: paramRows.filter((row) => row.different).length,
      maxLabel,
      paramLabels,
    };
  }, [diffKeys.size, paramRows, rows]);

  return (
    <PageCanvas wide>
      <CalculationSubnav projectId={projectId} />
      <PageHeader title="方案对比" subtitle="最多选择 3 个方案。差值由程序计算，不自动给出哪个最好。" />
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
            const details = await Promise.all(data.schemes.map((s) => api<Scheme>(`/api/calculation-schemes/${s.id}`)));
            const next: Record<string, FlatParam[]> = {};
            details.forEach((s) => {
              next[s.id] = flattenSchemeParams(s);
            });
            setParamMaps(next);
          } catch (e) {
            setError(e instanceof Error ? e.message : "对比失败");
          }
        }}
      >
        开始对比
      </Button>
      {rows.length > 0 && (
        <>
          {decisionSummary && (
            <Card className="mt-5">
              <h3 className="text-[18px] font-semibold">对比摘要</h3>
              <div className="mt-3 grid gap-3 md:grid-cols-4">
                <div>
                  <div className="text-[12px] text-sn-muted">参与对比方案</div>
                  <div className="mt-1 text-[22px] font-bold">{decisionSummary.schemeCount}</div>
                </div>
                <div>
                  <div className="text-[12px] text-sn-muted">有差异的核心指标</div>
                  <div className="mt-1 text-[22px] font-bold">{decisionSummary.metricDiffCount}</div>
                </div>
                <div>
                  <div className="text-[12px] text-sn-muted">有差异的输入参数</div>
                  <div className="mt-1 text-[22px] font-bold">{decisionSummary.paramDiffCount}</div>
                </div>
                <div>
                  <div className="text-[12px] text-sn-muted">最大金额变化项</div>
                  <div className="mt-1 text-[16px] font-bold">{decisionSummary.maxLabel}</div>
                </div>
              </div>
              {decisionSummary.paramLabels.length > 0 && (
                <p className="mt-3 text-[14px] text-sn-secondary">
                  主要差异来源：两方案存在 {decisionSummary.paramDiffCount} 项输入参数差异：{decisionSummary.paramLabels.slice(0, 8).join("、")}
                  {decisionSummary.paramLabels.length > 8 ? " 等" : ""}。
                </p>
              )}
              <p className="mt-2 text-[12px] text-sn-muted">只展示客观差异，不自动推荐哪个方案更好。</p>
            </Card>
          )}
          {explain && <p className="mt-5 text-[14px] text-sn-secondary">{explain}</p>}
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
                  {rows.length === 2 && <th className="px-4 py-3 text-[12px] text-sn-muted">差值</th>}
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
                    {rows.length === 2 && (
                      <td className="px-4 py-3 text-sn-secondary">
                        {["monthlyRevenue", "monthlyCost", "monthlyProfit"].includes(field.key)
                          ? formatMoney(Number(rows[1][field.key] || 0) - Number(rows[0][field.key] || 0))
                          : "—"}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          <div className="mt-8 mb-3 flex items-center justify-between">
            <h3 className="text-[20px] font-semibold">参数差异</h3>
            <label className="flex items-center gap-2 text-[13px] text-sn-secondary">
              <input type="checkbox" checked={onlyDiff} onChange={(e) => setOnlyDiff(e.target.checked)} />
              只看差异参数
            </label>
          </div>
          <Card className="overflow-x-auto p-0">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr>
                  <th className="px-4 py-3 text-[12px] text-sn-muted">参数</th>
                  {rows.map((r) => (
                    <th key={r.id} className="px-4 py-3">
                      {r.schemeName}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paramRows.map((row) => (
                  <tr key={row.key} className={`border-t border-black/[0.04] ${row.different ? "bg-[#FFF6E8]" : ""}`}>
                    <td className="px-4 py-3 text-sn-secondary">{row.label}</td>
                    {row.values.map((value, i) => (
                      <td key={rows[i].id} className="px-4 py-3 font-medium">
                        {value || "—"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </PageCanvas>
  );
}
