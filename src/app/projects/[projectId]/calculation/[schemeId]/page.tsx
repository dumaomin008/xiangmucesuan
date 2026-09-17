"use client";

import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CalculationSubnav } from "@/components/nav";
import { Button, Card, Field, PageHeader, Select, TextArea, TextInput } from "@/components/ui";
import { api } from "@/lib/client";
import { DEFAULT_RULE_SET } from "@/lib/engine/rule-engine";
import { previewSegmentHelpers } from "@/lib/engine/calculate";
import { formatMoney, formatQty } from "@/lib/format";

type Segment = {
  id: string;
  segmentName: string;
  originName: string;
  destinationName: string;
  distanceKm: string;
  freightPrice: string;
  freightPriceUnit: string;
  loadTon: string;
  tripsPerVehicleMonth: string;
  operatingMonthsYear: string;
  electricityPrice: string;
  loadedEnergyConsumption: string;
  emptyEnergyConsumption: string;
  tollPerTrip: string;
  loadingUnloadingFee: string;
  informationFee: string;
  driverCostPerTrip: string;
  sortNo: number;
};
type Route = {
  id: string;
  routeName: string;
  routeCode: string;
  description: string | null;
  weight: number | null;
  sortNo: number;
  segments: Segment[];
};
type Vehicle = Record<string, string | number>;
type Finance = Record<string, string | number>;
type Scheme = {
  id: string;
  schemeName: string;
  description: string | null;
  leaseType: string;
  fleetSize: number;
  calculationYears: number;
  expectedStartDate: string | null;
  expectedEndDate: string | null;
  status: string;
  routes: Route[];
  vehiclePlan: Vehicle;
  financeTaxPlan: Finance;
  overrides: { parameterCode: string; standardValue: string; overrideValue: string; overrideReason: string }[];
};
type Meta = {
  leaseTypes: { code: string; name: string; showDownPayment: boolean; showInstallment: boolean; showMonthlyRent: boolean; downPaymentRequired: boolean; installmentRequired: boolean; monthlyRentRequired: boolean }[];
  units: { code: string; name: string }[];
  vatRules: { code: string; name: string }[];
  driverCostTypes: { code: string; name: string }[];
};
type Std = { parameterCode: string; parameterName: string; value: string; unit: string; category: string };

const STEPS = ["基础信息", "线路运输", "运力成本", "财务税务", "确认并测算"];

const VEHICLE_FIELDS: { key: string; label: string; unit: string; std?: string; group: string }[] = [
  { key: "downPaymentPerVehicle", label: "单车首付", unit: "元", group: "A" },
  { key: "installmentMonths", label: "分期月份", unit: "月", group: "A" },
  { key: "monthlyRentPerVehicle", label: "单车月租", unit: "元/车/月", group: "A" },
  { key: "managementFeePerVehicle", label: "单车月管理费", unit: "元/车/月", std: "STD_MANAGEMENT_FEE", group: "B" },
  { key: "roadMaintenanceFee", label: "路保费", unit: "元/车/月", std: "STD_ROAD_MAINTENANCE_FEE", group: "B" },
  { key: "maintenanceFee", label: "维保费", unit: "元/车/月", std: "STD_MAINTENANCE_FEE", group: "B" },
  { key: "annualInspectionFee", label: "年审费", unit: "元/车/月", std: "STD_ANNUAL_INSPECTION_FEE", group: "B" },
  { key: "insuranceFee", label: "保险费", unit: "元/车/月", std: "STD_INSURANCE_FEE", group: "B" },
  { key: "parkingFee", label: "停车费", unit: "元/车/月", std: "STD_PARKING_FEE", group: "B" },
  { key: "heaterFee", label: "柴暖费", unit: "元/车/月", std: "STD_HEATER_FEE", group: "B" },
  { key: "consumableFee", label: "消耗费用", unit: "元/车/月", std: "STD_CONSUMABLE_FEE", group: "B" },
  { key: "tireLifeKm", label: "轮胎寿命", unit: "km", std: "STD_TIRE_LIFE", group: "C" },
  { key: "tireCount", label: "单车轮胎数量", unit: "条", std: "STD_TIRE_COUNT", group: "C" },
  { key: "tireUnitPrice", label: "轮胎均价", unit: "元/条", std: "STD_TIRE_PRICE", group: "C" },
  { key: "driverCost", label: "司机成本", unit: "按口径", std: "STD_DRIVER_COST", group: "D" },
];

export default function WizardPage() {
  const { projectId, schemeId } = useParams<{ projectId: string; schemeId: string }>();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [scheme, setScheme] = useState<Scheme | null>(null);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [std, setStd] = useState<Std[]>([]);
  const [routeId, setRouteId] = useState<string>("");
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [saveState, setSaveState] = useState("已自动保存草稿");
  const [errors, setErrors] = useState<{ field: string; message: string }[]>([]);
  const [warnings, setWarnings] = useState<{ field: string; message: string }[]>([]);
  const [banner, setBanner] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    const [s, m, p] = await Promise.all([
      api<Scheme>(`/api/calculation-schemes/${schemeId}`),
      api<Meta>("/api/meta"),
      api<Std[]>("/api/standard-parameters"),
    ]);
    setScheme(s);
    setMeta(m);
    setStd(p);
    setRouteId((prev) => prev || s.routes[0]?.id || "");
    const nextReasons: Record<string, string> = {};
    for (const o of s.overrides) nextReasons[o.parameterCode] = o.overrideReason;
    setReasons(nextReasons);
  }, [schemeId]);

  useEffect(() => {
    load().catch((e) => setBanner(e.message));
  }, [load]);

  const persist = useCallback(
    async (next: Scheme) => {
      setSaveState("正在保存草稿…");
      await api(`/api/calculation-schemes/${schemeId}`, {
        method: "PUT",
        body: JSON.stringify({
          schemeName: next.schemeName,
          description: next.description,
          leaseType: next.leaseType,
          fleetSize: next.fleetSize,
          calculationYears: next.calculationYears,
          expectedStartDate: next.expectedStartDate,
          expectedEndDate: next.expectedEndDate,
          vehicle: next.vehiclePlan,
          finance: next.financeTaxPlan,
          overrides: std
            .filter((p) => VEHICLE_FIELDS.some((f) => f.std === p.parameterCode))
            .map((p) => {
              const field = VEHICLE_FIELDS.find((f) => f.std === p.parameterCode)!;
              const current = String(next.vehiclePlan[field.key] ?? "");
              if (current === p.value) return null;
              return {
                parameterCode: p.parameterCode,
                parameterName: p.parameterName,
                standardValue: p.value,
                overrideValue: current,
                overrideReason: reasons[p.parameterCode] || "",
                unit: p.unit,
              };
            })
            .filter(Boolean),
        }),
      });
      setSaveState("已自动保存草稿");
    },
    [reasons, schemeId, std],
  );

  const scheduleSave = (next: Scheme) => {
    setScheme(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      persist(next).catch((e) => setBanner(e.message));
    }, 800);
  };

  const lease = meta?.leaseTypes.find((l) => l.code === scheme?.leaseType);
  const currentRoute = scheme?.routes.find((r) => r.id === routeId);

  const helpers = useMemo(() => {
    if (!scheme || !currentRoute) return {};
    const map: Record<string, ReturnType<typeof previewSegmentHelpers>> = {};
    for (const seg of currentRoute.segments) {
      try {
        map[seg.id] = previewSegmentHelpers(
          { fleetSize: scheme.fleetSize, ruleSet: DEFAULT_RULE_SET },
          { ...seg, routeId: currentRoute.id, enabled: true },
          currentRoute.id,
        );
      } catch {
        /* preview only */
      }
    }
    return map;
  }, [scheme, currentRoute]);

  if (!scheme || !meta) {
    return <div className="py-20 text-center text-sn-secondary">正在加载方案…</div>;
  }

  const patch = (partial: Partial<Scheme>) => scheduleSave({ ...scheme, ...partial });
  const patchVehicle = (key: string, value: string | number) =>
    scheduleSave({ ...scheme, vehiclePlan: { ...scheme.vehiclePlan, [key]: value, fleetSize: scheme.fleetSize, leaseType: scheme.leaseType } });
  const patchFinance = (key: string, value: string | number | null) =>
    scheduleSave({ ...scheme, financeTaxPlan: { ...scheme.financeTaxPlan, [key]: value as string | number } });

  const refreshRoutes = async () => {
    const s = await api<Scheme>(`/api/calculation-schemes/${schemeId}`);
    setScheme(s);
    if (!s.routes.find((r) => r.id === routeId)) setRouteId(s.routes[0]?.id || "");
  };

  const validate = async () => {
    const data = await api<{ errors: { field: string; message: string }[]; warnings: { field: string; message: string }[] }>(
      `/api/calculation-schemes/${schemeId}/calculate?validate=1`,
    );
    setErrors(data.errors);
    setWarnings(data.warnings);
    return data;
  };

  return (
    <div>
      <CalculationSubnav projectId={projectId} schemeId={schemeId} />
      <PageHeader
        title={scheme.schemeName}
        subtitle={`分步配置 · ${saveState}。正式测算才会冻结不可变参数快照。`}
        actions={
          <>
            <Button variant="ghost" onClick={() => router.push(`/projects/${projectId}/calculation`)}>
              退出
            </Button>
            <Button variant="secondary" onClick={() => persist(scheme)}>
              保存草稿
            </Button>
          </>
        }
      />

      <div className="mb-6 grid grid-cols-5 gap-2">
        {STEPS.map((label, i) => (
          <button
            key={label}
            onClick={() => setStep(i)}
            className={`rounded-sn-md px-3 py-3 text-[13px] font-semibold transition ${
              i === step ? "bg-sn-primary text-white" : "bg-white text-sn-secondary shadow-sn-card"
            }`}
          >
            {i + 1}. {label}
          </button>
        ))}
      </div>

      {banner && <div className="mb-4 rounded-sn-md bg-sn-error/12 px-4 py-3 text-sm text-[#C44747]">{banner}</div>}
      {scheme.status === "baseline" && (
        <div className="mb-4 rounded-sn-md bg-sn-warning/15 px-4 py-3 text-sm text-[#8A5A10]">
          这是基准方案，不能直接覆盖。请先复制生成新版本再修改。
        </div>
      )}

      {step === 0 && (
        <Card className="grid gap-5 md:grid-cols-2">
          <Field label="测算方案名称" required>
            <TextInput value={scheme.schemeName} onChange={(e) => patch({ schemeName: e.target.value })} />
          </Field>
          <Field label="租赁形式" required hint="枚举来自配置，不写死中文判断">
            <Select value={scheme.leaseType} onChange={(e) => patch({ leaseType: e.target.value })}>
              {meta.leaseTypes.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="车队规模" required unit="辆">
            <TextInput type="number" min={1} value={scheme.fleetSize} onChange={(e) => patch({ fleetSize: Number(e.target.value) })} />
          </Field>
          <Field label="测算年限" required unit="年">
            <TextInput type="number" min={1} value={scheme.calculationYears} onChange={(e) => patch({ calculationYears: Number(e.target.value) })} />
          </Field>
          <Field label="预计项目开始时间">
            <TextInput type="date" value={scheme.expectedStartDate?.slice(0, 10) || ""} onChange={(e) => patch({ expectedStartDate: e.target.value })} />
          </Field>
          <Field label="预计项目结束时间">
            <TextInput type="date" value={scheme.expectedEndDate?.slice(0, 10) || ""} onChange={(e) => patch({ expectedEndDate: e.target.value })} />
          </Field>
          <div className="md:col-span-2">
            <Field label="方案说明">
              <TextArea rows={3} value={scheme.description || ""} onChange={(e) => patch({ description: e.target.value })} />
            </Field>
          </div>
        </Card>
      )}

      {step === 1 && (
        <div className="grid gap-5 lg:grid-cols-[260px_1fr]">
          <Card className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-semibold">线路</h3>
              <button
                className="text-sm text-sn-info"
                onClick={async () => {
                  const route = await api<Route>(`/api/calculation-schemes/${schemeId}/routes`, { method: "POST", body: "{}" });
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
                  <div className="text-[12px] opacity-70">{r.segments.length} 个路段</div>
                </button>
              ))}
            </div>
            {currentRoute && (
              <div className="mt-4 flex flex-col gap-2">
                <Button
                  variant="secondary"
                  className="w-full"
                  onClick={async () => {
                    const created = await api<Route>(`/api/calculation-routes/${currentRoute.id}/copy`, { method: "POST" });
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
            <Card className="overflow-x-auto">
              <div className="grid gap-4 md:grid-cols-3">
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
                <Field label="线路权重" hint="高级字段，非必填，待业务确认">
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
              </div>
              <div className="mt-6 overflow-x-auto">
                <table className="min-w-[1400px] text-left text-[13px]">
                  <thead className="text-sn-muted">
                    <tr>
                      {["序号", "路段名称", "起点", "终点", "里程 km*", "运价 元/吨*", "运价单位*", "载重 t*", "月趟数*", "年运营月*", "电价 元/kWh*", "满载能耗 kWh/km*", "空载能耗 kWh/km*", "过路费", "装卸费", "信息费", "司机/趟", "辅助指标", "操作"].map((h) => (
                        <th key={h} className="px-2 py-2 font-medium">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {currentRoute.segments.map((seg, idx) => (
                      <tr key={seg.id} className="border-t border-black/[0.04] align-top">
                        <td className="px-2 py-2">{idx + 1}</td>
                        {(
                          [
                            ["segmentName"],
                            ["originName"],
                            ["destinationName"],
                            ["distanceKm"],
                            ["freightPrice"],
                            ["freightPriceUnit"],
                            ["loadTon"],
                            ["tripsPerVehicleMonth"],
                            ["operatingMonthsYear"],
                            ["electricityPrice"],
                            ["loadedEnergyConsumption"],
                            ["emptyEnergyConsumption"],
                            ["tollPerTrip"],
                            ["loadingUnloadingFee"],
                            ["informationFee"],
                            ["driverCostPerTrip"],
                          ] as [keyof Segment][]
                        ).map(([key]) => (
                          <td key={key} className="px-2 py-2">
                            {key === "freightPriceUnit" ? (
                              <Select
                                value={seg[key]}
                                onChange={async (e) => {
                                  await api(`/api/calculation-segments/${seg.id}`, {
                                    method: "PUT",
                                    body: JSON.stringify({ ...seg, [key]: e.target.value }),
                                  });
                                  await refreshRoutes();
                                }}
                              >
                                {meta.units.map((u) => (
                                  <option key={u.code} value={u.code}>
                                    {u.name}
                                  </option>
                                ))}
                              </Select>
                            ) : (
                              <TextInput
                                className="min-w-[90px]"
                                value={String(seg[key] ?? "")}
                                onChange={async (e) => {
                                  await api(`/api/calculation-segments/${seg.id}`, {
                                    method: "PUT",
                                    body: JSON.stringify({ ...seg, [key]: e.target.value }),
                                  });
                                  await refreshRoutes();
                                }}
                              />
                            )}
                          </td>
                        ))}
                        <td className="px-2 py-2 text-[12px] text-sn-secondary">
                          {helpers[seg.id] ? (
                            <div className="space-y-1">
                              <div>单车月运量 {formatQty(helpers[seg.id].vehicleMonthlyVolume)}</div>
                              <div>单车月里程 {formatQty(helpers[seg.id].vehicleMonthlyMileage)}</div>
                              <div>路段月运量 {formatQty(helpers[seg.id].segmentMonthlyVolume)}</div>
                              <div>预计月收入 {formatMoney(helpers[seg.id].segmentMonthlyRevenue)}</div>
                              <div>预计能源成本 {formatMoney(helpers[seg.id].segmentMonthlyEnergyCost)}</div>
                            </div>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-2 py-2">
                          <div className="flex flex-col gap-1">
                            <button
                              className="text-sn-info"
                              onClick={async () => {
                                await api(`/api/calculation-routes/${currentRoute.id}/segments`, {
                                  method: "POST",
                                  body: JSON.stringify({ copyFromId: seg.id }),
                                });
                                await refreshRoutes();
                              }}
                            >
                              复制
                            </button>
                            <button
                              className="text-sn-info"
                              onClick={async () => {
                                await api(`/api/calculation-segments/${seg.id}`, { method: "PUT", body: JSON.stringify({ move: "up" }) });
                                await refreshRoutes();
                              }}
                            >
                              上移
                            </button>
                            <button
                              className="text-sn-info"
                              onClick={async () => {
                                await api(`/api/calculation-segments/${seg.id}`, { method: "PUT", body: JSON.stringify({ move: "down" }) });
                                await refreshRoutes();
                              }}
                            >
                              下移
                            </button>
                            <button
                              className="text-sn-error"
                              onClick={async () => {
                                await api(`/api/calculation-segments/${seg.id}`, { method: "DELETE" });
                                await refreshRoutes();
                              }}
                            >
                              删除
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Button
                className="mt-4"
                variant="secondary"
                onClick={async () => {
                  await api(`/api/calculation-routes/${currentRoute.id}/segments`, { method: "POST", body: "{}" });
                  await refreshRoutes();
                }}
              >
                新增路段
              </Button>
              <p className="mt-3 text-[12px] text-sn-muted">
                辅助指标仅预览，不作为输入保存。线路/路段数量没有上限。能耗单位必须是 kWh/km，不要按 kWh/100km 填写。载重为 0 时该路段按空载能耗计算整段。
              </p>
            </Card>
          ) : (
            <Card>
              <p className="text-sn-secondary">请先新增一条线路。</p>
            </Card>
          )}
        </div>
      )}

      {step === 2 && (
        <div className="space-y-5">
          {["A", "B", "C", "D"].map((group) => (
            <Card key={group}>
              <h3 className="mb-4 text-[20px] font-semibold">
                {group === "A" && "车辆融资/租赁"}
                {group === "B" && "固定运营成本"}
                {group === "C" && "轮胎参数"}
                {group === "D" && "司机成本"}
              </h3>
              <div className="grid gap-5 md:grid-cols-2">
                {group === "D" && (
                  <Field label="司机成本口径" hint="Excel 已确认元/趟。按趟时优先用路段「司机/趟」，路段为空则回退本字段。">
                    <Select
                      value={String(scheme.vehiclePlan.driverCostType || "PER_VEHICLE_MONTH")}
                      onChange={(e) => patchVehicle("driverCostType", e.target.value)}
                    >
                      {meta.driverCostTypes.map((d) => (
                        <option key={d.code} value={d.code}>
                          {d.name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                )}
                {VEHICLE_FIELDS.filter((f) => f.group === group).map((f) => {
                  if (group === "A") {
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
                        source={stdItem ? "公司标准" : group === "A" ? "项目填写" : "项目填写"}
                        overridden={overridden}
                      >
                        <TextInput value={current} onChange={(e) => patchVehicle(f.key, e.target.value)} />
                      </Field>
                      {stdItem && (
                        <p className="mt-1 text-[12px] text-sn-muted">标准值 {stdItem.value} {stdItem.unit}</p>
                      )}
                      {overridden && (
                        <Field label="调整原因" required>
                          <TextInput
                            value={reasons[f.std!] || ""}
                            onChange={(e) => setReasons((r) => ({ ...r, [f.std!]: e.target.value }))}
                            placeholder="覆盖公司标准必须填写原因"
                          />
                        </Field>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>
          ))}
        </div>
      )}

      {step === 3 && (
        <div className="grid gap-5 md:grid-cols-2">
          <Card className="space-y-4">
            <h3 className="text-[20px] font-semibold">资金参数</h3>
            <Field label="应收回款周期" unit="月" hint="Excel 口径为月，不是天">
              <TextInput value={String(scheme.financeTaxPlan.receivableCycle)} onChange={(e) => patchFinance("receivableCycle", Number(e.target.value))} />
            </Field>
            <Field label="流动资金贷款周期" unit="月">
              <TextInput value={String(scheme.financeTaxPlan.workingCapitalLoanCycle)} onChange={(e) => patchFinance("workingCapitalLoanCycle", Number(e.target.value))} />
            </Field>
            <Field label="流动资金贷款利率" unit="年利率" source="公司标准">
              <TextInput value={String(scheme.financeTaxPlan.workingCapitalInterestRate)} onChange={(e) => patchFinance("workingCapitalInterestRate", e.target.value)} />
            </Field>
            <Field label="营收垫资资金成本率" unit="年利率" source="公司标准" hint="原表叫营收年贴现率，实际按应收账款资金占用成本率使用，业务含义待确认">
              <TextInput value={String(scheme.financeTaxPlan.discountRate)} onChange={(e) => patchFinance("discountRate", e.target.value)} />
            </Field>
            <Field label="车辆折旧年限" unit="月" hint="非纯租赁用于首付摊销和经营期限">
              <TextInput value={String(scheme.financeTaxPlan.depreciationMonths ?? 60)} onChange={(e) => patchFinance("depreciationMonths", Number(e.target.value))} />
            </Field>
            <Field label="项目经营月数" unit="月" hint="高级字段。留空则按 Excel：纯租赁用分期月数，非纯租赁用折旧月数">
              <TextInput
                value={scheme.financeTaxPlan.projectOperatingMonths == null ? "" : String(scheme.financeTaxPlan.projectOperatingMonths)}
                onChange={(e) => patchFinance("projectOperatingMonths", e.target.value === "" ? null : Number(e.target.value))}
              />
            </Field>
          </Card>
          <Card className="space-y-4">
            <h3 className="text-[20px] font-semibold">税务参数</h3>
            <Field label="销项税率" hint="规则来自标准库 / Rule Engine">
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
            <p className="text-[13px] text-sn-secondary">可抵扣成本范围由进项税规则配置，不在页面硬编码。</p>
          </Card>
        </div>
      )}

      {step === 4 && (
        <div className="space-y-5">
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <div className="text-sn-muted text-[13px]">车辆数</div>
              <div className="mt-2 text-[28px] font-extrabold">{scheme.fleetSize}</div>
            </Card>
            <Card>
              <div className="text-sn-muted text-[13px]">线路数</div>
              <div className="mt-2 text-[28px] font-extrabold">{scheme.routes.length}</div>
            </Card>
            <Card>
              <div className="text-sn-muted text-[13px]">路段数</div>
              <div className="mt-2 text-[28px] font-extrabold">{scheme.routes.reduce((n, r) => n + r.segments.length, 0)}</div>
            </Card>
            <Card>
              <div className="text-sn-muted text-[13px]">测算年限</div>
              <div className="mt-2 text-[28px] font-extrabold">{scheme.calculationYears}</div>
            </Card>
          </div>
          <Card>
            <h3 className="mb-3 text-[20px] font-semibold">参数摘要</h3>
            <p className="text-sn-secondary">
              租赁 {lease?.name} · 月租 {String(scheme.vehiclePlan.monthlyRentPerVehicle)} · 回款 {String(scheme.financeTaxPlan.receivableCycle)} 月 · 销项税率{" "}
              {String(scheme.financeTaxPlan.outputVatRate)} · 能耗 kWh/km · 规则版本 RULE_PACK_V1
            </p>
          </Card>
          {errors.length > 0 && (
            <Card className="bg-sn-error/10">
              <h3 className="font-semibold text-[#C44747]">严重错误，无法测算</h3>
              <ul className="mt-2 list-disc pl-5 text-sm text-[#C44747]">
                {errors.map((e) => (
                  <li key={e.field}>{e.message}</li>
                ))}
              </ul>
            </Card>
          )}
          {warnings.length > 0 && (
            <Card className="bg-sn-warning/10">
              <h3 className="font-semibold text-[#8A5A10]">警告，允许继续</h3>
              <ul className="mt-2 list-disc pl-5 text-sm text-[#8A5A10]">
                {warnings.map((e) => (
                  <li key={e.field}>{e.message}</li>
                ))}
              </ul>
            </Card>
          )}
          <Button
            onClick={async () => {
              await persist(scheme);
              const v = await validate();
              if (v.errors.length) return;
              try {
                await api(`/api/calculation-schemes/${schemeId}/calculate`, { method: "POST" });
                router.push(`/projects/${projectId}/calculation/${schemeId}/results`);
              } catch (e) {
                setBanner(e instanceof Error ? e.message : "测算失败");
              }
            }}
          >
            开始测算
          </Button>
        </div>
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
    </div>
  );
}
