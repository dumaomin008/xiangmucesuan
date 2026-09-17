"use client";

import { useParams, useSearchParams } from "next/navigation";
import { Fragment, useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CalculationSubnav } from "@/components/nav";
import { Card, MetricCard, PageHeader } from "@/components/ui";
import { api } from "@/lib/client";
import { explainUnavailable, formatFirstPositiveMonth, formatMoney, formatPercent, formatQty } from "@/lib/format";
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
    freightPricing?: { mixed: boolean; label: string; byUnit: { code: string; name: string; averagePrice: string; segmentCount: number }[] };
    operatingMonthsYear?: number;
    projectOperatingMonths?: number | null;
    snapshotId?: string;
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
        freightPriceUnit?: string;
        driverCostSource?: string;
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
  const snapshotId = useSearchParams().get("snapshotId");
  const [result, setResult] = useState<Result | null>(null);
  const [open, setOpen] = useState<Result["items"][number] | null>(null);
  const [expanded, setExpanded] = useState<string>("");
  const [error, setError] = useState("");

  useEffect(() => {
    const qs = snapshotId ? `?snapshotId=${snapshotId}` : "";
    api<Result>(`/api/calculation-schemes/${schemeId}/results${qs}`)
      .then(setResult)
      .catch((e) => setError(e.message));
  }, [schemeId, snapshotId]);

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

  const amountOf = (codes: string[]) =>
    result.payload.costBreakdown
      .filter((item) => codes.includes(item.code))
      .reduce((n, item) => n + Number(item.amount || 0), 0);

  const costViz = [
    { name: "车辆", amount: amountOf(["vehicle_cost"]) },
    { name: "固定运营", amount: amountOf(["management_fee", "road_maintenance_fee", "maintenance_fee", "inspection_fee", "insurance_fee", "parking_fee", "heater_fee", "consumable_fee"]) },
    { name: "能源", amount: amountOf(["energy_cost"]) },
    { name: "轮胎", amount: amountOf(["tire_cost"]) },
    { name: "司机", amount: amountOf(["driver_cost"]) },
    { name: "路桥", amount: amountOf(["toll"]) },
    { name: "装卸", amount: amountOf(["loading_unloading"]) },
    { name: "信息", amount: amountOf(["information_fee"]) },
    { name: "财务", amount: amountOf(["finance_cost"]) },
    { name: "税务", amount: amountOf(["tax_cost"]) },
  ];
  const routeViz = result.payload.routes.map((route) => ({
    name: route.routeName,
    revenue: Number(route.monthlyRevenue),
    profit: Number(route.monthlyProfit),
  }));

  return (
    <div>
      <CalculationSubnav projectId={projectId} schemeId={schemeId} />
      <PageHeader
        title="测算结果"
        subtitle={`点击任意核心指标可查看计算依据。正式结果绑定快照 ${result.payload.snapshotId || "—"}，不会被后续改参覆盖。`}
      />
      <div className="mb-4 flex flex-wrap gap-3 text-[13px] text-sn-secondary">
        <span>年运营月数 {result.payload.operatingMonthsYear ?? "—"} 个月</span>
        <span>项目经营月数 {result.payload.projectOperatingMonths ?? "按租赁规则"}</span>
        <span>运价 {result.payload.freightPricing?.label ?? "—"}</span>
      </div>
      {result.payload.freightPricing?.mixed && (
        <Card className="mb-5">
          <h3 className="mb-2 text-[16px] font-semibold">多计价口径</h3>
          <p className="text-[13px] text-sn-secondary">方案同时存在不同运价单位，不能计算平均运价。</p>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            {result.payload.freightPricing.byUnit.map((u) => (
              <div key={u.code} className="rounded-sn-md bg-sn-subtle p-3">
                <div className="text-[12px] text-sn-muted">{u.name} · {u.segmentCount} 个路段</div>
                <div className="mt-1 text-[20px] font-bold">{u.averagePrice}</div>
              </div>
            ))}
          </div>
        </Card>
      )}
      <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-5">
        <MetricCard label="月营收" value={formatMoney(result.monthlyRevenue)} onClick={() => show("monthly_revenue")} />
        <MetricCard label="月总成本" value={formatMoney(result.monthlyTotalCost)} onClick={() => show("monthly_total_cost")} />
        <MetricCard label="月利润" value={formatMoney(result.monthlyProfit)} onClick={() => show("monthly_profit")} />
        <MetricCard
          label="利润率"
          value={result.profitMargin ? formatPercent(result.profitMargin) : "无法计算"}
          hint={explainUnavailable(result.profitMarginReason) || undefined}
          onClick={() => show("profit_margin")}
        />
        <MetricCard
          label="IRR"
          value={result.irr ? formatPercent(result.irr) : "无法计算"}
          hint={explainUnavailable(result.irrReason) || `首次转正：${formatFirstPositiveMonth(result.firstPositiveMonth)}`}
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
              <div className="mt-1 text-[22px] font-bold">{formatFirstPositiveMonth(result.firstPositiveMonth)}</div>
            </div>
            <div className="rounded-sn-md bg-sn-subtle p-4">
              <div className="text-[12px] text-sn-muted">规则版本</div>
              <div className="mt-1 text-[22px] font-bold">RULE_PACK_V1</div>
            </div>
          </div>
        </Card>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Card className="h-[320px]">
          <h3 className="mb-3 text-[20px] font-semibold">成本构成</h3>
          <ResponsiveContainer width="100%" height="85%">
            <BarChart data={costViz}>
              <CartesianGrid stroke="rgba(0,0,0,0.04)" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{
                  borderRadius: 16,
                  border: "1px solid rgba(255,255,255,0.5)",
                  background: "rgba(255,255,255,0.86)",
                  backdropFilter: "blur(20px)",
                }}
              />
              <Bar dataKey="amount" name="金额" fill="#667EEA" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card className="h-[320px]">
          <h3 className="mb-3 text-[20px] font-semibold">线路利润贡献</h3>
          <ResponsiveContainer width="100%" height="85%">
            <BarChart data={routeViz}>
              <CartesianGrid stroke="rgba(0,0,0,0.04)" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{
                  borderRadius: 16,
                  border: "1px solid rgba(255,255,255,0.5)",
                  background: "rgba(255,255,255,0.86)",
                  backdropFilter: "blur(20px)",
                }}
              />
              <Bar dataKey="revenue" name="收入" fill="#667EEA" radius={[8, 8, 0, 0]} />
              <Bar dataKey="profit" name="利润" fill="#34C759" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
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
                          {seg.driverCostSource === "SEGMENT_OVERRIDE" ? " · 司机成本来源：路段覆盖值" : ""}
                          {seg.driverCostSource === "SCHEME_DEFAULT" ? " · 司机成本来源：方案默认值" : ""}
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
