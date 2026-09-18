"use client";

import { useEffect, useState } from "react";
import { PageCanvas } from "@/components/shell/app-shell";
import { Button, Card, Field, PageHeader, Select, TextArea, TextInput } from "@/components/ui";
import { api } from "@/lib/client";
import { formatDateTime } from "@/lib/format";

type Param = {
  id: string;
  parameterCode: string;
  parameterName: string;
  category: string;
  value: string;
  unit: string;
  version: string;
  enabled: boolean;
  effectiveDate: string;
  expireDate: string | null;
  description: string | null;
  scope: string;
};

const CATS = ["车辆", "能源", "轮胎", "人工", "财务", "税务", "管理费", "其他"];

export default function AdminParametersPage() {
  const [rows, setRows] = useState<Param[]>([]);
  const [cat, setCat] = useState("全部");
  const [editing, setEditing] = useState<Param | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ parameterCode: "", parameterName: "", category: "其他", value: "", unit: "", description: "" });
  const [error, setError] = useState("");

  const load = () => api<Param[]>("/api/standard-parameters").then(setRows);
  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, []);

  const filtered = rows.filter((r) => cat === "全部" || r.category === cat);

  return (
    <PageCanvas wide>
      <PageHeader
          title="参数标准库"
          subtitle="管理员维护公司统一测算口径。修改会升版本，不会静默改写历史测算结果。"
          actions={<Button onClick={() => setCreating(true)}>新增参数</Button>}
        />
        {error && <div className="mb-4 text-sm text-sn-error">{error}</div>}
        <div className="mb-5 flex flex-wrap gap-2">
          {["全部", ...CATS].map((c) => (
            <button
              key={c}
              onClick={() => setCat(c)}
              className={`rounded-full px-4 py-2 text-[13px] ${cat === c ? "bg-sn-primary text-white" : "bg-white shadow-sn-card"}`}
            >
              {c}
            </button>
          ))}
        </div>
        <Card className="overflow-x-auto p-0">
          <table className="min-w-full text-left text-sm">
            <thead className="text-[12px] text-sn-muted">
              <tr>
                {["编码", "名称", "分类", "当前值", "单位", "版本", "生效日", "失效日", "状态", "适用范围", "操作"].map((h) => (
                  <th key={h} className="px-4 py-3 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-t border-black/[0.04]">
                  <td className="px-4 py-3">{r.parameterCode}</td>
                  <td className="px-4 py-3">{r.parameterName}</td>
                  <td className="px-4 py-3">{r.category}</td>
                  <td className="px-4 py-3 font-semibold">{r.value}</td>
                  <td className="px-4 py-3">{r.unit}</td>
                  <td className="px-4 py-3">{r.version}</td>
                  <td className="px-4 py-3">{formatDateTime(r.effectiveDate)}</td>
                  <td className="px-4 py-3">{r.expireDate ? formatDateTime(r.expireDate) : "—"}</td>
                  <td className="px-4 py-3">{r.enabled ? "启用" : "停用"}</td>
                  <td className="px-4 py-3">{r.scope}</td>
                  <td className="px-4 py-3">
                    <button className="text-sn-info" onClick={() => setEditing(r)}>
                      编辑
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        {(editing || creating) && (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/20 p-4">
            <div className="w-full max-w-lg rounded-sn-lg border border-white/50 bg-white/85 p-8 shadow-sn-float backdrop-blur-[20px]">
              <h3 className="mb-4 text-[22px] font-semibold">{creating ? "新增标准参数" : "编辑标准参数"}</h3>
              {creating && (
                <div className="mb-3 grid gap-3">
                  <Field label="编码" required>
                    <TextInput value={form.parameterCode} onChange={(e) => setForm({ ...form, parameterCode: e.target.value })} />
                  </Field>
                  <Field label="名称" required>
                    <TextInput value={form.parameterName} onChange={(e) => setForm({ ...form, parameterName: e.target.value })} />
                  </Field>
                  <Field label="分类">
                    <Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                      {CATS.map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </Select>
                  </Field>
                </div>
              )}
              <Field label="取值" required>
                <TextInput
                  value={creating ? form.value : editing?.value || ""}
                  onChange={(e) => (creating ? setForm({ ...form, value: e.target.value }) : setEditing({ ...editing!, value: e.target.value }))}
                />
              </Field>
              <div className="mt-3">
                <Field label="单位">
                  <TextInput
                    value={creating ? form.unit : editing?.unit || ""}
                    onChange={(e) => (creating ? setForm({ ...form, unit: e.target.value }) : setEditing({ ...editing!, unit: e.target.value }))}
                  />
                </Field>
              </div>
              <div className="mt-3">
                <Field label="说明">
                  <TextArea
                    rows={3}
                    value={creating ? form.description : editing?.description || ""}
                    onChange={(e) =>
                      creating ? setForm({ ...form, description: e.target.value }) : setEditing({ ...editing!, description: e.target.value })
                    }
                  />
                </Field>
              </div>
              <div className="mt-6 flex gap-3">
                <Button
                  onClick={async () => {
                    setError("");
                    try {
                      if (creating) {
                        await api("/api/standard-parameters", { method: "POST", body: JSON.stringify(form) });
                      } else if (editing) {
                        await api(`/api/standard-parameters/${editing.id}`, {
                          method: "PUT",
                          body: JSON.stringify({ ...editing, bumpVersion: true }),
                        });
                      }
                      setCreating(false);
                      setEditing(null);
                      await load();
                    } catch (e) {
                      setError(e instanceof Error ? e.message : "保存失败");
                    }
                  }}
                >
                  保存并升版本
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setCreating(false);
                    setEditing(null);
                  }}
                >
                  取消
                </Button>
                {editing && (
                  <Button
                    variant="ghost"
                    onClick={async () => {
                      await api(`/api/standard-parameters/${editing.id}`, {
                        method: "PUT",
                        body: JSON.stringify({ enabled: !editing.enabled }),
                      });
                      setEditing(null);
                      await load();
                    }}
                  >
                    {editing.enabled ? "停用" : "启用"}
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
    </PageCanvas>
  );
}
