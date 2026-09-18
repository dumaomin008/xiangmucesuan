"use client";

import { useState } from "react";
import { Button, Card } from "@/components/ui";
import type { AIAnalysisReport } from "@/lib/ai/analysis/schema";
import type { AnswerPlan, ScenarioDeltaView, SectionId } from "@/lib/ai/analysis/answer-plan";
import {
  AIAnalysisResult,
  AssumptionPanel,
  CostStructureChart,
  KPIGrid,
  ProfitTrendChart,
  RecommendationPanel,
  RiskPanel,
  ScenarioComparisonChart,
  SensitivityChart,
} from "./ai-analysis-result";
import { MetricDeltaCard, ParameterChangeCard, ScenarioDeltaChart } from "./delta-cards";

function highlighted(report: AIAnalysisReport, keys: string[]): AIAnalysisReport {
  const picked = report.keyMetrics.filter((item) => keys.includes(item.key)).slice(0, 5);
  return { ...report, keyMetrics: picked.length ? picked : report.keyMetrics.slice(0, 4) };
}

export function AIAnswer({
  report,
  plan,
  delta,
  onAsk,
}: {
  report: AIAnalysisReport;
  plan: AnswerPlan;
  delta?: ScenarioDeltaView | null;
  onAsk?: (question: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const show = (id: SectionId) => plan.expandedSections.includes(id);
  const conclusion = delta?.lead || report.summary.conclusion;
  return (
    <div className="space-y-4">
      <Card className="border-l-4 border-l-[#5B9BF5]">
        <p className="text-[12px] font-medium tracking-[0.04em] text-sn-muted">当前分析</p>
        <h2 className="mt-1 text-[22px] font-semibold">{plan.contextLabel || plan.title}</h2>
        {plan.question && <p className="mt-1 text-[13px] text-sn-secondary">问题：{plan.question}</p>}
        <p className="mt-3 text-[16px] font-medium leading-7 text-sn-primary">{plan.needsClarification ? plan.clarification?.prompt : conclusion}</p>
        {report.notice && <p className="mt-3 text-[13px] text-[#C47B12]">{report.notice}</p>}
        {plan.temporaryScenario && <p className="mt-2 text-[12px] text-sn-muted">这是临时情景，不会覆盖基准方案。需要保留时再保存为正式方案。</p>}
      </Card>

      {plan.needsClarification && plan.clarification && (
        <div className="flex flex-wrap gap-2">
          {plan.clarification.options.map((item) => (
            <Button key={item.question} variant="secondary" onClick={() => onAsk?.(item.question)} disabled={!onAsk}>
              {item.label}
            </Button>
          ))}
        </div>
      )}

      {show("parameterChange") && delta && <ParameterChangeCard items={delta.parameters} />}
      {show("metrics") && report.keyMetrics.length > 0 && <KPIGrid report={highlighted(report, plan.primaryMetrics)} />}
      {show("delta") && delta && (
        <Card>
          <h3 className="text-[20px] font-semibold">相对变动前发生了什么</h3>
          <div className="mt-4">
            <ScenarioDeltaChart delta={delta} />
          </div>
          <div className="mt-4">
            <MetricDeltaCard rows={delta.rows} />
          </div>
        </Card>
      )}
      {show("risk") && <RiskPanel report={report} />}
      {show("sensitivity") && <SensitivityChart report={report} />}
      {show("costStructure") && <CostStructureChart report={report} />}
      {show("scenarioComparison") && <ScenarioComparisonChart report={report} />}
      {show("trend") && <ProfitTrendChart report={report} />}
      {show("dueDiligence") && <AssumptionPanel report={report} />}
      {show("recommendations") && <RecommendationPanel report={report} />}

      <div>
        <Button variant="secondary" onClick={() => setOpen((value) => !value)}>
          {open ? "收起完整项目分析" : "查看完整项目分析"}
        </Button>
        {open && (
          <div className="mt-4">
            <AIAnalysisResult report={report} />
          </div>
        )}
      </div>
    </div>
  );
}
