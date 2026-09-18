"use client";

import { useState } from "react";
import { Button, Card, TextArea } from "@/components/ui";
import { AI_ASSISTANT_SHORTCUTS } from "@/lib/ai/tools";
import { api } from "@/lib/client";
import { formatMoney, formatPercent } from "@/lib/format";
import { AIAnswer } from "@/components/ai/analysis/ai-answer";
import type { AnswerPlan, ScenarioDeltaView } from "@/lib/ai/analysis/answer-plan";
import { wantsLastScenario } from "@/lib/ai/analysis/answer-plan";
import type { AIAnalysisReport } from "@/lib/ai/analysis/schema";

type CopilotResponse = {
  intent: { kind: string; title: string; parser: string };
  steps: string[];
  explanation: string;
  scenarioId: string | null;
  engineErrors: string[];
  baselineUnchanged: boolean;
  analysis?: AIAnalysisReport | null;
  answerPlan?: AnswerPlan | null;
  delta?: ScenarioDeltaView | null;
  compare: {
    baseline: { kpis: Record<string, string | null> };
    scenario: { kpis: Record<string, string | null> };
    difference: Record<string, string | null>;
  } | null;
};

export function AssistantDrawer({
  open,
  onClose,
  workspaceId,
  onSaved,
  onAnalysis,
}: {
  open: boolean;
  onClose: () => void;
  workspaceId?: string;
  onSaved?: () => void;
  onAnalysis?: (report: AIAnalysisReport, meta?: { scenarioId: string | null; question: string; plan?: AnswerPlan | null; delta?: ScenarioDeltaView | null }) => void;
}) {
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [base, setBase] = useState<"baseline" | "last_scenario">("baseline");
  const [contextTitle, setContextTitle] = useState("");
  const [reply, setReply] = useState<CopilotResponse | null>(null);

  if (!open) return null;

  const ask = async (text: string, nextBase?: "baseline" | "last_scenario") => {
    if (!workspaceId) return;
    const useBase = nextBase || (wantsLastScenario(text) ? "last_scenario" : base);
    setBusy("ask");
    setError("");
    try {
      const data = await api<CopilotResponse>(`/api/ai/workspaces/${workspaceId}/copilot`, {
        method: "POST",
        body: JSON.stringify({ question: text, base: useBase }),
      });
      setReply(data);
      if (data.answerPlan?.temporaryScenario) {
        setContextTitle((prev) => (data.answerPlan?.continueFromLast && prev ? `${prev}，${data.intent.title}` : data.intent.title));
        setBase("last_scenario");
      }
      if (data.analysis) {
        onAnalysis?.(data.analysis, { scenarioId: data.scenarioId, question: text, plan: data.answerPlan, delta: data.delta });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "助手请求失败");
    } finally {
      setBusy("");
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/20" onClick={onClose}>
      <aside
        className="h-full w-full max-w-3xl overflow-y-auto border-l border-white/50 bg-white/72 p-6 shadow-sn-float backdrop-blur-[20px] saturate-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-[22px] font-semibold">AI 测算助手</h2>
            <p className="mt-1 text-[13px] text-sn-secondary">解释基于引擎结果。场景问题会真实重算，不会由模型估算利润。</p>
          </div>
          <button className="text-sn-secondary" onClick={onClose}>关闭</button>
        </div>
        <div className="mb-3 flex flex-wrap gap-2 text-[12px]">
          <button className={base === "baseline" ? "font-semibold text-sn-primary" : "text-sn-secondary"} onClick={() => { setBase("baseline"); setContextTitle(""); }}>回到基准方案</button>
          <button className={base === "last_scenario" ? "font-semibold text-sn-primary" : "text-sn-secondary"} onClick={() => setBase("last_scenario")}>基于当前情景继续</button>
        </div>
        {contextTitle && <p className="mb-3 text-[13px] text-[#4C64C8]">当前分析基于：{contextTitle}</p>}
        <div className="flex flex-wrap gap-2">
          {AI_ASSISTANT_SHORTCUTS.map((item) => (
            <button
              key={item}
              className="rounded-full bg-white px-3 py-1.5 text-left text-[12px] text-sn-secondary shadow-sn-card"
              onClick={() => {
                setQuestion(item);
                void ask(item);
              }}
            >
              {item}
            </button>
          ))}
        </div>
        <div className="mt-4">
          <TextArea rows={4} value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="例如：如果运价下降 5% 会怎样？" />
        </div>
        <Button className="mt-3 w-full" disabled={busy !== "" || !question.trim()} onClick={() => ask(question)}>
          {busy === "ask" ? (reply?.steps?.[0] || "正在创建模拟方案 → 正在重新测算") : "发送"}
        </Button>
        {error && <p className="mt-3 text-[13px] text-sn-error">{error}</p>}
        {reply && (
          <Card className="mt-4">
            <p className="text-[12px] text-sn-muted">{reply.steps.join(" → ")}</p>
            <p className="mt-2 text-[14px] leading-6 text-sn-secondary whitespace-pre-wrap">{reply.explanation}</p>
            {reply.compare && (
              <div className="mt-3 overflow-x-auto text-[12px]">
                <table className="w-full text-left">
                  <thead>
                    <tr className="text-sn-muted">
                      <th className="py-1">指标</th>
                      <th>基准</th>
                      <th>模拟</th>
                      <th>差异</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ["月收入", reply.compare.baseline.kpis.monthly_revenue, reply.compare.scenario.kpis.monthly_revenue, reply.compare.difference.monthly_revenue],
                      ["月成本", reply.compare.baseline.kpis.monthly_total_cost, reply.compare.scenario.kpis.monthly_total_cost, reply.compare.difference.monthly_total_cost],
                      ["月利润", reply.compare.baseline.kpis.monthly_profit, reply.compare.scenario.kpis.monthly_profit, reply.compare.difference.monthly_profit],
                      ["利润率", reply.compare.baseline.kpis.profit_margin, reply.compare.scenario.kpis.profit_margin, reply.compare.difference.profit_margin],
                    ].map(([label, a, b, d]) => (
                      <tr key={String(label)} className="border-t border-black/[0.04]">
                        <td className="py-1">{label}</td>
                        <td>{label === "利润率" ? formatPercent(a) : formatMoney(a)}</td>
                        <td>{label === "利润率" ? formatPercent(b) : formatMoney(b)}</td>
                        <td>{String(d ?? "—")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {reply.scenarioId && (
              <Button
                variant="secondary"
                className="mt-3 w-full"
                disabled={busy !== ""}
                onClick={() => {
                  void (async () => {
                    setBusy("save");
                    try {
                      await api(`/api/ai/workspaces/${workspaceId}/copilot`, {
                        method: "POST",
                        body: JSON.stringify({ action: "save", scenarioId: reply.scenarioId }),
                      });
                      onSaved?.();
                    } catch (e) {
                      setError(e instanceof Error ? e.message : "保存失败");
                    } finally {
                      setBusy("");
                    }
                  })();
                }}
              >
                保存为正式方案
              </Button>
            )}
          </Card>
        )}
        {reply?.analysis && reply.answerPlan && (
          <div className="mt-4">
            <AIAnswer report={reply.analysis} plan={reply.answerPlan} delta={reply.delta} onAsk={(text) => { setQuestion(text); void ask(text); }} />
          </div>
        )}
      </aside>
    </div>
  );
}
