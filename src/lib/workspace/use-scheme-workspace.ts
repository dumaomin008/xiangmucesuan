"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/client";
import { DEFAULT_RULE_SET } from "@/lib/engine/rule-engine";
import { previewSegmentHelpers } from "@/lib/engine/calculate";
import { calcCompleteness } from "./completeness";
import { diffSchemeParams } from "./param-diff";
import type { Issue, Meta, PreviewDto, Route, Scheme, Segment, Std } from "./types";
import { VEHICLE_FIELDS } from "./types";

const SAVE_LABEL = {
  saving: "正在保存…",
  saved: "已保存",
  failed: "保存失败",
} as const;

function attachSerial<T>(
  chainRef: { current: Promise<void> },
  genRef: { current: number },
  run: (gen: number) => Promise<T>,
) {
  const gen = ++genRef.current;
  const job = chainRef.current.then(async () => {
    if (genRef.current !== gen) return;
    await run(gen);
  });
  chainRef.current = job.catch(() => undefined);
  return job;
}

export function useSchemeWorkspace(schemeId: string) {
  const [scheme, setSchemeState] = useState<Scheme | null>(null);
  const schemeRef = useRef<Scheme | null>(null);
  const setScheme = (next: Scheme) => {
    schemeRef.current = next;
    setSchemeState(next);
  };
  const [meta, setMeta] = useState<Meta | null>(null);
  const [std, setStd] = useState<Std[]>([]);
  const stdRef = useRef<Std[]>([]);
  const [routeId, setRouteId] = useState("");
  const [reasons, setReasonsState] = useState<Record<string, string>>({});
  const reasonsRef = useRef<Record<string, string>>({});
  const [saveState, setSaveState] = useState<string>(SAVE_LABEL.saved);
  const [errors, setErrors] = useState<Issue[]>([]);
  const [warnings, setWarnings] = useState<Issue[]>([]);
  const [banner, setBanner] = useState("");
  const [calculating, setCalculating] = useState(false);
  const [preview, setPreview] = useState<PreviewDto | null>(null);
  const [sourceScheme, setSourceScheme] = useState<Scheme | null>(null);
  const [flushing, setFlushing] = useState(false);

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const segmentTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const routeTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const projectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirtySegments = useRef<Set<string>>(new Set());
  const dirtyRoutes = useRef<Set<string>>(new Set());
  const dirtyProject = useRef<Record<string, string> | null>(null);
  const dirtyScheme = useRef(false);
  const schemeEpoch = useRef(0);
  const projectEpoch = useRef(0);
  const segmentEpochs = useRef<Record<string, number>>({});
  const routeEpochs = useRef<Record<string, number>>({});

  const schemeChain = useRef(Promise.resolve());
  const schemeGen = useRef(0);
  const segmentChains = useRef<Record<string, Promise<void>>>({});
  const segmentGens = useRef<Record<string, number>>({});
  const routeChains = useRef<Record<string, Promise<void>>>({});
  const routeGens = useRef<Record<string, number>>({});
  const projectChain = useRef(Promise.resolve());
  const projectGen = useRef(0);

  const setReasons = (next: Record<string, string> | ((prev: Record<string, string>) => Record<string, string>)) => {
    setReasonsState((prev) => {
      const resolved = typeof next === "function" ? next(prev) : next;
      reasonsRef.current = resolved;
      return resolved;
    });
  };

  const load = useCallback(async () => {
    const [s, m, p] = await Promise.all([
      api<Scheme>(`/api/calculation-schemes/${schemeId}`),
      api<Meta>("/api/meta"),
      api<Std[]>("/api/standard-parameters"),
    ]);
    setScheme(s);
    setMeta(m);
    setStd(p);
    stdRef.current = p;
    setRouteId((prev) => prev || s.routes[0]?.id || "");
    const nextReasons: Record<string, string> = {};
    for (const o of s.overrides) nextReasons[o.parameterCode] = o.overrideReason;
    reasonsRef.current = nextReasons;
    setReasonsState(nextReasons);
    if (s.sourceSchemeId) {
      try {
        const source = await api<Scheme>(`/api/calculation-schemes/${s.sourceSchemeId}`);
        setSourceScheme(source);
      } catch {
        setSourceScheme(null);
      }
    } else {
      setSourceScheme(null);
    }
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
      const chainRef = schemeChain;
      return attachSerial(chainRef, schemeGen, async () => {
        const latest = schemeRef.current || next;
        const epoch = schemeEpoch.current;
        setSaveState(SAVE_LABEL.saving);
        try {
          await api(`/api/calculation-schemes/${schemeId}`, {
            method: "PUT",
            body: JSON.stringify({
              schemeName: latest.schemeName,
              description: latest.description,
              leaseType: latest.leaseType,
              fleetSize: latest.fleetSize,
              calculationYears: latest.calculationYears,
              expectedStartDate: latest.expectedStartDate,
              expectedEndDate: latest.expectedEndDate,
              vehicle: latest.vehiclePlan,
              finance: latest.financeTaxPlan,
              overrides: stdRef.current
                .filter((p) => VEHICLE_FIELDS.some((f) => f.std === p.parameterCode))
                .map((p) => {
                  const field = VEHICLE_FIELDS.find((f) => f.std === p.parameterCode)!;
                  const current = String(latest.vehiclePlan[field.key] ?? "");
                  const overrideReason = (reasonsRef.current[p.parameterCode] || "").trim();
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
          if (schemeEpoch.current === epoch) dirtyScheme.current = false;
          setSaveState(SAVE_LABEL.saved);
        } catch (e) {
          setSaveState(SAVE_LABEL.failed);
          setBanner(e instanceof Error ? e.message : "保存失败，请重试");
          throw e;
        }
      });
    },
    [schemeId],
  );

  const persistSegment = async (seg: Segment) => {
    if (!segmentChains.current[seg.id]) segmentChains.current[seg.id] = Promise.resolve();
    if (!segmentGens.current[seg.id]) segmentGens.current[seg.id] = 0;
    const gen = ++segmentGens.current[seg.id];
    const job = segmentChains.current[seg.id].then(async () => {
      if (segmentGens.current[seg.id] !== gen) return;
      const latest = schemeRef.current?.routes.flatMap((r) => r.segments).find((s) => s.id === seg.id) || seg;
      const epoch = segmentEpochs.current[latest.id] || 0;
      setSaveState(SAVE_LABEL.saving);
      try {
        await api(`/api/calculation-segments/${latest.id}`, {
          method: "PUT",
          body: JSON.stringify({ ...latest, enabled: true }),
        });
        if ((segmentEpochs.current[latest.id] || 0) === epoch) dirtySegments.current.delete(latest.id);
        setSaveState(SAVE_LABEL.saved);
      } catch (e) {
        setSaveState(SAVE_LABEL.failed);
        setBanner(e instanceof Error ? e.message : "保存失败，请重试");
        throw e;
      }
    });
    segmentChains.current[seg.id] = job.catch(() => undefined);
    return job;
  };

  const persistRoute = async (route: Route) => {
    if (!routeChains.current[route.id]) routeChains.current[route.id] = Promise.resolve();
    if (!routeGens.current[route.id]) routeGens.current[route.id] = 0;
    const gen = ++routeGens.current[route.id];
    const job = routeChains.current[route.id].then(async () => {
      if (routeGens.current[route.id] !== gen) return;
      const latest = schemeRef.current?.routes.find((r) => r.id === route.id) || route;
      const epoch = routeEpochs.current[latest.id] || 0;
      setSaveState(SAVE_LABEL.saving);
      try {
        await api(`/api/calculation-routes/${latest.id}`, {
          method: "PUT",
          body: JSON.stringify({
            routeName: latest.routeName,
            description: latest.description,
            weight: latest.weight,
          }),
        });
        if ((routeEpochs.current[latest.id] || 0) === epoch) dirtyRoutes.current.delete(latest.id);
        setSaveState(SAVE_LABEL.saved);
      } catch (e) {
        setSaveState(SAVE_LABEL.failed);
        setBanner(e instanceof Error ? e.message : "保存失败，请重试");
        throw e;
      }
    });
    routeChains.current[route.id] = job.catch(() => undefined);
    return job;
  };

  const persistProject = async (partial: Record<string, string>) => {
    const latestScheme = schemeRef.current;
    if (!latestScheme?.project) return;
    return attachSerial(projectChain, projectGen, async () => {
      const payload = dirtyProject.current || partial;
      const epoch = projectEpoch.current;
      if (!payload) return;
      setSaveState(SAVE_LABEL.saving);
      try {
        await api(`/api/projects/${latestScheme.projectId}`, { method: "PATCH", body: JSON.stringify(payload) });
        if (projectEpoch.current === epoch) dirtyProject.current = null;
        setSaveState(SAVE_LABEL.saved);
      } catch (e) {
        setSaveState(SAVE_LABEL.failed);
        setBanner(e instanceof Error ? e.message : "项目保存失败");
        throw e;
      }
    });
  };

  const scheduleSave = (next: Scheme) => {
    setScheme(next);
    schemeEpoch.current += 1;
    dirtyScheme.current = true;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      persist(next).catch(() => undefined);
    }, 800);
  };

  const patchSegment = (schemeSnapshot: Scheme, segId: string, key: keyof Segment, value: string) => {
    const base = schemeRef.current || schemeSnapshot;
    const next: Scheme = {
      ...base,
      routes: base.routes.map((route) => ({
        ...route,
        segments: route.segments.map((seg) => (seg.id === segId ? { ...seg, [key]: value } : seg)),
      })),
    };
    setScheme(next);
    segmentEpochs.current[segId] = (segmentEpochs.current[segId] || 0) + 1;
    dirtySegments.current.add(segId);
    if (segmentTimers.current[segId]) clearTimeout(segmentTimers.current[segId]);
    segmentTimers.current[segId] = setTimeout(() => {
      const updated = schemeRef.current?.routes.flatMap((r) => r.segments).find((s) => s.id === segId);
      if (updated) persistSegment(updated).catch(() => undefined);
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

  const patchRoute = (routeIdToPatch: string, partial: Partial<Pick<Route, "routeName" | "description" | "weight">>) => {
    const current = schemeRef.current;
    if (!current) return;
    const next: Scheme = {
      ...current,
      routes: current.routes.map((route) => (route.id === routeIdToPatch ? { ...route, ...partial } : route)),
    };
    setScheme(next);
    routeEpochs.current[routeIdToPatch] = (routeEpochs.current[routeIdToPatch] || 0) + 1;
    dirtyRoutes.current.add(routeIdToPatch);
    if (routeTimers.current[routeIdToPatch]) clearTimeout(routeTimers.current[routeIdToPatch]);
    routeTimers.current[routeIdToPatch] = setTimeout(() => {
      const route = schemeRef.current?.routes.find((r) => r.id === routeIdToPatch);
      if (route) persistRoute(route).catch(() => undefined);
    }, 700);
  };

  const patchProject = (partial: Record<string, string>) => {
    const current = schemeRef.current;
    if (!current?.project) return;
    setScheme({ ...current, project: { ...current.project, ...partial } });
    projectEpoch.current += 1;
    dirtyProject.current = { ...(dirtyProject.current || {}), ...partial };
    if (projectTimer.current) clearTimeout(projectTimer.current);
    projectTimer.current = setTimeout(() => {
      const payload = dirtyProject.current;
      if (payload) persistProject(payload).catch(() => undefined);
    }, 800);
  };

  const clearPendingTimers = () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    for (const id of Object.keys(segmentTimers.current)) {
      clearTimeout(segmentTimers.current[id]);
      delete segmentTimers.current[id];
    }
    for (const id of Object.keys(routeTimers.current)) {
      clearTimeout(routeTimers.current[id]);
      delete routeTimers.current[id];
    }
    if (projectTimer.current) {
      clearTimeout(projectTimer.current);
      projectTimer.current = null;
    }
  };

  const flushPendingChanges = async () => {
    setFlushing(true);
    setSaveState(SAVE_LABEL.saving);
    clearPendingTimers();
    const latest = schemeRef.current;
    const tasks: Promise<unknown>[] = [];
    try {
      if (latest && dirtyScheme.current) tasks.push(persist(latest));
      if (latest) {
        for (const id of [...dirtySegments.current]) {
          const seg = latest.routes.flatMap((r) => r.segments).find((s) => s.id === id);
          if (seg) tasks.push(persistSegment(seg));
        }
        for (const id of [...dirtyRoutes.current]) {
          const route = latest.routes.find((r) => r.id === id);
          if (route) tasks.push(persistRoute(route));
        }
      }
      if (dirtyProject.current) tasks.push(persistProject(dirtyProject.current));
      await Promise.all(tasks);
      await Promise.all([
        schemeChain.current,
        projectChain.current,
        ...Object.values(segmentChains.current),
        ...Object.values(routeChains.current),
      ]);
      setSaveState(SAVE_LABEL.saved);
      return true;
    } catch {
      setSaveState(SAVE_LABEL.failed);
      return false;
    } finally {
      setFlushing(false);
    }
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
  const sourceDiffs = useMemo(() => {
    if (!scheme || !sourceScheme) return [];
    return diffSchemeParams(scheme, sourceScheme);
  }, [scheme, sourceScheme]);

  const patch = (partial: Partial<Scheme>) => {
    const current = schemeRef.current;
    if (!current) return;
    scheduleSave({ ...current, ...partial });
  };
  const patchVehicle = (key: string, value: string | number) => {
    const current = schemeRef.current;
    if (!current) return;
    const field = VEHICLE_FIELDS.find((item) => item.key === key);
    if (field?.std) {
      const stdItem = stdRef.current.find((item) => item.parameterCode === field.std);
      if (stdItem && String(value) !== stdItem.value) {
        setReasons((prev) => (Object.prototype.hasOwnProperty.call(prev, field.std!) ? prev : { ...prev, [field.std!]: "" }));
      }
    }
    scheduleSave({
      ...current,
      vehiclePlan: { ...current.vehiclePlan, [key]: value, fleetSize: current.fleetSize, leaseType: current.leaseType },
    });
  };
  const patchFinance = (key: string, value: string | number | null) => {
    const current = schemeRef.current;
    if (!current) return;
    scheduleSave({ ...current, financeTaxPlan: { ...current.financeTaxPlan, [key]: value } });
  };
  const patchReason = (code: string, reason: string) => {
    setReasons((prev) => ({ ...prev, [code]: reason }));
    const current = schemeRef.current;
    if (current) scheduleSave(current);
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

  const saving = saveState === SAVE_LABEL.saving || flushing;

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
    patchReason,
    saveState,
    saving,
    flushing,
    errors,
    warnings,
    banner,
    setBanner,
    calculating,
    setCalculating,
    preview,
    helpers,
    completeness,
    sourceScheme,
    sourceDiffs,
    patch,
    patchVehicle,
    patchFinance,
    patchSegment,
    patchRoute,
    patchProject,
    flushSegment,
    persist,
    flushPendingChanges,
    refreshRoutes,
    validate,
    load,
  };
}
