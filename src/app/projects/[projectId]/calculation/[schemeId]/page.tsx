"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CalcModeSwitch, PageCanvas } from "@/components/shell/app-shell";
import { Button } from "@/components/ui";
import { StepIssueBanner } from "@/components/wizard/issue-banner";
import { CalculationStepper } from "@/components/wizard/stepper";
import { StepBasic, StepConfirm, StepCost, StepOperations, StepScenario } from "@/components/wizard/steps";
import { api } from "@/lib/client";
import { useCalcMode } from "@/lib/workspace/mode";
import { summarizeParamChanges } from "@/lib/workspace/param-diff";
import {
  currentValueForField,
  errorMap,
  mergeIssues,
  scrollToField,
  stepForField,
  validateWizardStep,
  type FieldIssue,
} from "@/lib/workspace/step-validate";
import { useSchemeWorkspace } from "@/lib/workspace/use-scheme-workspace";

export default function WizardPage() {
  const { projectId, schemeId } = useParams<{ projectId: string; schemeId: string }>();
  const router = useRouter();
  const ctx = useSchemeWorkspace(schemeId);
  const { professional } = useCalcMode();
  const [step, setStep] = useState(0);
  const [aiChecking, setAiChecking] = useState(false);
  const [aiNotes, setAiNotes] = useState("");
  const [stepIssues, setStepIssues] = useState<FieldIssue[]>([]);
  const [showDiff, setShowDiff] = useState(false);
  const [navigating, setNavigating] = useState(false);

  const {
    scheme,
    schemeRef,
    meta,
    std,
    reasons,
    saveState,
    flushing,
    banner,
    setBanner,
    persist,
    validate,
    setCalculating,
    calculating,
    flushPendingChanges,
    sourceScheme,
    sourceDiffs,
  } = ctx;

  const fieldErrors = errorMap(stepIssues);
  const busy = navigating || flushing || calculating;

  useEffect(() => {
    if (!scheme) return;
    setStepIssues((prev) => {
      if (!prev.length) return prev;
      const next = validateWizardStep(step, scheme, meta, std, reasons);
      return next.filter((item) => prev.some((old) => old.field === item.field));
    });
  }, [scheme, meta, std, reasons, step]);

  const collectStepIssues = async (targetStep: number) => {
    const latest = schemeRef.current;
    if (!latest) return [];
    const local = validateWizardStep(targetStep, latest, meta, std, reasons);
    if (targetStep < 3) return local;
    const engine = await validate();
    return mergeIssues(local, engine.errors).map((item) => ({
      ...item,
      current: item.current ?? currentValueForField(latest, item.field),
    }));
  };

  const goToStep = async (target: number) => {
    if (!schemeRef.current || target === step || navigating) return;
    if (target < step) {
      setStepIssues([]);
      setStep(target);
      return;
    }
    setNavigating(true);
    try {
      const saved = await flushPendingChanges();
      // 即使保存失败，仍用本地最新值做逐步校验，避免“点了下一步却没有任何提示”
      for (let current = step; current < target; current += 1) {
        const issues = await collectStepIssues(current);
        if (issues.length) {
          setStep(current);
          setStepIssues(issues);
          setTimeout(() => scrollToField(issues[0].field), 50);
          if (!saved) setBanner("部分内容保存失败，请先修正标红字段后再继续。");
          return;
        }
      }
      if (!saved) {
        setBanner("保存尚未成功，请先处理保存失败后再进入下一步。");
        return;
      }
      setStepIssues([]);
      setStep(target);
      if (target === 4) await validate();
    } finally {
      setNavigating(false);
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
    if (calculating || flushing) return;
    setCalculating(true);
    try {
      const saved = await flushPendingChanges();
      if (!saved) {
        setBanner("保存尚未成功，请先处理保存失败后再开始测算，避免用旧参数出结果。");
        return;
      }
      const latest = schemeRef.current;
      if (!latest) return;
      const v = await validate();
      if (v.errors.length) {
        const issues = mergeIssues(validateWizardStep(4, latest, meta, std, reasons), v.errors).map((item) => ({
          ...item,
          current: currentValueForField(latest, item.field),
        }));
        setStepIssues(issues);
        if (issues[0]) setTimeout(() => scrollToField(issues[0].field), 50);
        return;
      }
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
    if (aiChecking || flushing) return;
    setAiChecking(true);
    try {
      const saved = await flushPendingChanges();
      if (!saved) {
        setAiNotes("保存尚未成功，请先处理保存失败后再做智能检查。");
        return;
      }
      const v = await validate();
      const lines = [
        "以下结果来自规则引擎，不是大模型生成的财务结论。",
        v.errors.length ? `发现 ${v.errors.length} 项阻断错误，必须修改。` : "规则引擎未发现阻断错误。",
        v.warnings.length ? `另有 ${v.warnings.length} 项风险提醒，可确认后继续。` : "暂无偏离标准的风险提醒。",
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

  const jumpToIssue = (issue: FieldIssue) => {
    const target = stepForField(issue.field);
    if (target !== step) setStep(target);
    setTimeout(() => scrollToField(issue.field), 80);
  };

  const pending = ctx.completeness?.pending ?? 0;
  const fillPercent = ctx.completeness?.percent ?? 0;
  const sourceSummary = summarizeParamChanges(sourceDiffs);

  return (
    <PageCanvas wide>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-sn-lg border border-white/50 bg-white/80 px-5 py-3 shadow-sn-card backdrop-blur-[20px]">
        <div>
          <div className="text-[16px] font-semibold">{scheme.project?.projectName || "项目测算"}</div>
          <div className="text-[13px] text-sn-secondary">
            {scheme.schemeName} · {saveState} · 填写进度 {fillPercent}% · 待完成 {pending} 项
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <CalcModeSwitch />
          <Button variant="ghost" onClick={() => router.push(`/projects/${projectId}/calculation`)}>
            退出
          </Button>
          <Button
            variant="secondary"
            disabled={busy}
            onClick={async () => {
              const saved = await flushPendingChanges();
              if (saved && schemeRef.current) await persist(schemeRef.current);
            }}
          >
            {flushing ? "正在保存…" : "保存草稿"}
          </Button>
        </div>
      </div>

      {sourceScheme && (
        <div className="mb-4 rounded-sn-md bg-sn-info/10 px-4 py-3 text-sm text-sn-secondary">
          <div className="font-semibold text-sn-primary">{scheme.schemeName}</div>
          <div className="mt-1">基于：{sourceScheme.schemeName}</div>
          <div className="mt-1">当前已调整 {sourceSummary.count} 项参数</div>
          <button type="button" className="mt-2 text-sn-info" onClick={() => setShowDiff(true)}>
            查看差异
          </button>
        </div>
      )}

      <CalculationStepper step={step} onChange={(index) => void goToStep(index)} />

      {banner && <div className="mb-4 rounded-sn-md bg-sn-error/12 px-4 py-3 text-sm text-[#C44747]">{banner}</div>}
      <StepIssueBanner issues={stepIssues} onJump={jumpToIssue} />
      {scheme.status === "baseline" && (
        <div className="mb-4 rounded-sn-md bg-sn-warning/15 px-4 py-3 text-sm text-[#8A5A10]">
          这是基准方案，不能直接覆盖。请先复制生成新版本再修改。
        </div>
      )}
      {professional && (
        <p className="mb-4 text-[12px] text-sn-muted">
          专业模式与普通模式共用同一份参数和计算引擎。当前规则版本 RULE_PACK_V1。填写进度只表示填了多少，能否测算由规则引擎决定。
        </p>
      )}

      {step === 0 && <StepBasic ctx={ctx} fieldErrors={fieldErrors} />}
      {step === 1 && <StepScenario ctx={ctx} fieldErrors={fieldErrors} />}
      {step === 2 && <StepOperations ctx={ctx} fieldErrors={fieldErrors} />}
      {step === 3 && <StepCost ctx={ctx} fieldErrors={fieldErrors} />}
      {step === 4 && (
        <StepConfirm
          ctx={ctx}
          onCalculate={() => void runCalculate()}
          onAiCheck={() => void runAiCheck()}
          onGoFix={jumpToIssue}
          aiChecking={aiChecking}
          aiNotes={aiNotes}
        />
      )}

      <div className="mt-6 flex justify-between">
        <Button variant="secondary" disabled={step === 0 || busy} onClick={() => void goToStep(step - 1)}>
          上一步
        </Button>
        <Button disabled={step === 4 || busy} onClick={() => void goToStep(step + 1)}>
          {navigating || flushing ? "正在保存…" : "下一步"}
        </Button>
      </div>

      {showDiff && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/20 p-4" onClick={() => setShowDiff(false)}>
          <div
            className="max-h-[80vh] w-full max-w-lg overflow-auto rounded-sn-lg border border-white/50 bg-white/85 p-6 shadow-sn-float backdrop-blur-[20px]"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-[20px] font-semibold">相对来源方案的参数差异</h3>
            <p className="mt-2 text-[13px] text-sn-secondary">
              基于 {sourceScheme?.schemeName}，当前已调整 {sourceSummary.count} 项。只列出事实差异，不推荐方案。
            </p>
            {sourceDiffs.length === 0 ? (
              <p className="mt-4 text-sn-secondary">还没有改动业务参数。</p>
            ) : (
              <ul className="mt-4 space-y-3 text-[14px]">
                {sourceDiffs.map((item) => (
                  <li key={item.key} className="rounded-sn-sm bg-sn-subtle p-3">
                    <div className="font-medium">{item.label}</div>
                    <div className="mt-1 text-[13px] text-sn-secondary">
                      {item.from} → {item.to}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <button type="button" className="mt-5 text-sm text-sn-info" onClick={() => setShowDiff(false)}>
              关闭
            </button>
          </div>
        </div>
      )}
    </PageCanvas>
  );
}
