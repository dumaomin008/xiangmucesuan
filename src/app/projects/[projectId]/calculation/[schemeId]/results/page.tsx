"use client";

import { useParams } from "next/navigation";
import { Fragment, useEffect, useState } from "react";
import { CalculationSubnav } from "@/components/nav";
import { Card, MetricCard, PageHeader } from "@/components/ui";
import { api } from "@/lib/client";
import { formatMoney, formatPercent, formatQty } from "@/lib/format";
import { Character } from "@/components/empty";

type Result = {
  monthlyRevenue: string;
  monthlyTotalCost: string;
  monthlyProfit: string;
  profitMargin: string | null;
  profitMarginReason: string | null;
  vehicleMonthlyRevenue: string;
  vehicleMonthlyProfit: string;
  monthlyVolume: string;
  monthlyMileage: string;
  irr: string | null;
  irrReason: string | null;
  irr4y: string | null;
  irr5y: string | null;
  irr6y: string | null;
  irr8y: string | null;
  firstPositiveMonth: number | null;
  payload: {
    costBreakdown: { code: string; name: string; amount: string; share: string | null }[];
    routes: {
      routeId: string;
      routeName: string;
      monthlyRevenue: string;
      fixedCost: string;
      variableCost: string;
      financeCost: string;
      taxCost: string;
      monthlyProfit: string;
      profitMargin: string | null;
      segments: {
        segmentName: string;
        distanceKm: string;
        freightPrice: string;
        tripsPerVehicleMonth: string;
        segmentMonthlyVolume: string;
        monthlyRevenue: string;
        energyCost: string;
        otherVariableCost: string;
        monthlyProfit: string | null;
        loadState?: string;
        allocationWeight?: string;
        allocationWeightRaw?: string;
        allocatedFixedCost?: string;
        driverCost?: string;
      }[];
    }[];
  };
  items: {
    resultCode: string;
    resultName: string;
    resultValue: string | null;
    unit: string;
    ruleCode: string;
    ruleVersion: string;
    calculationExpression: string;
    explanation: string;
    sourceParameterSnapshot: Record<string, string>;
  }[];
};

export default function ResultsPage() {
  const { projectId, schemeId } = useParams<{ projectId: string; schemeId: string }>();
  const [result, setResult] = useState<Result | null>(null);
  const [open, setOpen] = useState<Result["items"][number] | null>(null);
  const [expanded, setExpanded] = useState<string>("");
  const [error, setError] = useState("");

  useEffect(() => {
    api<Result>(`/api/calculation-schemes/${schemeId}/results`)
      .then(setResult)
      .catch((e) => setError(e.message));
  }, [schemeId]);

  const show = (code: string) => {
    const item = result?.items.find((i) => i.resultCode === code);
    if (item) setOpen(item);
  };

  if (error) {
    return (
      <div>
        <CalculationSubnav projectId={projectId} schemeId={schemeId} />
        <Card className="flex items-center gap-6">
          <Character mood="warn" />
          <div>
            <h3 className="text-[22px] font-semibold">还没有可展示的测算结果</h3>
            <p className="mt-2 text-sn-secondary">{error}。请先完成参数配置并点击开始测算。我们不会展示 #DIV/0! 或 NaN。</p>
          </div>
        </Card>
      </div>
    );
  }
  if (!result) return null;

  return (
    <div>
      <CalculationSubnav projectId={projectId} schemeId={schemeId} />
      <PageHeader title="测算结果" subtitle="点击任意核心指标可查看计算依据。正式结果以后端引擎为准。" />
      <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-5">
        <MetricCard label="月营收" value={formatMoney(result.monthlyRevenue)} onClick={() => show("monthly_revenue")} />
        <MetricCard label="月总成本" value={formatMoney(result.monthlyTotalCost)} onClick={() => show("monthly_total_cost")} />
        <MetricCard label="月利润" value={formatMoney(result.monthlyProfit)} onClick={() => show("monthly_profit")} />
        <MetricCard
          label="利润率"
          value={result.profitMargin ? formatPercent(result.profitMargin) : "无法计算"}
          hint={result.profitMarginReason || undefined}
          onClick={() => show("profit_margin")}
        />
        <MetricCard
          label="IRR"
          value={result.irr ? formatPercent(result.irr) : "无法计算"}
          hint={result.irrReason || `首次转正：第 ${result.firstPositiveMonth ?? "—"} 月`}
        />
        <MetricCard label="单车月收入" value={formatMoney(result.vehicleMonthlyRevenue)} />
        <MetricCard label="单车月利润" value={formatMoney(result.vehicleMonthlyProfit)} />
        <MetricCard label="月运输量" value={`${formatQty(result.monthlyVolume)} t`} />
        <MetricCard label="月运营里程" value={`${formatQty(result.monthlyMileage)} km`} />
      </div>

      <div className="mt-4 flex flex-wrap gap-3 text-[13px] text-sn-secondary">
        <span>IRR 4年 {result.irr4y ? formatPercent(result.irr4y) : "无法计算"}</span>
        <span>IRR 5年 {result.irr5y ? formatPercent(result.irr5y) : "无法计算"}</span>
        <span>IRR 6年 {result.irr6y ? formatPercent(result.irr6y) : "无法计算"}</span>
        <span>IRR 8年 {result.irr8y ? formatPercent(result.irr8y) : "无法计算"}</span>
      </div>

      <div className="mt-8 grid gap-5 lg:grid-cols-2">
        <Card>
          <h3 className="mb-4 text-[20px] font-semibold">成本结构</h3>
          <div className="space-y-3">
            {result.payload.costBreakdown.map((item) => {
              const amount = Number(item.amount);
              const max = Math.max(...result.payload.costBreakdown.map((c) => Number(c.amount)), 1);
              return (
                <button key={item.code} className="block w-full text-left" onClick={() => show(item.code)}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span>{item.name}</span>
                    <span>
                      {formatMoney(item.amount)} · {item.share ? formatPercent(item.share) : "—"}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-sn-hover">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.max(4, (amount / max) * 100)}%`,
                        background: "linear-gradient(90deg, #667EEA, #764BA2, #F093FB)",
                      }}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        </Card>
        <Card>
          <h3 className="mb-4 text-[20px] font-semibold">投资评价</h3>
          <p className="text-sn-secondary">
            累计现金流与首次转正月份用于辅助判断，不替代 IRR。若现金流没有正负号变化，系统显示「无法计算」并给出原因。
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-sn-md bg-sn-subtle p-4">
              <div className="text-[12px] text-sn-muted">首次现金流转正</div>
              <div className="mt-1 text-[22px] font-bold">{result.firstPositiveMonth ? `第 ${result.firstPositiveMonth} 月` : "测算期内未转正"}</div>
            </div>
            <div className="rounded-sn-md bg-sn-subtle p-4">
              <div className="text-[12px] text-sn-muted">规则版本</div>
              <div className="mt-1 text-[22px] font-bold">RULE_PACK_V1</div>
            </div>
          </div>
        </Card>
      </div>

      <Card className="mt-5 overflow-x-auto">
        <h3 className="mb-4 text-[20px] font-semibold">线路经营分析</h3>
        <table className="min-w-full text-left text-sm">
          <thead className="text-[12px] text-sn-muted">
            <tr>
              {["线路", "月营收", "固定成本", "变动成本", "财务成本", "税务成本", "月利润", "利润率"].map((h) => (
                <th key={h} className="px-3 py-2 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {result.payload.routes.map((route) => (
              <Fragment key={route.routeId}>
                <tr className="border-t border-black/[0.04]">
                  <td className="px-3 py-3">
                    <button className="font-semibold text-sn-info" onClick={() => setExpanded(expanded === route.routeId ? "" : route.routeId)}>
                      {route.routeName}
                    </button>
                  </td>
                  <td className="px-3 py-3">{formatMoney(route.monthlyRevenue)}</td>
                  <td className="px-3 py-3">{formatMoney(route.fixedCost)}</td>
                  <td className="px-3 py-3">{formatMoney(route.variableCost)}</td>
                  <td className="px-3 py-3">{formatMoney(route.financeCost)}</td>
                  <td className="px-3 py-3">{formatMoney(route.taxCost)}</td>
                  <td className="px-3 py-3">{formatMoney(route.monthlyProfit)}</td>
                  <td className="px-3 py-3">{route.profitMargin ? formatPercent(route.profitMargin) : "无法计算"}</td>
                </tr>
                {expanded === route.routeId &&
                  route.segments.map((seg) => (
                    <tr key={seg.segmentName} className="bg-sn-subtle/80 text-[13px]">
                      <td className="px-3 py-2 pl-8">
                        {seg.segmentName}
                        <div className="text-[12px] text-sn-muted">
                          {seg.loadState === "EMPTY" ? "空载路段" : "满载路段"}
                          {seg.allocationWeightRaw ? ` · 分摊权重 ${seg.allocationWeightRaw}` : ""}
                        </div>
                      </td>
                      <td className="px-3 py-2">{formatMoney(seg.monthlyRevenue)}</td>
                      <td className="px-3 py-2" colSpan={2}>
                        里程 {formatQty(seg.distanceKm)} km · 运价 {seg.freightPrice} · 趟数 {seg.tripsPerVehicleMonth} · 运量 {formatQty(seg.segmentMonthlyVolume)}
                        {seg.allocatedFixedCost ? ` · 分摊固定成本 ${formatMoney(seg.allocatedFixedCost)}` : ""}
                      </td>
                      <td className="px-3 py-2">能源 {formatMoney(seg.energyCost)}</td>
                      <td className="px-3 py-2">其他 {formatMoney(seg.otherVariableCost)}</td>
                      <td className="px-3 py-2">{seg.monthlyProfit ? formatMoney(seg.monthlyProfit) : "—"}</td>
                      <td />
                    </tr>
                  ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </Card>

      {open && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/20 p-4" onClick={() => setOpen(null)}>
          <div
            className="max-w-lg rounded-sn-lg border border-white/50 bg-white/80 p-8 shadow-sn-float backdrop-blur-[20px]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2 text-[13px] text-sn-muted">
              {open.ruleCode} / {open.ruleVersion}
            </div>
            <h3 className="text-[22px] font-semibold">{open.resultName}</h3>
            <div className="mt-3 text-[32px] font-extrabold">
              {open.resultValue ?? "无法计算"} {open.unit}
            </div>
            <p className="mt-4 text-sm text-sn-secondary">{open.explanation}</p>
            <pre className="mt-3 overflow-x-auto rounded-sn-sm bg-sn-subtle p-3 text-[12px] text-sn-secondary">{open.calculationExpression}</pre>
            <div className="mt-4 space-y-1 text-[13px]">
              {Object.entries(open.sourceParameterSnapshot).map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4">
                  <span className="text-sn-muted">{k}</span>
                  <span>{String(v)}</span>
                </div>
              ))}
            </div>
            <button className="mt-6 text-sm text-sn-info" onClick={() => setOpen(null)}>
              关闭
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
