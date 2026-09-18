"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/client";
import { DEFAULT_RULE_SET } from "@/lib/engine/rule-engine";
import { previewSegmentHelpers } from "@/lib/engine/calculate";
import { calcCompleteness } from "./completeness";
import type { Issue, Meta, PreviewDto, Scheme, Segment, Std } from "./types";
import { VEHICLE_FIELDS } from "./types";

export function useSchemeWorkspace(schemeId: string) {
  const [scheme, setSchemeState] = useState<Scheme | null>(null);
  const schemeRef = useRef<Scheme | null>(null);
  const setScheme = (next: Scheme) => {
    schemeRef.current = next;
    setSchemeState(next);
  };
  const [meta, setMeta] = useState<Meta | null>(null);
  const [std, setStd] = useState<Std[]>([]);
  const [routeId, setRouteId] = useState("");
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [saveState, setSaveState] = useState("已自动保存");
  const [errors, setErrors] = useState<Issue[]>([]);
  const [warnings, setWarnings] = useState<Issue[]>([]);
  const [banner, setBanner] = useState("");
  const [calculating, setCalculating] = useState(false);
  const [preview, setPreview] = useState<PreviewDto | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const segmentTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

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

  const loadPreview = useCallback(async () => {
    try {
      const data = await api<{ preview: PreviewDto | null; errors: Issue[]; warnings: Issue[] }>(
        `/api/calculation-schemes/${schemeId}/calculate?preview=1`,
      );
      setPreview(data.preview);
      setErrors(data.errors || []);
      setWarnings(data.warnings || []);
    } catch {
      setPreview(null);
    }
  }, [schemeId]);

  useEffect(() => {
    load().catch((e) => setBanner(e instanceof Error ? e.message : "加载失败"));
  }, [load]);

  useEffect(() => {
    if (!scheme) return;
    if (previewTimer.current) clearTimeout(previewTimer.current);
    previewTimer.current = setTimeout(() => {
      loadPreview().catch(() => undefined);
    }, 400);
    return () => {
      if (previewTimer.current) clearTimeout(previewTimer.current);
    };
  }, [scheme, loadPreview]);

  const persist = useCallback(
    async (next: Scheme) => {
      setSaveState("正在保存...");
      try {
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
                const overrideReason = (reasons[p.parameterCode] || "").trim();
                if (current === p.value || !overrideReason) return null;
                return {
                  parameterCode: p.parameterCode,
                  parameterName: p.parameterName,
                  standardValue: p.value,
                  overrideValue: current,
                  overrideReason,
                  unit: p.unit,
                };
              })
              .filter(Boolean),
          }),
        });
        setSaveState("已自动保存");
      } catch (e) {
        setSaveState("保存失败，请重试");
        setBanner(e instanceof Error ? e.message : "保存失败，请重试");
      }
    },
    [reasons, schemeId, std],
  );

  const scheduleSave = (next: Scheme) => {
    setScheme(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      persist(next).catch(() => undefined);
    }, 800);
  };

  const persistSegment = async (seg: Segment) => {
    setSaveState("正在保存...");
    try {
      await api(`/api/calculation-segments/${seg.id}`, {
        method: "PUT",
        body: JSON.stringify({ ...seg, enabled: true }),
      });
      setSaveState("已自动保存");
    } catch (e) {
      setSaveState("保存失败，请重试");
      setBanner(e instanceof Error ? e.message : "保存失败，请重试");
    }
  };

  const patchSegment = (schemeSnapshot: Scheme, segId: string, key: keyof Segment, value: string) => {
    const next: Scheme = {
      ...schemeSnapshot,
      routes: schemeSnapshot.routes.map((route) => ({
        ...route,
        segments: route.segments.map((seg) => (seg.id === segId ? { ...seg, [key]: value } : seg)),
      })),
    };
    setScheme(next);
    const updated = next.routes.flatMap((r) => r.segments).find((s) => s.id === segId);
    if (!updated) return;
    if (segmentTimers.current[segId]) clearTimeout(segmentTimers.current[segId]);
    segmentTimers.current[segId] = setTimeout(() => {
      persistSegment(updated).catch(() => undefined);
    }, 800);
  };

  const flushSegment = (seg: Segment) => {
    if (segmentTimers.current[seg.id]) {
      clearTimeout(segmentTimers.current[seg.id]);
      delete segmentTimers.current[seg.id];
    }
    const latest = schemeRef.current?.routes.flatMap((r) => r.segments).find((s) => s.id === seg.id) || seg;
    persistSegment(latest).catch(() => undefined);
  };

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

  const completeness = useMemo(() => (scheme ? calcCompleteness(scheme, Boolean(preview)) : null), [scheme, preview]);

  const patch = (partial: Partial<Scheme>) => {
    if (!scheme) return;
    scheduleSave({ ...scheme, ...partial });
  };
  const patchVehicle = (key: string, value: string | number) => {
    if (!scheme) return;
    scheduleSave({
      ...scheme,
      vehiclePlan: { ...scheme.vehiclePlan, [key]: value, fleetSize: scheme.fleetSize, leaseType: scheme.leaseType },
    });
  };
  const patchFinance = (key: string, value: string | number | null) => {
    if (!scheme) return;
    scheduleSave({ ...scheme, financeTaxPlan: { ...scheme.financeTaxPlan, [key]: value } });
  };

  const refreshRoutes = async () => {
    const s = await api<Scheme>(`/api/calculation-schemes/${schemeId}`);
    setScheme(s);
    if (!s.routes.find((r) => r.id === routeId)) setRouteId(s.routes[0]?.id || "");
  };

  const validate = async () => {
    const data = await api<{ errors: Issue[]; warnings: Issue[] }>(`/api/calculation-schemes/${schemeId}/calculate?validate=1`);
    setErrors(data.errors);
    setWarnings(data.warnings);
    return data;
  };

  return {
    scheme,
    schemeRef,
    meta,
    std,
    routeId,
    setRouteId,
    currentRoute,
    reasons,
    setReasons,
    saveState,
    errors,
    warnings,
    banner,
    setBanner,
    calculating,
    setCalculating,
    preview,
    helpers,
    completeness,
    patch,
    patchVehicle,
    patchFinance,
    patchSegment,
    flushSegment,
    persist,
    refreshRoutes,
    validate,
    load,
  };
}
