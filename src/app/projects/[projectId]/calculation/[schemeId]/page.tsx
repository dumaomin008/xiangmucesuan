"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { CalcModeSwitch, PageCanvas } from "@/components/shell/app-shell";
import { Button } from "@/components/ui";
import { CalculationStepper } from "@/components/wizard/stepper";
import { StepBasic, StepConfirm, StepCost, StepOperations, StepScenario } from "@/components/wizard/steps";
import { api } from "@/lib/client";
import { useCalcMode } from "@/lib/workspace/mode";
import { useSchemeWorkspace } from "@/lib/workspace/use-scheme-workspace";

export default function WizardPage() {
  const { projectId, schemeId } = useParams<{ projectId: string; schemeId: string }>();
  const router = useRouter();
  const ctx = useSchemeWorkspace(schemeId);
  const { professional } = useCalcMode();
  const [step, setStep] = useState(0);
  const [aiChecking, setAiChecking] = useState(false);
  const [aiNotes, setAiNotes] = useState("");

  const { scheme, meta, saveState, banner, setBanner, persist, validate, setCalculating, calculating } = ctx;

  const patchProject = async (partial: Record<string, string>) => {
    if (!scheme?.project) return;
    const nextProject = { ...scheme.project, ...partial };
    ctx.patch({ project: nextProject });
    try {
      await api(`/api/projects/${projectId}`, { method: "PATCH", body: JSON.stringify(partial) });
    } catch (e) {
      setBanner(e instanceof Error ? e.message : "项目保存失败");
    }
  };

  if (!scheme || !meta) {
    return (
      <PageCanvas wide>
        <div className="py-20 text-center text-sn-secondary">正在加载方案…</div>
      </PageCanvas>
    );
  }

  const runCalculate = async () => {
    if (calculating) return;
    setCalculating(true);
    try {
      await persist(scheme);
      const v = await validate();
      if (v.errors.length) return;
      await api(`/api/calculation-schemes/${schemeId}/calculate`, { method: "POST" });
      router.push(`/projects/${projectId}/calculation/${schemeId}/results`);
    } catch (e) {
      const err = e as Error & { payload?: { code?: string; field?: string; message?: string } };
      const parts = [err.payload?.code, err.payload?.field, err.payload?.message || err.message].filter(Boolean);
      setBanner(parts.join(" · ") || "测算失败");
    } finally {
      setCalculating(false);
    }
  };

  const runAiCheck = async () => {
    setAiChecking(true);
    try {
      await persist(scheme);
      const v = await validate();
      const lines = [
        v.errors.length ? `发现 ${v.errors.length} 项阻断错误，必须修改。` : "规则引擎未发现阻断错误。",
        v.warnings.length ? `另有 ${v.warnings.length} 项风险提醒，可确认后继续。` : "暂无偏离标准的风险提醒。",
        "AI 只解释参数合理性，不会改写公式或生成财务结果。",
      ];
      if (v.errors[0]) lines.push(`优先处理：${v.errors[0].message}`);
      else if (v.warnings[0]) lines.push(`建议关注：${v.warnings[0].message}`);
      setAiNotes(lines.join("\n"));
    } catch (e) {
      setAiNotes(`规则检查可用，大模型辅助暂不可用。${e instanceof Error ? e.message : ""}`);
    } finally {
      setAiChecking(false);
    }
  };

  return (
    <PageCanvas wide>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-sn-lg border border-white/50 bg-white/80 px-5 py-3 shadow-sn-card backdrop-blur-[20px]">
        <div>
          <div className="text-[16px] font-semibold">{scheme.project?.projectName || "项目测算"}</div>
          <div className="text-[13px] text-sn-secondary">
            {scheme.schemeName} · {saveState} · 完整度 {ctx.completeness?.percent ?? 0}%
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <CalcModeSwitch />
          <Button variant="ghost" onClick={() => router.push(`/projects/${projectId}/calculation`)}>
            退出
          </Button>
          <Button variant="secondary" onClick={() => persist(scheme)}>
            保存草稿
          </Button>
        </div>
      </div>

      <CalculationStepper step={step} onChange={setStep} />

      {banner && <div className="mb-4 rounded-sn-md bg-sn-error/12 px-4 py-3 text-sm text-[#C44747]">{banner}</div>}
      {scheme.status === "baseline" && (
        <div className="mb-4 rounded-sn-md bg-sn-warning/15 px-4 py-3 text-sm text-[#8A5A10]">
          这是基准方案，不能直接覆盖。请先复制生成新版本再修改。
        </div>
      )}
      {professional && (
        <p className="mb-4 text-[12px] text-sn-muted">
          专业模式与普通模式共用同一份参数和计算引擎。当前规则版本 RULE_PACK_V1。
        </p>
      )}

      {step === 0 && <StepBasic ctx={ctx} onPatchProject={patchProject} />}
      {step === 1 && <StepScenario ctx={ctx} />}
      {step === 2 && <StepOperations ctx={ctx} />}
      {step === 3 && <StepCost ctx={ctx} />}
      {step === 4 && (
        <StepConfirm ctx={ctx} onCalculate={runCalculate} onAiCheck={runAiCheck} aiChecking={aiChecking} aiNotes={aiNotes} />
      )}

      <div className="mt-6 flex justify-between">
        <Button variant="secondary" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
          上一步
        </Button>
        <Button
          disabled={step === 4}
          onClick={async () => {
            await persist(scheme);
            setStep((s) => s + 1);
            if (step === 3) await validate();
          }}
        >
          下一步
        </Button>
      </div>
    </PageCanvas>
  );
}
