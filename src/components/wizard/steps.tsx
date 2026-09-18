"use client";

import { useState, type ReactNode } from "react";
import { ArrowDown } from "lucide-react";
import { HelpTip, LiveMetricCard } from "@/components/wizard/help-tip";
import { api } from "@/lib/client";
import { Button, Card, Field, Select, TextArea, TextInput } from "@/components/ui";
import { formatMoney, formatQty } from "@/lib/format";
import { useCalcMode } from "@/lib/workspace/mode";
import { VEHICLE_FIELDS } from "@/lib/workspace/types";
import type { useSchemeWorkspace } from "@/lib/workspace/use-scheme-workspace";

type Ctx = ReturnType<typeof useSchemeWorkspace>;

function CostGroup({
  title,
  amount,
  open,
  onToggle,
  children,
}: {
  title: string;
  amount: number | null;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <Card>
      <button type="button" className="mb-3 flex w-full items-center justify-between" onClick={onToggle}>
        <h3 className="text-[18px] font-semibold">{title}</h3>
        <span className="text-[16px] font-bold">{amount != null ? formatMoney(amount) : "—"}</span>
      </button>
      {open && children}
    </Card>
  );
}

export function StepBasic({ ctx, onPatchProject }: { ctx: Ctx; onPatchProject: (patch: Record<string, string>) => void }) {
  const { scheme, meta, patch, patchFinance } = ctx;
  const { professional } = useCalcMode();
  if (!scheme || !meta) return null;
  const project = scheme.project;
  return (
    <div className="mx-auto max-w-[860px] space-y-5">
      {project && (
        <Card className="grid gap-5 md:grid-cols-2">
          <Field label="项目名称" required>
            <TextInput value={project.projectName} onChange={(e) => onPatchProject({ projectName: e.target.value })} />
          </Field>
          <Field label="客户名称" required>
            <TextInput value={project.customerName} onChange={(e) => onPatchProject({ customerName: e.target.value })} />
          </Field>
          <Field label="项目经理" required>
            <TextInput value={project.projectManager} onChange={(e) => onPatchProject({ projectManager: e.target.value })} />
          </Field>
          <Field label="业务类型">
            <TextInput value={project.projectStatus} readOnly />
          </Field>
        </Card>
      )}
      <Card className="grid gap-5 md:grid-cols-2">
        <Field label="测算方案名称" required>
          <TextInput value={scheme.schemeName} onChange={(e) => patch({ schemeName: e.target.value })} />
        </Field>
        <Field label="租赁形式" required hint="枚举来自配置，不写死中文判断" help={<HelpTip field="leaseType" />}>
          <Select value={scheme.leaseType} onChange={(e) => patch({ leaseType: e.target.value })}>
            {meta.leaseTypes.map((l) => (
              <option key={l.code} value={l.code}>
                {l.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="测算年限" required unit="年" source="项目填写" help={<HelpTip field="calculationYears" />}>
          <TextInput type="number" min={1} value={scheme.calculationYears} onChange={(e) => patch({ calculationYears: Number(e.target.value) })} />
        </Field>
        <Field label="年运营月数" required unit="月" source="项目填写" help={<HelpTip field="operatingMonthsYear" />}>
          <TextInput
            type="number"
            min={1}
            max={12}
            value={String(scheme.financeTaxPlan.operatingMonthsYear ?? 12)}
            onChange={(e) => patchFinance("operatingMonthsYear", Number(e.target.value))}
          />
        </Field>
        <Field label="预计项目开始时间">
          <TextInput type="date" value={scheme.expectedStartDate?.slice(0, 10) || ""} onChange={(e) => patch({ expectedStartDate: e.target.value })} />
        </Field>
        <Field label="预计项目结束时间">
          <TextInput type="date" value={scheme.expectedEndDate?.slice(0, 10) || ""} onChange={(e) => patch({ expectedEndDate: e.target.value })} />
        </Field>
        <div className="md:col-span-2">
          <Field label="项目描述">
            <TextArea rows={3} value={scheme.description || ""} onChange={(e) => patch({ description: e.target.value })} />
          </Field>
        </div>
        {professional && (
          <p className="md:col-span-2 text-[12px] text-sn-muted">
            专业模式：测算年限用于投资评价窗口；年运营月数用于把月度结果折成年。二者不要混用。
          </p>
        )}
      </Card>
    </div>
  );
}

export function StepScenario({ ctx }: { ctx: Ctx }) {
  const { scheme, meta, routeId, setRouteId, currentRoute, patchSegment, flushSegment, refreshRoutes } = ctx;
  const { professional } = useCalcMode();
  if (!scheme || !meta) return null;
  const summarySeg = currentRoute?.segments[0];
  return (
    <div className="grid gap-5 lg:grid-cols-[240px_minmax(0,1fr)]">
      <Card className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold">运输线路</h3>
          <button
            className="text-sm text-sn-info"
            onClick={async () => {
              const route = await api<{ id: string }>(`/api/calculation-schemes/${scheme.id}/routes`, {
                method: "POST",
                body: "{}",
              });
              await refreshRoutes();
              setRouteId(route.id);
            }}
          >
            新增线路
          </button>
        </div>
        <div className="space-y-2">
          {scheme.routes.map((r) => (
            <button
              key={r.id}
              onClick={() => setRouteId(r.id)}
              className={`w-full rounded-sn-sm px-3 py-3 text-left ${r.id === routeId ? "bg-sn-primary text-white" : "bg-sn-subtle"}`}
            >
              <div className="text-sm font-semibold">{r.routeName}</div>
              <div className="text-[12px] opacity-70">{r.segments.length} 个节点</div>
            </button>
          ))}
        </div>
        {currentRoute && (
          <div className="mt-4 flex flex-col gap-2">
            <Button
              variant="secondary"
              className="w-full"
              onClick={async () => {
                const created = await api<{ id: string }>(`/api/calculation-routes/${currentRoute.id}/copy`, { method: "POST" });
                await refreshRoutes();
                setRouteId(created.id);
              }}
            >
              复制线路
            </Button>
            <Button
              variant="ghost"
              className="w-full"
              onClick={async () => {
                await api(`/api/calculation-routes/${currentRoute.id}`, { method: "DELETE" });
                await refreshRoutes();
              }}
            >
              删除线路
            </Button>
          </div>
        )}
      </Card>
      {currentRoute ? (
        <div className="space-y-4">
          <Card className="grid gap-4 md:grid-cols-2">
            <Field label="线路名称" required>
              <TextInput
                value={currentRoute.routeName}
                onChange={async (e) => {
                  await api(`/api/calculation-routes/${currentRoute.id}`, {
                    method: "PUT",
                    body: JSON.stringify({ ...currentRoute, routeName: e.target.value }),
                  });
                  await refreshRoutes();
                }}
              />
            </Field>
            <Field label="线路说明">
              <TextInput
                value={currentRoute.description || ""}
                onChange={async (e) => {
                  await api(`/api/calculation-routes/${currentRoute.id}`, {
                    method: "PUT",
                    body: JSON.stringify({ ...currentRoute, description: e.target.value }),
                  });
                  await refreshRoutes();
                }}
              />
            </Field>
          </Card>
          {currentRoute.segments.map((seg, idx) => (
            <Card key={seg.id}>
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-[18px] font-semibold">{seg.segmentName || `路段 ${idx + 1}`}</h3>
                <button
                  className="text-[13px] text-sn-error"
                  onClick={async () => {
                    await api(`/api/calculation-segments/${seg.id}`, { method: "DELETE" });
                    await refreshRoutes();
                  }}
                >
                  删除
                </button>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="路段名称">
                  <TextInput value={seg.segmentName} onChange={(e) => patchSegment(scheme, seg.id, "segmentName", e.target.value)} onBlur={() => flushSegment(seg)} />
                </Field>
                <div />
                <Field label="装货地" required help={<HelpTip field="originName" />}>
                  <TextInput value={seg.originName} onChange={(e) => patchSegment(scheme, seg.id, "originName", e.target.value)} onBlur={() => flushSegment(seg)} />
                </Field>
                <Field label="卸货地" required help={<HelpTip field="destinationName" />}>
                  <TextInput value={seg.destinationName} onChange={(e) => patchSegment(scheme, seg.id, "destinationName", e.target.value)} onBlur={() => flushSegment(seg)} />
                </Field>
                <Field label="单程距离" required unit="km" help={<HelpTip field="distanceKm" />}>
                  <TextInput value={seg.distanceKm} onChange={(e) => patchSegment(scheme, seg.id, "distanceKm", e.target.value)} onBlur={() => flushSegment(seg)} />
                </Field>
                <Field label="单趟载重" required unit="吨" help={<HelpTip field="loadTon" />}>
                  <TextInput value={seg.loadTon} onChange={(e) => patchSegment(scheme, seg.id, "loadTon", e.target.value)} onBlur={() => flushSegment(seg)} />
                </Field>
              </div>
              <div className="mt-5 flex items-center justify-center gap-4 text-[13px] text-sn-secondary">
                <span className="rounded-sn-sm bg-sn-subtle px-3 py-2">{seg.originName || "装货地"}</span>
                <ArrowDown className="rotate-[-90deg]" size={16} />
                <span className="rounded-sn-sm bg-sn-subtle px-3 py-2">{seg.distanceKm || "—"} km</span>
                <ArrowDown className="rotate-[-90deg]" size={16} />
                <span className="rounded-sn-sm bg-sn-subtle px-3 py-2">{seg.destinationName || "卸货地"}</span>
              </div>
            </Card>
          ))}
          <Button
            variant="secondary"
            onClick={async () => {
              await api(`/api/calculation-routes/${currentRoute.id}/segments`, { method: "POST", body: "{}" });
              await refreshRoutes();
            }}
          >
            新增路段
          </Button>
          {summarySeg && (
            <p className="text-[14px] text-sn-secondary">
              当前运输场景：每趟约 {summarySeg.distanceKm || "—"} km，运输 {summarySeg.loadTon || "—"} 吨
              {currentRoute.segments.length > 1 ? `，共 ${currentRoute.segments.length} 个路段节点。` : "。"}
            </p>
          )}
          {professional && (
            <Card>
              <h4 className="mb-2 font-semibold">高级运输参数</h4>
              <Field label="线路权重" hint="预留字段，不参与本期测算。">
                <TextInput
                  type="number"
                  value={currentRoute.weight ?? ""}
                  onChange={async (e) => {
                  await api(`/api/calculation-routes/${currentRoute.id}`, {
                      method: "PUT",
                      body: JSON.stringify({ ...currentRoute, weight: e.target.value === "" ? null : Number(e.target.value) }),
                    });
                    await refreshRoutes();
                  }}
                />
              </Field>
            </Card>
          )}
        </div>
      ) : (
        <Card>
          <p className="text-sn-secondary">请先新增一条线路，再描述货从哪里到哪里。</p>
        </Card>
      )}
    </div>
  );
}

export function StepOperations({ ctx }: { ctx: Ctx }) {
  const { scheme, currentRoute, patch, patchFinance, patchSegment, flushSegment, helpers } = ctx;
  if (!scheme) return null;
  const months = Number(scheme.financeTaxPlan.operatingMonthsYear ?? 12);
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-5">
        <Card>
          <h3 className="mb-2 text-[20px] font-semibold">一天为什么能跑这些趟</h3>
          <p className="mb-5 text-[14px] text-sn-secondary">
            当前模型以「单车月趟数」为运营输入，不通过装卸/在途时间反推趟次。修改趟次后，右侧产能会按同一套计算逻辑更新。
          </p>
          <div className="grid gap-5 md:grid-cols-2">
            <Field label="车队规模" required unit="辆" help={<HelpTip field="fleetSize" />}>
              <TextInput type="number" min={1} value={scheme.fleetSize} onChange={(e) => patch({ fleetSize: Number(e.target.value) })} />
            </Field>
            <Field label="年运营月数" required unit="月" help={<HelpTip field="operatingMonthsYear" />}>
              <TextInput
                type="number"
                min={1}
                max={12}
                value={String(scheme.financeTaxPlan.operatingMonthsYear ?? 12)}
                onChange={(e) => patchFinance("operatingMonthsYear", Number(e.target.value))}
              />
            </Field>
          </div>
        </Card>
        {(currentRoute?.segments || []).map((seg) => (
          <Card key={seg.id}>
            <h4 className="mb-4 font-semibold">{seg.segmentName || "路段"}运营</h4>
            <div className="mb-5 flex flex-wrap items-stretch gap-3">
              {[
                { name: "装货", value: seg.originName || "—" },
                { name: "去程", value: `${seg.distanceKm || "—"} km` },
                { name: "卸货", value: seg.destinationName || "—" },
                { name: "月趟次", value: seg.tripsPerVehicleMonth || "—" },
              ].map((node) => (
                <div key={node.name} className="min-w-[120px] flex-1 rounded-sn-md bg-sn-subtle p-3">
                  <div className="text-[12px] text-sn-muted">{node.name}</div>
                  <div className="mt-1 text-[16px] font-semibold">{node.value}</div>
                </div>
              ))}
            </div>
            <div className="grid gap-5 md:grid-cols-2">
              <Field label="单车月趟数" required unit="趟/车/月" help={<HelpTip field="tripsPerVehicleMonth" />}>
                <TextInput
                  value={seg.tripsPerVehicleMonth}
                  onChange={(e) => patchSegment(scheme, seg.id, "tripsPerVehicleMonth", e.target.value)}
                  onBlur={() => flushSegment(seg)}
                />
              </Field>
              <Field label="单趟载重" unit="吨">
                <TextInput value={seg.loadTon} onChange={(e) => patchSegment(scheme, seg.id, "loadTon", e.target.value)} onBlur={() => flushSegment(seg)} />
              </Field>
            </div>
          </Card>
        ))}
      </div>
      <div className="space-y-3">
        {currentRoute?.segments.map((seg) => {
          const h = helpers[seg.id];
          return (
            <Card key={seg.id} className="space-y-3">
              <h4 className="font-semibold">{seg.segmentName || "路段"}实时产能</h4>
              <LiveMetricCard label="单车月运量" value={h ? `${formatQty(h.vehicleMonthlyVolume)} 吨` : "—"} highlight />
              <LiveMetricCard label="单车月里程" value={h ? `${formatQty(h.vehicleMonthlyMileage)} km` : "—"} highlight />
              <LiveMetricCard
                label="单车年运输能力"
                value={h ? `${formatQty(h.vehicleMonthlyVolume * months)} 吨` : "—"}
                hint={`月运量 × 年运营月数 ${months}`}
                highlight
              />
              <LiveMetricCard label="路段月运量" value={h ? `${formatQty(h.segmentMonthlyVolume)} 吨` : "—"} highlight />
            </Card>
          );
        })}
      </div>
    </div>
  );
}

export function StepCost({ ctx }: { ctx: Ctx }) {
  const { scheme, meta, std, reasons, setReasons, currentRoute, patchVehicle, patchFinance, patchSegment, flushSegment, preview, helpers } = ctx;
  const { professional } = useCalcMode();
  const [open, setOpen] = useState<Record<string, boolean>>({ income: true, vehicle: true, energy: true });
  if (!scheme || !meta) return null;
  const lease = meta.leaseTypes.find((l) => l.code === scheme.leaseType);
  const toggle = (key: string) => setOpen((s) => ({ ...s, [key]: !s[key] }));
  const renderVehicleGroup = (group: "vehicle" | "opex" | "insure" | "tire" | "driver") =>
    VEHICLE_FIELDS.filter((f) => f.group === group).map((f) => {
      if (group === "vehicle") {
        if (f.key === "downPaymentPerVehicle" && !lease?.showDownPayment) return null;
        if (f.key === "installmentMonths" && !lease?.showInstallment) return null;
        if (f.key === "monthlyRentPerVehicle" && !lease?.showMonthlyRent) return null;
      }
      const stdItem = f.std ? std.find((p) => p.parameterCode === f.std) : undefined;
      const current = String(scheme.vehiclePlan[f.key] ?? "");
      const overridden = Boolean(stdItem && current !== stdItem.value);
      return (
        <div key={f.key}>
          <Field
            label={f.label}
            unit={f.unit}
            required={
              (f.key === "downPaymentPerVehicle" && lease?.downPaymentRequired) ||
              (f.key === "installmentMonths" && lease?.installmentRequired) ||
              (f.key === "monthlyRentPerVehicle" && lease?.monthlyRentRequired)
            }
            source={stdItem ? "公司标准" : "项目填写"}
            overridden={overridden}
            help={f.key === "monthlyRentPerVehicle" || f.key === "driverCost" ? <HelpTip field={f.key} /> : undefined}
          >
            <TextInput value={current} onChange={(e) => patchVehicle(f.key, e.target.value)} />
          </Field>
          {stdItem && <p className="mt-1 text-[12px] text-sn-muted">标准值 {stdItem.value} {stdItem.unit}</p>}
          {overridden && (
            <Field label="调整原因" required>
              <TextInput value={reasons[f.std!] || ""} onChange={(e) => setReasons((r) => ({ ...r, [f.std!]: e.target.value }))} placeholder="覆盖公司标准必须填写原因" />
            </Field>
          )}
        </div>
      );
    });

  const costAmount = (codes: string[]) =>
    preview?.costBreakdown.filter((item) => codes.includes(item.code)).reduce((n, item) => n + Number(item.amount || 0), 0) ?? null;

  return (
    <div className="space-y-5">
      <Card>
        <button type="button" className="mb-4 flex w-full items-center justify-between" onClick={() => toggle("income")}>
          <div>
            <h3 className="text-[20px] font-semibold">收入从哪里来</h3>
            <p className="text-[13px] text-sn-secondary">运价来自现有路段字段，预计收入由计算引擎预览，不是估算。</p>
          </div>
          <span className="text-[22px] font-bold">{preview ? formatMoney(preview.annualRevenue) : "—"}</span>
        </button>
        {open.income &&
          (currentRoute?.segments || []).map((seg) => (
            <div key={seg.id} className="mb-4 grid gap-4 md:grid-cols-3">
              <Field label="运价" required help={<HelpTip field="freightPrice" />}>
                <TextInput value={seg.freightPrice} onChange={(e) => patchSegment(scheme, seg.id, "freightPrice", e.target.value)} onBlur={() => flushSegment(seg)} />
              </Field>
              <Field label="运价单位" required>
                <Select value={seg.freightPriceUnit} onChange={(e) => patchSegment(scheme, seg.id, "freightPriceUnit", e.target.value)} onBlur={() => flushSegment({ ...seg, freightPriceUnit: seg.freightPriceUnit })}>
                  {meta.units.map((u) => (
                    <option key={u.code} value={u.code}>
                      {u.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <LiveMetricCard label="该路段预计月收入" value={helpers[seg.id] ? formatMoney(helpers[seg.id].segmentMonthlyRevenue) : "—"} highlight />
            </div>
          ))}
      </Card>

      <CostGroup title="车辆成本" amount={costAmount(["vehicle_cost"])} open={open.vehicle} onToggle={() => toggle("vehicle")}>
        <div className="grid gap-5 md:grid-cols-2">{renderVehicleGroup("vehicle")}</div>
      </CostGroup>
      <CostGroup title="能源成本" amount={costAmount(["energy_cost"])} open={Boolean(open.energy)} onToggle={() => toggle("energy")}>
        {(currentRoute?.segments || []).map((seg) => (
          <div key={seg.id} className="mb-4 grid gap-4 md:grid-cols-3">
            <Field label="电价" unit="元/kWh" required help={<HelpTip field="electricityPrice" />}>
              <TextInput value={seg.electricityPrice} onChange={(e) => patchSegment(scheme, seg.id, "electricityPrice", e.target.value)} onBlur={() => flushSegment(seg)} />
            </Field>
            <Field label="满载能耗" unit="kWh/km" required help={<HelpTip field="loadedEnergyConsumption" />}>
              <TextInput value={seg.loadedEnergyConsumption} onChange={(e) => patchSegment(scheme, seg.id, "loadedEnergyConsumption", e.target.value)} onBlur={() => flushSegment(seg)} />
            </Field>
            <Field label="空载能耗" unit="kWh/km" required help={<HelpTip field="emptyEnergyConsumption" />}>
              <TextInput value={seg.emptyEnergyConsumption} onChange={(e) => patchSegment(scheme, seg.id, "emptyEnergyConsumption", e.target.value)} onBlur={() => flushSegment(seg)} />
            </Field>
          </div>
        ))}
      </CostGroup>
      <CostGroup title="人员成本" amount={costAmount(["driver_cost"])} open={Boolean(open.driver)} onToggle={() => toggle("driver")}>
        <div className="grid gap-5 md:grid-cols-2">
          <Field label="司机成本口径">
            <Select value={String(scheme.vehiclePlan.driverCostType || "PER_VEHICLE_MONTH")} onChange={(e) => patchVehicle("driverCostType", e.target.value)}>
              {meta.driverCostTypes.map((d) => (
                <option key={d.code} value={d.code}>
                  {d.name}
                </option>
              ))}
            </Select>
          </Field>
          {renderVehicleGroup("driver")}
          {(currentRoute?.segments || []).map((seg) => (
            <Field key={seg.id} label={`${seg.segmentName || "路段"}司机/趟`} unit="元">
              <TextInput value={seg.driverCostPerTrip} onChange={(e) => patchSegment(scheme, seg.id, "driverCostPerTrip", e.target.value)} onBlur={() => flushSegment(seg)} />
            </Field>
          ))}
        </div>
      </CostGroup>
      <CostGroup
        title="维修/运营成本"
        amount={costAmount(["management_fee", "road_maintenance_fee", "maintenance_fee", "parking_fee", "heater_fee", "consumable_fee"])}
        open={Boolean(open.opex)}
        onToggle={() => toggle("opex")}
      >
        <div className="grid gap-5 md:grid-cols-2">{renderVehicleGroup("opex")}</div>
      </CostGroup>
      <CostGroup title="保险税费" amount={costAmount(["inspection_fee", "insurance_fee", "tax_cost"])} open={open.insure !== false} onToggle={() => toggle("insure")}>
        <div className="grid gap-5 md:grid-cols-2">
          {VEHICLE_FIELDS.filter((f) => f.key === "annualInspectionFee" || f.key === "insuranceFee").map((f) => (
            <Field key={f.key} label={f.label} unit={f.unit} source="公司标准">
              <TextInput value={String(scheme.vehiclePlan[f.key] ?? "")} onChange={(e) => patchVehicle(f.key, e.target.value)} />
            </Field>
          ))}
        </div>
      </CostGroup>

      <Card>
        <button type="button" className="mb-3 flex w-full items-center justify-between" onClick={() => toggle("other")}>
          <h3 className="text-[18px] font-semibold">其他成本</h3>
          <span className="text-[13px] text-sn-muted">{open.other ? "收起" : "展开"}</span>
        </button>
        {open.other && (
          <div className="space-y-4">
            {(currentRoute?.segments || []).map((seg) => (
              <div key={seg.id} className="grid gap-4 md:grid-cols-4">
                <Field label="过路费" unit="元/趟">
                  <TextInput value={seg.tollPerTrip} onChange={(e) => patchSegment(scheme, seg.id, "tollPerTrip", e.target.value)} onBlur={() => flushSegment(seg)} />
                </Field>
                <Field label="装卸费" unit="元">
                  <TextInput value={seg.loadingUnloadingFee} onChange={(e) => patchSegment(scheme, seg.id, "loadingUnloadingFee", e.target.value)} onBlur={() => flushSegment(seg)} />
                </Field>
                <Field label="信息费" unit="元">
                  <TextInput value={seg.informationFee} onChange={(e) => patchSegment(scheme, seg.id, "informationFee", e.target.value)} onBlur={() => flushSegment(seg)} />
                </Field>
              </div>
            ))}
            <div className="grid gap-5 md:grid-cols-2">{renderVehicleGroup("tire")}</div>
          </div>
        )}
      </Card>

      {(professional || open.finance) && (
        <Card>
          <button type="button" className="mb-3 text-[18px] font-semibold" onClick={() => toggle("finance")}>
            展开高级财务税务参数
          </button>
          {(professional || open.finance) && (
            <div className="grid gap-5 md:grid-cols-2">
              <Field label="应收回款周期" unit="月">
                <TextInput value={String(scheme.financeTaxPlan.receivableCycle)} onChange={(e) => patchFinance("receivableCycle", Number(e.target.value))} />
              </Field>
              <Field label="流动资金贷款周期" unit="月">
                <TextInput value={String(scheme.financeTaxPlan.workingCapitalLoanCycle)} onChange={(e) => patchFinance("workingCapitalLoanCycle", Number(e.target.value))} />
              </Field>
              <Field label="流动资金贷款利率" unit="年利率" source="公司标准">
                <TextInput value={String(scheme.financeTaxPlan.workingCapitalInterestRate)} onChange={(e) => patchFinance("workingCapitalInterestRate", e.target.value)} />
              </Field>
              <Field label="营收垫资资金成本率" unit="年利率" source="公司标准">
                <TextInput value={String(scheme.financeTaxPlan.discountRate)} onChange={(e) => patchFinance("discountRate", e.target.value)} />
              </Field>
              <Field label="车辆折旧年限" unit="月">
                <TextInput value={String(scheme.financeTaxPlan.depreciationMonths ?? 60)} onChange={(e) => patchFinance("depreciationMonths", Number(e.target.value))} />
              </Field>
              <Field label="项目经营月数" unit="月">
                <TextInput
                  value={scheme.financeTaxPlan.projectOperatingMonths == null ? "" : String(scheme.financeTaxPlan.projectOperatingMonths)}
                  onChange={(e) => patchFinance("projectOperatingMonths", e.target.value === "" ? null : Number(e.target.value))}
                />
              </Field>
              <Field label="销项税率">
                <TextInput value={String(scheme.financeTaxPlan.outputVatRate)} onChange={(e) => patchFinance("outputVatRate", e.target.value)} />
              </Field>
              <Field label="进项税规则">
                <Select value={String(scheme.financeTaxPlan.inputVatRule)} onChange={(e) => patchFinance("inputVatRule", e.target.value)}>
                  {meta.vatRules.map((v) => (
                    <option key={v.code} value={v.code}>
                      {v.name}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          )}
        </Card>
      )}
      {!professional && (
        <button type="button" className="text-[13px] text-sn-info" onClick={() => toggle("finance")}>
          展开高级财务税务参数
        </button>
      )}

      <div className="sticky bottom-0 z-10 grid gap-3 rounded-sn-lg border border-white/50 bg-white/80 p-4 shadow-sn-float backdrop-blur-[20px] md:grid-cols-4">
        <LiveMetricCard label="年收入" value={preview ? formatMoney(preview.annualRevenue) : "—"} hint="月营收 × 年运营月数" highlight />
        <LiveMetricCard label="年成本" value={preview ? formatMoney(preview.annualTotalCost) : "—"} highlight />
        <LiveMetricCard label="年利润" value={preview ? formatMoney(preview.annualProfit) : "—"} highlight />
        <LiveMetricCard label="利润率" value={preview?.profitMargin ? `${(Number(preview.profitMargin) * 100).toFixed(2)}%` : "—"} highlight />
      </div>
    </div>
  );
}

export function StepConfirm({
  ctx,
  onCalculate,
  onAiCheck,
  aiChecking,
  aiNotes,
}: {
  ctx: Ctx;
  onCalculate: () => void;
  onAiCheck: () => void;
  aiChecking: boolean;
  aiNotes: string;
}) {
  const { scheme, meta, completeness, errors, warnings, calculating, preview } = ctx;
  if (!scheme || !meta) return null;
  const lease = meta.leaseTypes.find((l) => l.code === scheme.leaseType);
  const blocked = errors.length > 0;
  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <div className="text-[13px] text-sn-muted">参数完整度</div>
          <div className="mt-2 text-[28px] font-extrabold">{completeness?.percent ?? 0}%</div>
        </Card>
        <Card>
          <div className="text-[13px] text-sn-muted">已填写参数</div>
          <div className="mt-2 text-[28px] font-extrabold">{completeness?.filled ?? 0}</div>
        </Card>
        <Card>
          <div className="text-[13px] text-sn-muted">系统计算参数</div>
          <div className="mt-2 text-[28px] font-extrabold">{completeness?.computed ?? 0}</div>
        </Card>
        <Card>
          <div className="text-[13px] text-sn-muted">待确认 / 待补</div>
          <div className="mt-2 text-[28px] font-extrabold">{completeness?.pending ?? 0}</div>
        </Card>
      </div>
      <Card>
        <h3 className="mb-2 text-[20px] font-semibold">测算前核对</h3>
        <p className="text-sn-secondary">
          租赁 {lease?.name} · 车辆 {scheme.fleetSize} 辆 · 线路 {scheme.routes.length} 条 · 年运营 {String(scheme.financeTaxPlan.operatingMonthsYear ?? 12)} 个月
          {preview ? ` · 预览月利润 ${formatMoney(preview.monthlyProfit)}` : ""}
        </p>
        {completeness && completeness.missing.length > 0 && (
          <ul className="mt-3 list-disc pl-5 text-[13px] text-sn-secondary">
            {completeness.missing.slice(0, 8).map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        )}
      </Card>
      {errors.length > 0 && (
        <Card className="bg-sn-error/10">
          <h3 className="font-semibold text-[#C44747]">阻断错误，必须修改后才能测算</h3>
          <ul className="mt-2 list-disc pl-5 text-sm text-[#C44747]">
            {errors.map((e) => (
              <li key={e.field}>{e.message}</li>
            ))}
          </ul>
        </Card>
      )}
      {warnings.length > 0 && (
        <Card className="bg-sn-warning/10">
          <h3 className="font-semibold text-[#8A5A10]">风险提醒，可修改或确认后继续</h3>
          <ul className="mt-2 list-disc pl-5 text-sm text-[#8A5A10]">
            {warnings.map((e) => (
              <li key={e.field}>{e.message}</li>
            ))}
          </ul>
        </Card>
      )}
      {errors.length === 0 && warnings.length === 0 && (
        <Card className="bg-sn-success/10">
          <h3 className="font-semibold text-sn-success">规则检查正常</h3>
          <p className="mt-2 text-[14px] text-sn-secondary">必填项和合法范围已通过。正式结果仍由计算引擎在点击开始测算后生成。</p>
        </Card>
      )}
      {aiNotes && (
        <Card>
          <h3 className="mb-2 font-semibold">AI 检查</h3>
          <p className="whitespace-pre-wrap text-[14px] leading-6 text-sn-secondary">{aiNotes}</p>
        </Card>
      )}
      <div className="flex flex-wrap gap-3">
        <Button variant="secondary" disabled={aiChecking} onClick={onAiCheck}>
          {aiChecking ? "正在检查…" : "AI 检查当前步骤"}
        </Button>
        <Button disabled={calculating || blocked} onClick={onCalculate}>
          {calculating ? "正在执行项目测算…" : "开始测算"}
        </Button>
      </div>
      {calculating && (
        <p className="text-[13px] text-sn-muted">校验参数 → 调用计算引擎 → 固化结果版本。不会用 AI 生成财务数字。</p>
      )}
    </div>
  );
}

