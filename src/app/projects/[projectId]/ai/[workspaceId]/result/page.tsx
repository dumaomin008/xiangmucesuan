"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AssistantDrawer } from "@/components/ai/assistant-drawer";
import { Character } from "@/components/empty";
import { Button, Card, MetricCard, PageHeader } from "@/components/ui";
import { api } from "@/lib/client";
import { formatMoney, formatPercent, formatQty } from "@/lib/format";
import type { CalculationResultV1 } from "@/lib/ai/schema/types";

type ResultResponse = {
  result: CalculationResultV1 | null;
  schemeId: string | null;
  analysis: { status: string; analysisJson: string } | null;
  risks: { status: string; payloadJson: string } | null;
};

export default function AiResultPage() {
  const { projectId, workspaceId } = useParams<{ projectId: string; workspaceId: string }>();
  const [data, setData] = useState<ResultResponse | null>(null);
  const [error, setError] = useState("");
  const [assistant, setAssistant] = useState(false);

  useEffect(() => {
    api<ResultResponse>(`/api/ai/workspaces/${workspaceId}/result`)
      .then(setData)
      .catch((e) => setError(e.message));
  }, [workspaceId]);

  const result = data?.result;
  const costData = (result?.cost_breakdown || []).map((item) => ({
    name: item.name,
    amount: Number(item.amount || 0),
  }));

  return (
    <div>
      <PageHeader
        title="AI 测算结果"
        subtitle="核心指标来自测算引擎，不是大模型生成。风险解释与对话重算待规格补齐后再接入。"
        actions={
          <>
            <Button variant="secondary" onClick={() => setAssistant(true)}>打开 AI 助手</Button>
            <Link href={`/projects/${projectId}/ai/${workspaceId}`}>
              <Button variant="ghost">返回资料确认</Button>
            </Link>
          </>
        }
      />
      {error && <div className="mb-4 rounded-sn-md bg-sn-error/12 px-4 py-3 text-sm text-[#C44747]">{error}</div>}
      {!result ? (
        <Card>
          <EmptyStateLike />
        </Card>
      ) : (
        <>
          <div className="mb-6 grid gap-4 md:grid-cols-3 xl:grid-cols-6">
            <MetricCard label="月收入" value={formatMoney(result.kpis.monthly_revenue)} hint={`规则 ${result.rule_version}`} />
            <MetricCard label="月总成本" value={formatMoney(result.kpis.monthly_total_cost)} />
            <MetricCard label="月利润" value={formatMoney(result.kpis.monthly_profit)} />
            <MetricCard label="毛利率" value={result.kpis.profit_margin ? formatPercent(result.kpis.profit_margin) : "无法计算"} hint={result.kpis.profit_margin_reason || ""} />
            <MetricCard label="IRR" value={result.kpis.irr ? formatPercent(result.kpis.irr) : "无法计算"} hint={result.kpis.irr_reason || ""} />
            <MetricCard label="月运量" value={formatQty(result.kpis.monthly_volume)} />
          </div>
          <div className="grid gap-5 lg:grid-cols-2">
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
            <Card>
              <h2 className="text-[20px] font-semibold">风险评估</h2>
              <p className="mt-3 text-[15px] leading-6 text-sn-secondary">
                {data?.risks?.status === "rules_not_configured"
                  ? "风险规则与阈值尚未冻结。本轮不输出风险等级，避免把自然语言当成结论。"
                  : data?.risks?.payloadJson}
              </p>
            </Card>
            <Card>
              <h2 className="text-[20px] font-semibold">AI 分析</h2>
              <p className="mt-3 text-[15px] leading-6 text-sn-secondary">
                分析类 Prompt 尚未冻结。核心数字已按最新测算结果版本展示，AI 文本不会反过来改写这些数字。
              </p>
            </Card>
            <Card>
              <h2 className="text-[20px] font-semibold">继续尽调</h2>
              <p className="mt-3 text-[15px] leading-6 text-sn-secondary">
                尽调优先级分数依赖敏感度规则，规格补齐前请回到确认页查看 P0/P1 缺失项：要获取什么、为什么、影响什么。
              </p>
              {data?.schemeId && (
                <Link className="mt-4 inline-block text-sn-info" href={`/projects/${projectId}/calculation/${data.schemeId}/results`}>
                  查看引擎明细与公式追溯
                </Link>
              )}
            </Card>
          </div>
        </>
      )}
      <AssistantDrawer open={assistant} onClose={() => setAssistant(false)} />
    </div>
  );
}

function EmptyStateLike() {
  return (
    <div className="flex flex-col items-center px-8 py-16 text-center">
      <Character mood="warn" />
      <h3 className="mt-4 text-[22px] font-semibold">还没有引擎测算结果</h3>
      <p className="mt-2 max-w-md text-[15px] text-sn-secondary">请先确认线路和 P0 字段，再调用测算引擎。AI 不会在引擎失败时自行填数。</p>
    </div>
  );
}
