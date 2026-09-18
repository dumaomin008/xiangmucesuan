/**
 * 浏览器桥接入口：打包后挂到 window.PmCalc，供静态 Demo 调用。
 * 不含 Prisma / 业务 API / Secret。
 */
import {
  calculateProject,
  CALCULATION_ENGINE_VERSION,
  runSensitivity,
  serializeCalculationResult,
  snapshotKeyMetrics,
  validateSchemeInput,
  createBrowserAdapter,
} from "../calculation";
import {
  createDemoRepositories,
  createLocalStorageAdapter,
  DEMO_STORAGE_KEYS,
  DEMO_SCHEMA_VERSION,
  fingerprintSchemeInputs,
  type DemoCalcScenario,
  type DemoProjectContext,
  type DemoProjectRecord,
  type DemoRepositories,
} from "./index";
import { analyzeScenarioLocal, buildAiPayload, type DemoAiInsight } from "./ai/analyze";
import { narrativeIsGrounded } from "@/lib/ai/analysis";
import {
  ASSISTANT_SHORTCUTS,
  confirmPendingAction,
  createAssistantSession,
  runAssistantTurn,
  type AssistantSession,
  type AssistantTurnResult,
} from "./ai/assistant";
import { validateLlmIntent } from "./ai/llm-intent";
import { excelExampleInput } from "../lib/engine/__tests__/fixture";
import {
  addImportFilesTool,
  applyImportParamPatchesTool,
  applyServerParseResultTool,
  confirmExtractedParameterTool,
  confirmInferredParameterTool,
  createImportSessionTool,
  createScenarioFromImportTool,
  getImportSummaryTool,
  loadDemoSampleFilesTool,
  parseImportFilesTool,
  previewImportParamPatches,
  resolveConflictTool,
  retryImportFileTool,
  DEMO_IMPORT_SAMPLE_FILES,
  type ImportParamPatch,
} from "./import/tools";
import { parseImportSupplementIntent } from "./import/supplement";
import { canStartCalculation } from "./import/map-to-input";
import type { ImportSession } from "./import/types";

export type PmCalcBridge = {
  engineVersion: string;
  schemaVersion: number;
  storageKeys: typeof DEMO_STORAGE_KEYS;
  calculateProject: typeof calculateProject;
  validateSchemeInput: typeof validateSchemeInput;
  runSensitivity: typeof runSensitivity;
  serializeCalculationResult: typeof serializeCalculationResult;
  snapshotKeyMetrics: typeof snapshotKeyMetrics;
  createDefaultInput: () => ReturnType<typeof excelExampleInput>;
  ensureRepos: () => DemoRepositories;
  buildProjectContext: (p: {
    id: string;
    name: string;
    customer: string;
    region: string;
    owner: string;
    type?: string;
    place?: string;
    tractor?: number;
    trailer?: number;
    stage?: string;
    status?: string;
  }) => DemoProjectContext;
  syncProjectFromShell: (p: Parameters<PmCalcBridge["buildProjectContext"]>[0]) => DemoProjectRecord;
  listScenarios: (projectId?: string) => DemoCalcScenario[];
  getScenario: (id: string) => DemoCalcScenario | null;
  saveScenario: DemoRepositories["scenarios"]["saveScenario"];
  duplicateScenario: DemoRepositories["scenarios"]["duplicateScenario"];
  deleteScenario: DemoRepositories["scenarios"]["deleteScenario"];
  setBaseline: DemoRepositories["scenarios"]["setBaseline"];
  listAllProjects: () => DemoProjectRecord[];
  getProjectContext: (projectId: string) => DemoProjectContext | null;
  formatMoney: (value: string | number | null | undefined) => string;
  formatPercent: (value: string | number | null | undefined) => string;
  scenarioStatusLabel: (status: string) => string;
  fingerprintInputs: typeof fingerprintSchemeInputs;
  resetDemoData: () => void;
  analyzeScenario: (params: {
    scenarioId: string;
    project?: DemoProjectContext | null;
    question?: string;
  }) => DemoAiInsight;
  narrativeIsGrounded: typeof narrativeIsGrounded;
  buildAiPayload: typeof buildAiPayload;
  runAssistant: (params: {
    projectId: string;
    scenarioId: string;
    message: string;
    session?: AssistantSession;
    project?: DemoProjectContext | null;
    parsedIntent?: import("./ai/intent").AssistantIntent;
  }) => AssistantTurnResult;
  confirmAssistantAction: (session: AssistantSession) => AssistantTurnResult;
  createAssistantSession: typeof createAssistantSession;
  assistantShortcuts: typeof ASSISTANT_SHORTCUTS;
  validateLlmIntent: typeof import("./ai/llm-intent").validateLlmIntent;
  /** V2 AI 资料导入 */
  importApi: {
    createSession: (partial?: Partial<ImportSession>) => ImportSession;
    getSession: (id: string) => ImportSession | null;
    listSessions: () => ImportSession[];
    addFiles: (sessionId: string, files: { id?: string; name: string; mimeType?: string; size?: number; parserMode?: "demo" | "real" }[]) => ReturnType<typeof addImportFilesTool>;
    loadDemoSamples: (sessionId: string) => ReturnType<typeof loadDemoSampleFilesTool>;
    parseFiles: (sessionId: string) => ReturnType<typeof parseImportFilesTool>;
    applyServerParse: (sessionId: string, result: Parameters<typeof applyServerParseResultTool>[2]) => ReturnType<typeof applyServerParseResultTool>;
    retryFile: (sessionId: string, fileId: string) => ReturnType<typeof retryImportFileTool>;
    resolveConflict: (
      sessionId: string,
      field: string,
      choice: { alternativeIndex?: number; manualValue?: string | number },
    ) => ReturnType<typeof resolveConflictTool>;
    confirmInferred: (
      sessionId: string,
      field: string,
      accept: boolean,
      manualValue?: string | number,
    ) => ReturnType<typeof confirmInferredParameterTool>;
    confirmParameter: (
      sessionId: string,
      field: string,
      value: string | number,
      status?: "CONFIRMED" | "MANUAL",
      meta?: { valueOrigin?: "DOCUMENT" | "INFERRED" | "MANUAL" | "SYSTEM_DEFAULT"; confirmedByUser?: boolean },
    ) => ReturnType<typeof confirmExtractedParameterTool>;
    previewSupplement: (sessionId: string, message: string) => { patches: ImportParamPatch[]; changes: { field: string; label: string; from: string; to: string; unit: string }[] };
    applySupplement: (sessionId: string, patches: ImportParamPatch[]) => ReturnType<typeof applyImportParamPatchesTool>;
    summarize: (sessionId: string) => ReturnType<typeof getImportSummaryTool> | null;
    canStart: (sessionId: string) => { ok: boolean; reasons: string[] };
    createScenario: (
      sessionId: string,
      opts?: Parameters<typeof createScenarioFromImportTool>[2],
    ) => ReturnType<typeof createScenarioFromImportTool>;
    demoSampleFiles: typeof DEMO_IMPORT_SAMPLE_FILES;
  };
};

let repos: DemoRepositories | null = null;

function ensureRepos(): DemoRepositories {
  if (!repos) {
    repos = createDemoRepositories({
      storage: createLocalStorageAdapter(),
      seedIfEmpty: true,
    });
  }
  return repos;
}

function buildProjectContext(p: Parameters<PmCalcBridge["buildProjectContext"]>[0]): DemoProjectContext {
  return {
    projectId: p.id,
    projectName: p.name,
    customer: p.customer,
    region: p.region,
    owner: p.owner,
    projectType: p.type || "",
    place: p.place || "",
    tractorDemand: typeof p.tractor === "number" ? p.tractor : null,
    trailerDemand: typeof p.trailer === "number" ? p.trailer : null,
    stage: p.stage,
    status: p.status,
  };
}

function syncProjectFromShell(p: Parameters<PmCalcBridge["buildProjectContext"]>[0]): DemoProjectRecord {
  const demo = ensureRepos();
  const ctx = buildProjectContext(p);
  const existing = demo.projects.getProject(ctx.projectId);
  const now = new Date().toISOString();
  const record: DemoProjectRecord = {
    ...ctx,
    members: existing?.members ?? [],
    eco: existing?.eco,
    source: existing?.source,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  return demo.projects.saveProject(record);
}

function formatMoney(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatPercent(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return `${(n * 100).toFixed(2)}%`;
}

function scenarioStatusLabel(status: string): string {
  const map: Record<string, string> = {
    draft: "待确认",
    calculated: "已测算",
    baseline: "基准方案",
    archived: "已归档",
  };
  return map[status] || status;
}

export const PmCalc: PmCalcBridge = {
  engineVersion: CALCULATION_ENGINE_VERSION,
  schemaVersion: DEMO_SCHEMA_VERSION,
  storageKeys: DEMO_STORAGE_KEYS,
  calculateProject,
  validateSchemeInput,
  runSensitivity,
  serializeCalculationResult,
  snapshotKeyMetrics,
  createDefaultInput: () => excelExampleInput(),
  ensureRepos,
  buildProjectContext,
  syncProjectFromShell,
  listScenarios: (projectId) => ensureRepos().scenarios.listScenarios(projectId),
  getScenario: (id) => ensureRepos().scenarios.getScenario(id),
  saveScenario: (...args) => ensureRepos().scenarios.saveScenario(...args),
  duplicateScenario: (...args) => ensureRepos().scenarios.duplicateScenario(...args),
  deleteScenario: (id) => ensureRepos().scenarios.deleteScenario(id),
  setBaseline: (...args) => ensureRepos().scenarios.setBaseline(...args),
  listAllProjects: () => ensureRepos().projects.listProjects(),
  getProjectContext: (projectId) => ensureRepos().projects.getProjectContext(projectId),
  formatMoney,
  formatPercent,
  scenarioStatusLabel,
  fingerprintInputs: fingerprintSchemeInputs,
  resetDemoData: () => {
    const demo = ensureRepos();
    demo.projects.clear();
    demo.scenarios.clear();
    demo.parameters.clear();
    demo.imports.clear();
    repos = createDemoRepositories({
      storage: demo.storage,
      seedIfEmpty: true,
      forceReseed: true,
    });
  },
  analyzeScenario: ({ scenarioId, project, question }) => {
    const scenario = ensureRepos().scenarios.getScenario(scenarioId);
    if (!scenario) {
      return analyzeScenarioLocal({
        scenario: {
          id: scenarioId,
          projectId: project?.projectId || "",
          name: "未知方案",
          version: "V1",
          status: "draft",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          inputs: excelExampleInput(),
          results: null,
          calculationVersion: CALCULATION_ENGINE_VERSION,
        },
        project,
        question,
      });
    }
    return analyzeScenarioLocal({ scenario, project, question });
  },
  narrativeIsGrounded,
  buildAiPayload,
  runAssistant: ({ projectId, scenarioId, message, session, project, parsedIntent }) =>
    runAssistantTurn({
      repos: ensureRepos(),
      projectId,
      scenarioId,
      message,
      session,
      project,
      parsedIntent,
    }),
  confirmAssistantAction: (session) =>
    confirmPendingAction({
      repos: ensureRepos(),
      session,
    }),
  createAssistantSession,
  assistantShortcuts: ASSISTANT_SHORTCUTS,
  validateLlmIntent,
  importApi: {
    createSession: (partial) => createImportSessionTool(ensureRepos(), partial).session,
    getSession: (id) => ensureRepos().imports.getSession(id),
    listSessions: () => ensureRepos().imports.listSessions(),
    addFiles: (sessionId, files) => addImportFilesTool(ensureRepos(), sessionId, files),
    loadDemoSamples: (sessionId) => loadDemoSampleFilesTool(ensureRepos(), sessionId),
    parseFiles: (sessionId) => parseImportFilesTool(ensureRepos(), sessionId),
    applyServerParse: (sessionId, result) => applyServerParseResultTool(ensureRepos(), sessionId, result),
    retryFile: (sessionId, fileId) => retryImportFileTool(ensureRepos(), sessionId, fileId),
    resolveConflict: (sessionId, field, choice) => resolveConflictTool(ensureRepos(), sessionId, field, choice),
    confirmInferred: (sessionId, field, accept, manualValue) =>
      confirmInferredParameterTool(ensureRepos(), sessionId, field, accept, manualValue),
    confirmParameter: (sessionId, field, value, status, meta) =>
      confirmExtractedParameterTool(ensureRepos(), sessionId, field, value, status, meta),
    previewSupplement: (sessionId, message) => {
      const session = ensureRepos().imports.getSession(sessionId);
      const patches = parseImportSupplementIntent(message);
      if (!session) return { patches, changes: [] };
      return { patches, changes: previewImportParamPatches(session, patches).changes };
    },
    applySupplement: (sessionId, patches) => applyImportParamPatchesTool(ensureRepos(), sessionId, patches),
    summarize: (sessionId) => {
      const session = ensureRepos().imports.getSession(sessionId);
      if (!session) return null;
      return getImportSummaryTool(session);
    },
    canStart: (sessionId) => {
      const session = ensureRepos().imports.getSession(sessionId);
      if (!session) return { ok: false, reasons: ["会话不存在"] };
      return canStartCalculation(session.parameters);
    },
    createScenario: (sessionId, opts) => createScenarioFromImportTool(ensureRepos(), sessionId, opts),
    demoSampleFiles: DEMO_IMPORT_SAMPLE_FILES,
  },
};

declare global {
  interface Window {
    PmCalc: PmCalcBridge;
  }
}

if (typeof window !== "undefined") {
  window.PmCalc = PmCalc;
  createBrowserAdapter("browser");
}

export default PmCalc;
