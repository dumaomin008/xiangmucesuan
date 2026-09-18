"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AssistantDrawer } from "@/components/ai/assistant-drawer";
import { AIAnalysisResult } from "@/components/ai/analysis/ai-analysis-result";
import { StatusPill } from "@/components/ai/status-pill";
import { Character } from "@/components/empty";
import { Button, Card, MetricCard, PageHeader } from "@/components/ui";
import { PageCanvas } from "@/components/shell/app-shell";
import { api } from "@/lib/client";
import { formatFirstPositiveMonth, formatMoney, formatPercent, formatQty } from "@/lib/format";
import type { CalculationResultV1 } from "@/lib/ai/schema/types";
import { FALLBACK_ANALYSIS_NOTICE, type AIAnalysisReport } from "@/lib/ai/analysis/schema";

type ResultResponse = {
  result: CalculationResultV1 | null;
  schemeId: string | null;
  analysis: { status: string; analysisJson: string } | null;
  risks: { status: string; payloadJson: string } | null;
  dueDiligence: Array<{
    priority: string;
    item: string;
    reason: string;
    current_assumption: string | null;
    impact_metrics: string[];
    sensitivity: string | null;
    suggested_method: string | null;
  }>;
  assumptions: Array<{
    field_code: string;
    field_name?: string;
    value: string;
    unit?: string | null;
    label: string;
    status: string;
    source_label?: string;
    impact_metrics?: string[];
    allowed_zero?: boolean;
  }>;
  cashFlows: Array<{ monthIndex: number; currentNetCashFlow: string; cumulativeCashFlow: string }>;
  sensitivity: Array<{ variable: string; rows: Array<{ parameterChange: string; monthlyProfit: string }> }>;
  scenarios: Array<{
    id: string;
    kind: string;
    name: string;
    result: CalculationResultV1 | null;
    difference: Record<string, string | null> | null;
  }>;
  analysisReport?: AIAnalysisReport | null;
  analysisMode?: "online" | "demo";
};

function parseRisks(payload: string | null | undefined) {
  try {
    const data = JSON.parse(payload || "{}") as { items?: Array<{ risk_code: string; risk_name: string; level: string; evidence: string; recommendation: string }> };
    return data.items || [];
  } catch {
    return [];
  }
}

const SENS_LABEL: Record<string, string> = {
  freight_price: "运价",
  electricity_price: "电价",
  trips_per_vehicle_month: "趟次",
  monthly_rent_per_vehicle: "车辆月租",
  loaded_energy_consumption: "满载电耗",
};

const HIGHLIGHT_ASSUMPTIONS = new Set([
  "ops.operating_months_year",
  "vehicle.down_payment",
  "cost.toll_per_trip",
  "cost.loading_unloading_fee",
  "cost.information_fee",
]);

export default function AiResultPage() {
  const { projectId, workspaceId } = useParams<{ projectId: string; workspaceId: string }>();
  const [data, setData] = useState<ResultResponse | null>(null);
  const [liveReport, setLiveReport] = useState<AIAnalysisReport | null>(null);
  const [error, setError] = useState("");
  const [assistant, setAssistant] = useState(false);
  const seq = useRef(0);
  const resultId = data?.result?.result_id ?? "";

  const load = () =>
    api<ResultResponse>(`/api/ai/workspaces/${workspaceId}/result`)
      .then(setData)
      .catch((e) => setError(e.message));

  useEffect(() => {
    load();
  }, [workspaceId]);

  const baselineReport = data?.analysisReport;
  useEffect(() => {
    if (data?.analysisMode !== "online" || !baselineReport) return;
    const token = ++seq.current;
    api<{ report: AIAnalysisReport | null }>(`/api/ai/workspaces/${workspaceId}/analysis`, {
      method: "POST",
      body: JSON.stringify({}),
    })
      .then((payload) => {
        if (seq.current === token && payload.report) setLiveReport(payload.report);
      })
      .catch(() => {
        if (seq.current !== token) return;
        setLiveReport({ ...baselineReport, mode: "fallback", notice: FALLBACK_ANALYSIS_NOTICE });
      });
  }, [workspaceId, resultId, data?.analysisMode, baselineReport]);

  const result = data?.result;
  const costData = (result?.cost_breakdown || []).map((item) => ({
    name: item.name,
    amount: Number(item.amount || 0),
  }));
  const risks = parseRisks(data?.risks?.payloadJson);
  const report = liveReport || data?.analysisReport || null;
  const routes = (result?.routes || []) as Array<{
    routeName?: string;
    monthlyRevenue?: string;
    monthlyProfit?: string;
    profitMargin?: string | null;
    variableCost?: string;
    fixedCost?: string;
  }>;

  return (
    <PageCanvas wide>
      <PageHeader
        title="AI 测算结果"
        subtitle="核心指标、图表和敏感性全部来自测算引擎。风险等级来自规则引擎，AI 只做解释。"
        actions={
          <>
            <Button variant="secondary" onClick={() => setAssistant(true)}>打开 AI 测算助手</Button>
            <Link href={`/projects/${projectId}/ai/${workspaceId}`}>
              <Button variant="ghost">返回资料确认</Button>
            </Link>
          </>
        }
      />
      {error && <div className="mb-4 rounded-sn-md bg-sn-error/12 px-4 py-3 text-sm text-[#C44747]">{error}</div>}
      {!result ? (
        <Card>
          <div className="flex flex-col items-center px-8 py-16 text-center">
            <Character mood="warn" />
            <h3 className="mt-4 text-[22px] font-semibold">还没有引擎测算结果</h3>
            <p className="mt-2 max-w-md text-[15px] text-sn-secondary">请先确认线路和 P0 字段，再调用测算引擎。AI 不会在引擎失败时自行填数。</p>
          </div>
        </Card>
      ) : (
        <div className="space-y-5">
          {data?.analysisMode === "online" && report && report.mode !== "online" && report.mode !== "fallback" && (
            <p className="text-[13px] text-sn-info">正在生成 AI 解读，图表数字已由测算引擎确定。</p>
          )}
          {report && <AIAnalysisResult report={report} />}
          {!report && (
          <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-4">
            <MetricCard label="月收入" value={formatMoney(result.kpis.monthly_revenue)} hint={`规则 ${result.rule_version}`} />
            <MetricCard label="月总成本" value={formatMoney(result.kpis.monthly_total_cost)} />
            <MetricCard label="月利润" value={formatMoney(result.kpis.monthly_profit)} />
            <MetricCard label="利润率" value={result.kpis.profit_margin ? formatPercent(result.kpis.profit_margin) : "无法计算"} hint={result.kpis.profit_margin_reason || ""} />
            <MetricCard label="月运量" value={formatQty(result.kpis.monthly_volume)} />
            <MetricCard label="月里程" value={formatQty(result.kpis.monthly_mileage)} />
            <MetricCard label="首次现金流转正" value={formatFirstPositiveMonth(result.kpis.first_positive_month)} />
            <MetricCard label="IRR" value={result.kpis.irr ? formatPercent(result.kpis.irr) : "无法计算"} hint={result.kpis.irr_reason || ""} />
          </div>
          )}

          <Card>
            <h2 className="text-[20px] font-semibold">测算假设</h2>
            <p className="mt-1 text-[13px] text-sn-secondary">
              系统默认、演示参考值和待确认但允许按 0 测算的字段会集中展示来源与影响。这些不是合同确认值，最终数字仍由测算引擎按下列假设重算。
            </p>
            {(data?.assumptions || []).length === 0 ? (
              <div className="mt-6 flex flex-col items-center px-4 py-8 text-center">
                <Character mood="idle" />
                <p className="mt-3 text-[13px] text-sn-secondary">当前测算没有额外假设记录。</p>
              </div>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full text-left text-[13px]">
                  <thead className="text-[12px] text-sn-muted">
                    <tr>
                      {["字段", "测算取值", "单位", "来源", "影响指标", "说明"].map((h) => (
                        <th key={h} className="px-3 py-2 font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(data?.assumptions || []).map((item) => {
                      const highlight = HIGHLIGHT_ASSUMPTIONS.has(item.field_code);
                      return (
                        <tr
                          key={`${item.field_code}-${item.value}-${item.source_label || item.status}`}
                          className={`border-t border-black/[0.04] ${highlight ? "bg-[#FFF8EE]" : ""}`}
                        >
                          <td className="px-3 py-3 font-medium text-sn-primary">
                            {item.field_name || item.field_code}
                            {highlight && <span className="mt-1 block text-[11px] font-normal text-[#C47B12]">重点核对</span>}
                          </td>
                          <td className="px-3 py-3 font-semibold">{item.value === "" ? "未写入引擎" : item.value}</td>
                          <td className="px-3 py-3 text-sn-secondary">{item.unit || "—"}</td>
                          <td className="px-3 py-3">
                            <StatusPill value={item.source_label || item.status} />
                          </td>
                          <td className="px-3 py-3 text-sn-secondary">{(item.impact_metrics || []).join("、") || "—"}</td>
                          <td className="px-3 py-3 text-sn-secondary">{item.label}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <div className="grid gap-5 lg:grid-cols-2">
            {!report && (
            <Card>
              <h2 className="text-[20px] font-semibold">成本结构</h2>
              <div className="mt-4 h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={costData}>
                    <CartesianGrid stroke="rgba(0,0,0,0.04)" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="amount" fill="#667EEA" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
            )}
            <Card>
              <h2 className="text-[20px] font-semibold">线路贡献</h2>
              <div className="mt-3 overflow-x-auto text-[13px]">
                <table className="min-w-full text-left">
                  <thead className="text-[12px] text-sn-muted">
                    <tr>
                      {["线路", "收入", "利润", "利润率"].map((h) => (
                        <th key={h} className="px-2 py-2">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {routes.map((route, index) => (
                      <tr key={route.routeName || index} className="border-t border-black/[0.04]">
                        <td className="px-2 py-2">{route.routeName || `线路 ${index + 1}`}</td>
                        <td className="px-2 py-2">{formatMoney(route.monthlyRevenue)}</td>
                        <td className="px-2 py-2">{formatMoney(route.monthlyProfit)}</td>
                        <td className="px-2 py-2">{route.profitMargin ? formatPercent(route.profitMargin) : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>

          {!report && (
          <>
          <Card>
            <h2 className="text-[20px] font-semibold">现金流</h2>
            <div className="mt-4 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={(data?.cashFlows || []).slice(0, 36).map((row) => ({ ...row, cumulativeCashFlow: Number(row.cumulativeCashFlow) }))}>
                  <CartesianGrid stroke="rgba(0,0,0,0.04)" />
                  <XAxis dataKey="monthIndex" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="cumulativeCashFlow" stroke="#667EEA" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card>
            <h2 className="text-[20px] font-semibold">敏感性</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {(data?.sensitivity || []).map((item) => (
                <div key={item.variable} className="rounded-sn-md bg-sn-subtle p-3">
                  <div className="text-[13px] font-medium">{SENS_LABEL[item.variable] || item.variable}</div>
                  <div className="mt-2 h-40">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={item.rows}>
                        <XAxis dataKey="parameterChange" tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Bar dataKey="monthlyProfit" fill="#82C0A8" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <div className="grid gap-5 lg:grid-cols-2">
            <Card>
              <h2 className="text-[20px] font-semibold">风险</h2>
              <div className="mt-3 space-y-3">
                {risks.length === 0 && <p className="text-[14px] text-sn-secondary">暂无风险结果。</p>}
                {risks.map((item) => (
                  <div key={item.risk_code} className="rounded-sn-md bg-sn-subtle p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[14px] font-medium">{item.risk_name}</span>
                      <StatusPill value={item.level === "高" ? "P0" : item.level === "中" ? "P1" : "P2"} />
                    </div>
                    <p className="mt-1 text-[12px] text-sn-secondary">{item.evidence}</p>
                    <p className="mt-1 text-[12px] text-sn-muted">{item.recommendation}</p>
                  </div>
                ))}
              </div>
            </Card>
            <Card>
              <h2 className="text-[20px] font-semibold">下一步尽调</h2>
              <div className="mt-3 space-y-3">
                {(data?.dueDiligence || []).length === 0 && <p className="text-[14px] text-sn-secondary">关键字段较完整，仍建议抽查合同原件。</p>}
                {(data?.dueDiligence || []).slice(0, 6).map((item) => (
                  <div key={item.item} className="rounded-sn-md bg-sn-subtle p-3">
                    <div className="flex items-center gap-2">
                      <StatusPill value={item.priority} />
                      <span className="text-[13px] font-medium">{item.item}</span>
                    </div>
                    <p className="mt-1 text-[12px] text-sn-secondary">当前：{item.current_assumption}</p>
                    <p className="mt-1 text-[12px] text-sn-muted">影响：{item.impact_metrics.join("、")} · 建议：{item.suggested_method}</p>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {(data?.scenarios || []).length > 0 && (
            <Card>
              <h2 className="text-[20px] font-semibold">方案对比</h2>
              <div className="mt-3 overflow-x-auto text-[13px]">
                <table className="min-w-full text-left">
                  <thead className="text-[12px] text-sn-muted">
                    <tr>
                      {["方案", "月收入", "月成本", "月利润", "利润率", "IRR"].map((h) => (
                        <th key={h} className="px-2 py-2">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(data?.scenarios || []).slice(0, 3).map((item) => (
                      <tr key={item.id} className="border-t border-black/[0.04]">
                        <td className="px-2 py-2">{item.name}</td>
                        <td className="px-2 py-2">{formatMoney(item.result?.kpis.monthly_revenue)}</td>
                        <td className="px-2 py-2">{formatMoney(item.result?.kpis.monthly_total_cost)}</td>
                        <td className="px-2 py-2">{formatMoney(item.result?.kpis.monthly_profit)}</td>
                        <td className="px-2 py-2">{item.result?.kpis.profit_margin ? formatPercent(item.result.kpis.profit_margin) : "—"}</td>
                        <td className="px-2 py-2">{item.result?.kpis.irr ? formatPercent(item.result.kpis.irr) : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
          </>
          )}

          {report && (data?.dueDiligence || []).length > 0 && (
            <Card>
              <h2 className="text-[20px] font-semibold">下一步尽调</h2>
              <div className="mt-3 space-y-3">
                {(data?.dueDiligence || []).slice(0, 6).map((item) => (
                  <div key={item.item} className="rounded-sn-md bg-sn-subtle p-3">
                    <div className="flex items-center gap-2">
                      <StatusPill value={item.priority} />
                      <span className="text-[13px] font-medium">{item.item}</span>
                    </div>
                    <p className="mt-1 text-[12px] text-sn-secondary">当前：{item.current_assumption}</p>
                    <p className="mt-1 text-[12px] text-sn-muted">影响：{item.impact_metrics.join("、")} · 建议：{item.suggested_method}</p>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {data?.schemeId && (
            <Link className="inline-block text-sn-info" href={`/projects/${projectId}/calculation/${data.schemeId}/results`}>
              查看引擎明细与公式追溯
            </Link>
          )}
        </div>
      )}
      <AssistantDrawer
        open={assistant}
        onClose={() => setAssistant(false)}
        workspaceId={workspaceId}
        onSaved={load}
        onAnalysis={(next, meta) => {
          const token = ++seq.current;
          setLiveReport(next);
          if (data?.analysisMode !== "online") return;
          void api<{ report: AIAnalysisReport | null }>(`/api/ai/workspaces/${workspaceId}/analysis`, {
            method: "POST",
            body: JSON.stringify({ scenarioId: meta?.scenarioId, question: meta?.question }),
          })
            .then((payload) => {
              if (seq.current === token && payload.report) setLiveReport(payload.report);
            })
            .catch(() => {
              if (seq.current !== token) return;
              setLiveReport({ ...next, mode: "fallback", notice: FALLBACK_ANALYSIS_NOTICE });
            });
        }}
      />
    </PageCanvas>
  );
}
