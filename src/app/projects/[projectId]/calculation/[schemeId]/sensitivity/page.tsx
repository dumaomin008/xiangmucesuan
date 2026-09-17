"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { CalculationSubnav } from "@/components/nav";
import { Button, Card, Field, PageHeader, Select, TextInput } from "@/components/ui";
import { api } from "@/lib/client";
import { formatMoney, formatPercent } from "@/lib/format";
import { SENSITIVITY_VARIABLES } from "@/lib/engine/types";

type Task = {
  id: string;
  results: {
    parameterChange: string;
    monthlyRevenue: string;
    monthlyCost: string;
    monthlyProfit: string;
    profitMargin: string | null;
    profitDelta: string;
    profitDeltaRate: string | null;
    isBaseline: boolean;
  }[];
};

export default function SensitivityPage() {
  const { projectId, schemeId } = useParams<{ projectId: string; schemeId: string }>();
  const [variableCode, setVariableCode] = useState(SENSITIVITY_VARIABLES[1].code);
  const [changeMode, setChangeMode] = useState<"PERCENT" | "ABSOLUTE">("PERCENT");
  const [minChange, setMinChange] = useState("-10");
  const [maxChange, setMaxChange] = useState("10");
  const [step, setStep] = useState("5");
  const [task, setTask] = useState<Task | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<{ results?: Task["results"] }[]>(`/api/calculation-schemes/${schemeId}/versions`).catch(() => undefined);
  }, [schemeId]);

  return (
    <div>
      <CalculationSubnav projectId={projectId} schemeId={schemeId} />
      <PageHeader title="敏感性分析" subtitle="每个情景都会重新调用完整计算引擎，禁止用简单比例推导利润。" />
      <Card className="mb-5 grid gap-4 md:grid-cols-5">
        <Field label="分析变量">
          <Select value={variableCode} onChange={(e) => setVariableCode(e.target.value as typeof variableCode)}>
            {SENSITIVITY_VARIABLES.map((v) => (
              <option key={v.code} value={v.code}>
                {v.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="变化方式">
          <Select value={changeMode} onChange={(e) => setChangeMode(e.target.value as "PERCENT" | "ABSOLUTE")}>
            <option value="PERCENT">百分比</option>
            <option value="ABSOLUTE">绝对值</option>
          </Select>
        </Field>
        <Field label="最小变化">
          <TextInput value={minChange} onChange={(e) => setMinChange(e.target.value)} />
        </Field>
        <Field label="最大变化">
          <TextInput value={maxChange} onChange={(e) => setMaxChange(e.target.value)} />
        </Field>
        <Field label="步长">
          <TextInput value={step} onChange={(e) => setStep(e.target.value)} />
        </Field>
      </Card>
      {error && <div className="mb-4 rounded-sn-md bg-sn-error/12 px-4 py-3 text-sm text-[#C44747]">{error}</div>}
      <Button
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError("");
          try {
            const data = await api<Task>(`/api/calculation-schemes/${schemeId}/sensitivity`, {
              method: "POST",
              body: JSON.stringify({ variableCode, changeMode, minChange, maxChange, step }),
            });
            setTask(data);
          } catch (e) {
            setError(e instanceof Error ? e.message : "分析失败");
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "正在完整重算各情景…" : "执行敏感性分析"}
      </Button>

      {task && (
        <Card className="mt-5 overflow-x-auto p-0">
          <table className="min-w-full text-left text-sm">
            <thead className="text-[12px] text-sn-muted">
              <tr>
                {["参数变化", "月营收", "月成本", "月利润", "利润率", "利润变化额", "利润变化率"].map((h) => (
                  <th key={h} className="px-4 py-3 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {task.results.map((row) => (
                <tr key={row.parameterChange} className={`border-t border-black/[0.04] ${row.isBaseline ? "bg-[#667EEA]/8" : ""}`}>
                  <td className="px-4 py-3">
                    {changeMode === "PERCENT" ? `${row.parameterChange}%` : row.parameterChange}
                    {row.isBaseline ? " · 基准" : ""}
                  </td>
                  <td className="px-4 py-3">{formatMoney(row.monthlyRevenue)}</td>
                  <td className="px-4 py-3">{formatMoney(row.monthlyCost)}</td>
                  <td className="px-4 py-3">{formatMoney(row.monthlyProfit)}</td>
                  <td className="px-4 py-3">{row.profitMargin ? formatPercent(row.profitMargin) : "无法计算"}</td>
                  <td className="px-4 py-3">{formatMoney(row.profitDelta)}</td>
                  <td className="px-4 py-3">{row.profitDeltaRate ? formatPercent(row.profitDeltaRate) : "无法计算"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
