"use client";

import { type ReactNode } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, MetricCard } from "@/components/ui";
import { formatMoney, formatPercent } from "@/lib/format";
import type { AIAnalysisReport, AnalysisRisk, KeyMetric, RiskLevel } from "@/lib/ai/analysis/schema";

const COST_COLORS = ["#667EEA", "#82C0A8", "#F0B46A", "#E07A7A", "#8E8EA8", "#5B9BF5", "#C4B5FD", "#94A3B8"];

const LEVEL_LABEL: Record<RiskLevel, string> = { high: "高", medium: "中", low: "低" };
const LEVEL_CLASS: Record<RiskLevel, string> = {
  high: "bg-sn-error/12 text-[#C44747]",
  medium: "bg-sn-warning/15 text-[#C47B12]",
  low: "bg-sn-success/12 text-[#1F8A4C]",
};

const TAG_LABEL = {
  confirmed: "已确认",
  calculated: "系统计算",
  ai_inferred: "AI推断",
  missing: "缺失",
} as const;

const TAG_CLASS = {
  confirmed: "bg-sn-success/12 text-[#1F8A4C]",
  calculated: "bg-[#667EEA]/12 text-[#4C64C8]",
  ai_inferred: "bg-sn-warning/15 text-[#C47B12]",
  missing: "bg-black/5 text-sn-secondary",
} as const;

function formatMetric(metric: KeyMetric): string {
  if (metric.value === null || !Number.isFinite(metric.value)) return "待确认";
  if (metric.unit === "ratio") return formatPercent(metric.value);
  if (metric.unit === "月") {
    if (metric.value === 0) return "无需回收";
    if (metric.value >= 12) return `${(metric.value / 12).toFixed(1)}年`;
    return `第 ${metric.value} 月`;
  }
  return formatMoney(metric.value);
}

function formatPayback(value: number | null): string {
  if (value === null) return "待确认";
  if (value === 0) return "无需回收";
  if (value >= 12) return `${(value / 12).toFixed(1)}年`;
  return `第 ${value} 月`;
}

function Section({ index, title, hint, children }: { index: number; title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="ai-rise" style={{ animationDelay: `${index * 70}ms` }}>
      <Card>
        <h3 className="text-[20px] font-semibold">{title}</h3>
        {hint && <p className="mt-1 text-[13px] text-sn-secondary">{hint}</p>}
        <div className="mt-4">{children}</div>
      </Card>
    </section>
  );
}

export function AISummary({ report }: { report: AIAnalysisReport }) {
  return (
    <Section index={1} title={report.summary.title}>
      <p className="text-[16px] leading-7 text-sn-primary">{report.summary.conclusion}</p>
      <ul className="mt-4 space-y-2 text-[14px] leading-6 text-sn-secondary">
        {report.summary.highlights.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </Section>
  );
}

export function KPIGrid({ report }: { report: AIAnalysisReport }) {
  return (
    <section className="ai-rise grid gap-4 md:grid-cols-2 xl:grid-cols-4" style={{ animationDelay: "140ms" }}>
      {report.keyMetrics.map((metric) => (
        <MetricCard key={metric.key} label={metric.name} value={formatMetric(metric)} hint={metric.statusLabel} />
      ))}
    </section>
  );
}

export function CostStructureChart({ report }: { report: AIAnalysisReport }) {
  const data = report.costStructure.filter((item) => item.value > 0);
  return (
    <Section index={3} title="成本结构" hint="占比与金额都来自测算引擎的成本拆分，只做归类展示。">
      {data.length === 0 ? (
        <p className="text-[14px] text-sn-secondary">成本结构暂无可用金额。</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data} dataKey="value" nameKey="name" innerRadius={58} outerRadius={88} paddingAngle={2}>
                  {data.map((item, index) => (
                    <Cell key={item.code} fill={COST_COLORS[index % COST_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatMoney(Number(value))} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} layout="vertical" margin={{ left: 24, right: 8 }}>
                <CartesianGrid stroke="rgba(0,0,0,0.04)" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" width={108} tick={{ fontSize: 12 }} />
                <Tooltip formatter={(value) => formatMoney(Number(value))} />
                <Bar dataKey="value" fill="#667EEA" radius={[0, 8, 8, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
      <div className="mt-3 space-y-1 text-[13px] text-sn-secondary">
        {data.map((item) => (
          <p key={item.code}>{item.name}：{formatMoney(item.value)}，占比 {item.percentage.toFixed(1)}%</p>
        ))}
        {report.costInsight.largest && <p>最大成本项：{report.costInsight.largest}</p>}
        {report.costInsight.anomaly && <p>成本异常：{report.costInsight.anomaly}</p>}
        {report.costInsight.optimize && <p>优先核对：{report.costInsight.optimize}</p>}
      </div>
    </Section>
  );
}

export function ScenarioComparisonChart({ report }: { report: AIAnalysisReport }) {
  return (
    <Section index={4} title="方案对比" hint={report.scenarioNote}>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={report.scenarios}>
            <CartesianGrid stroke="rgba(0,0,0,0.04)" />
            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip formatter={(value) => formatMoney(Number(value))} />
            <Legend />
            <Bar dataKey="revenue" name="收入" fill="#667EEA" radius={[6, 6, 0, 0]} />
            <Bar dataKey="cost" name="成本" fill="#F0B46A" radius={[6, 6, 0, 0]} />
            <Bar dataKey="profit" name="利润" fill="#82C0A8" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-4 overflow-x-auto text-[13px]">
        <table className="min-w-full text-left">
          <thead className="text-[12px] text-sn-muted">
            <tr>
              {["方案", "收入", "成本", "利润", "利润率", "回收期", "来源"].map((head) => (
                <th key={head} className="px-2 py-2 font-medium">{head}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {report.scenarios.map((item) => (
              <tr key={item.name} className="border-t border-black/[0.04]">
                <td className="px-2 py-2">{item.name}</td>
                <td className="px-2 py-2">{formatMoney(item.revenue)}</td>
                <td className="px-2 py-2">{formatMoney(item.cost)}</td>
                <td className="px-2 py-2">{formatMoney(item.profit)}</td>
                <td className="px-2 py-2">{item.roi === null ? "待确认" : formatPercent(item.roi)}</td>
                <td className="px-2 py-2">{formatPayback(item.paybackPeriod)}</td>
                <td className="px-2 py-2">{item.scenarioSource === "demo_rule" ? "演示规则" : "当前参数"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

export function ProfitTrendChart({ report }: { report: AIAnalysisReport }) {
  if (!report.trend.available) {
    return (
      <Section index={5} title="收益与现金流">
        <p className="text-[14px] text-sn-secondary">{report.trend.message}</p>
      </Section>
    );
  }
  return (
    <Section
      index={5}
      title="收益与现金流"
      hint={report.trend.breakevenMonth === null ? "盈亏平衡时间：待确认" : `盈亏平衡时间：${formatPayback(report.trend.breakevenMonth)}`}
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={report.trend.points}>
              <CartesianGrid stroke="rgba(0,0,0,0.04)" />
              <XAxis dataKey="monthIndex" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(value) => formatMoney(Number(value))} />
              <Legend />
              <Line type="monotone" dataKey="revenue" name="营业收入" stroke="#667EEA" dot={false} />
              <Line type="monotone" dataKey="cost" name="总成本" stroke="#F0B46A" dot={false} />
              <Line type="monotone" dataKey="profit" name="净现金流" stroke="#82C0A8" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={report.trend.points}>
              <CartesianGrid stroke="rgba(0,0,0,0.04)" />
              <XAxis dataKey="monthIndex" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(value) => formatMoney(Number(value))} />
              <Line type="monotone" dataKey="cumulativeCashFlow" name="累计现金流" stroke="#5B9BF5" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </Section>
  );
}

export function SensitivityChart({ report }: { report: AIAnalysisReport }) {
  const parameters = [...new Set(report.sensitivity.map((item) => item.parameter))];
  const tornado = parameters.map((parameter) => {
    const down = report.sensitivity.find((item) => item.parameter === parameter && item.change === -10);
    const up = report.sensitivity.find((item) => item.parameter === parameter && item.change === 10);
    return {
      parameter,
      down: down?.profitChange ?? 0,
      up: up?.profitChange ?? 0,
    };
  });
  return (
    <Section index={6} title="敏感性分析" hint={report.sensitivityHighlight?.reason || "展示参数 ±10% 时月利润的变化，数值来自测算引擎。"}>
      {tornado.length === 0 ? (
        <p className="text-[14px] text-sn-secondary">敏感性重算暂不可用，基准结果不受影响。</p>
      ) : (
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={tornado} layout="vertical" margin={{ left: 28, right: 8 }}>
              <CartesianGrid stroke="rgba(0,0,0,0.04)" />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="parameter" width={108} tick={{ fontSize: 12 }} />
              <Tooltip formatter={(value) => formatMoney(Number(value))} />
              <Legend />
              <Bar dataKey="down" name="-10% 利润变化" fill="#FF6B6B" radius={[0, 6, 6, 0]} />
              <Bar dataKey="up" name="+10% 利润变化" fill="#34C759" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Section>
  );
}

export function RiskPanel({ report }: { report: AIAnalysisReport }) {
  return (
    <Section index={7} title="风险" hint="等级只根据引擎重算后的利润变化划分，没有数据依据的项不会标成高风险。">
      {report.risks.length === 0 ? (
        <p className="text-[14px] text-sn-secondary">按当前规则，没有达到中高风险阈值的项目。</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {report.risks.map((item) => (
            <RiskCard key={item.name} item={item} />
          ))}
        </div>
      )}
    </Section>
  );
}

function RiskCard({ item }: { item: AnalysisRisk }) {
  return (
    <article className="rounded-sn-md bg-sn-subtle p-4">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-[15px] font-semibold">{item.name}</h4>
        <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${LEVEL_CLASS[item.level]}`}>{LEVEL_LABEL[item.level]}</span>
      </div>
      <p className="mt-2 text-[13px] leading-6 text-sn-secondary">{item.description}</p>
      <p className="mt-2 text-[12px] leading-5 text-sn-muted">依据：{item.evidence}</p>
      <p className="mt-1 text-[12px] leading-5 text-sn-secondary">影响：{item.affectedMetrics.join("、")}</p>
      <p className="mt-1 text-[12px] leading-5 text-sn-primary">建议：{item.suggestion}</p>
    </article>
  );
}

export function AssumptionPanel({ report }: { report: AIAnalysisReport }) {
  const groups = [
    ["confirmed", report.assumptions.confirmed],
    ["calculated", report.assumptions.calculated],
    ["aiInferred", report.assumptions.aiInferred],
    ["missing", report.assumptions.missing],
  ] as const;
  const tagOf = {
    confirmed: "confirmed",
    calculated: "calculated",
    aiInferred: "ai_inferred",
    missing: "missing",
  } as const;
  return (
    <Section index={8} title="关键假设" hint="用来区分数字是谁给出的。缺失项保持待确认，不会被补成真实值。">
      <div className="grid gap-4 md:grid-cols-2">
        {groups.map(([key, items]) => {
          const tag = tagOf[key];
          return (
            <div key={key}>
              <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${TAG_CLASS[tag]}`}>{TAG_LABEL[tag]}</span>
              <ul className="mt-2 space-y-2 text-[13px] leading-6 text-sn-secondary">
                {items.length === 0 && <li>暂无</li>}
                {items.map((item) => (
                  <li key={item.label}>{item.label}</li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </Section>
  );
}

export function RecommendationPanel({ report }: { report: AIAnalysisReport }) {
  return (
    <Section index={9} title="AI建议" hint="最多 5 条，按优先级排列。">
      <ol className="space-y-3">
        {report.recommendations.map((item) => (
          <li key={item.priority} className="rounded-sn-md bg-sn-subtle px-4 py-3">
            <div className="text-[15px] font-semibold">
              {String(item.priority).padStart(2, "0")} {item.action}
            </div>
            <p className="mt-1 text-[13px] leading-6 text-sn-secondary">{item.reason}</p>
            <p className="mt-1 text-[12px] text-sn-muted">影响指标：{item.affectedMetric}</p>
          </li>
        ))}
      </ol>
    </Section>
  );
}

export function AIAnalysisResult({
  report,
  variant = "full",
}: {
  report: AIAnalysisReport;
  variant?: "full" | "compact";
}) {
  return (
    <div className="space-y-5 rounded-sn-xl border border-black/[0.06] bg-sn-page/60 p-4 md:p-5">
      <div className="ai-rise">
        <p className="text-[13px] font-medium text-[#4C64C8]">AI已完成项目分析</p>
        <p className="mt-1 text-[12px] text-sn-muted">正式分析报告与对话分开。金额、比率和回收期只展示测算引擎结果。</p>
        {report.notice && <p className="mt-2 text-[13px] text-[#C47B12]">{report.notice}</p>}
      </div>
      <AISummary report={report} />
      <KPIGrid report={report} />
      {variant === "full" && (
        <>
          <CostStructureChart report={report} />
          <ScenarioComparisonChart report={report} />
          <ProfitTrendChart report={report} />
          <SensitivityChart report={report} />
          <RiskPanel report={report} />
          <AssumptionPanel report={report} />
        </>
      )}
      <RecommendationPanel report={report} />
    </div>
  );
}
