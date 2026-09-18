"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AppHeader } from "@/components/app-header";
import { Character } from "@/components/empty";
import { Button, Card, Field, TextInput } from "@/components/ui";
import { api } from "@/lib/client";
import { formatPercent, formatMoney } from "@/lib/format";

type ProjectRow = {
  id: string;
  projectCode: string;
  projectName: string;
  customerName: string;
  projectManager: string;
  projectStatus: string;
  schemeCount: number;
  baselineSchemeName: string | null;
  baselineProfit: string | null;
  baselineMargin: string | null;
};

export default function HomePage() {
  const router = useRouter();
  const [rows, setRows] = useState<ProjectRow[]>([]);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    projectName: "",
    projectCode: "",
    customerName: "",
    projectManager: "",
  });

  const load = () =>
    api<ProjectRow[]>("/api/projects")
      .then(setRows)
      .catch((e) => setError(e.message));

  useEffect(() => {
    load();
  }, []);

  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      const created = await api<{ id: string }>("/api/projects", {
        method: "POST",
        body: JSON.stringify({
          projectName: form.projectName,
          projectCode: form.projectCode || undefined,
          customerName: form.customerName,
          projectManager: form.projectManager,
          projectStatus: "测算中",
        }),
      });
      router.push(`/projects/${created.id}/calculation`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "新建项目失败");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <AppHeader />
      <main className="mx-auto max-w-[1200px] px-6 py-10">
        <div className="mb-10 flex items-end justify-between gap-6">
          <div>
            <p className="text-[13px] font-medium tracking-[0.04em] text-sn-muted">PROJECT CALCULATION</p>
            <h1 className="mt-2 text-[30px] font-bold tracking-[-0.01em]">选择一个项目，进入经营测算</h1>
            <p className="mt-2 max-w-2xl text-[15px] text-sn-secondary">
              这不是在线 Excel。测算口径来自规则版本，结果可追溯、可对比、可设为基准。
            </p>
          </div>
          <div className="flex items-end gap-4">
            <Button onClick={() => setCreating(true)}>新建项目</Button>
            <Character mood="welcome" />
          </div>
        </div>
        {error && <p className="mb-4 text-sn-error">{error}</p>}
        {creating && (
          <Card className="mb-6">
            <h2 className="mb-4 text-[20px] font-semibold">新建项目</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="项目名称" required>
                <TextInput value={form.projectName} onChange={(e) => setForm({ ...form, projectName: e.target.value })} />
              </Field>
              <Field label="项目编号" hint="可留空，系统自动生成">
                <TextInput value={form.projectCode} onChange={(e) => setForm({ ...form, projectCode: e.target.value })} />
              </Field>
              <Field label="客户名称" required>
                <TextInput value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} />
              </Field>
              <Field label="项目经理" required>
                <TextInput value={form.projectManager} onChange={(e) => setForm({ ...form, projectManager: e.target.value })} />
              </Field>
            </div>
            <div className="mt-5 flex gap-3">
              <Button disabled={busy} onClick={submit}>
                {busy ? "创建中…" : "创建并进入测算"}
              </Button>
              <Button variant="secondary" onClick={() => setCreating(false)}>
                取消
              </Button>
            </div>
          </Card>
        )}
        {rows.length === 0 && !creating ? (
          <Card className="flex items-center gap-6">
            <Character mood="empty" />
            <div>
              <h3 className="text-[22px] font-semibold">还没有项目</h3>
              <p className="mt-2 text-sn-secondary">先建一个项目，再从一条线路开始测算。</p>
              <Button className="mt-4" onClick={() => setCreating(true)}>
                新建项目
              </Button>
            </div>
          </Card>
        ) : (
          <div className="grid gap-5 md:grid-cols-2">
            {rows.map((p) => (
              <Link key={p.id} href={`/projects/${p.id}/calculation`}>
                <Card hover className="h-full">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-[13px] text-sn-muted">{p.projectCode}</div>
                      <h2 className="mt-1 text-[22px] font-semibold">{p.projectName}</h2>
                      <p className="mt-2 text-[15px] text-sn-secondary">客户 {p.customerName}</p>
                    </div>
                    <span className="rounded-full bg-sn-info/12 px-3 py-1 text-[12px] text-sn-info">{p.projectStatus}</span>
                  </div>
                  <div className="mt-6 grid grid-cols-3 gap-3">
                    <div>
                      <div className="text-[12px] text-sn-muted">测算方案</div>
                      <div className="mt-1 text-[20px] font-bold">{p.schemeCount}</div>
                    </div>
                    <div>
                      <div className="text-[12px] text-sn-muted">基准月利润</div>
                      <div className="mt-1 text-[20px] font-bold">{p.baselineProfit ? formatMoney(p.baselineProfit) : "—"}</div>
                    </div>
                    <div>
                      <div className="text-[12px] text-sn-muted">基准利润率</div>
                      <div className="mt-1 text-[20px] font-bold">{p.baselineMargin ? formatPercent(p.baselineMargin) : "—"}</div>
                    </div>
                  </div>
                  <p className="mt-4 text-[13px] text-sn-secondary">当前基准：{p.baselineSchemeName || "尚未设置"}</p>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
