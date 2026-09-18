/**
 * AI 资料导入 Tool Layer：LLM 只理解，Tool 负责执行与写入。
 */
import type { DemoRepositories } from "../bootstrap";
import type { DemoCalcScenario, DemoProjectRecord } from "../types";
import { cloneJson, nowIso } from "../utils";
import { canStartCalculation, mapToSchemeCalculationInput, summarizeParameterStates } from "./map-to-input";
import {
  createImportFileMeta,
  DEMO_IMPORT_SAMPLE_FILES,
  mergeExtractedParameters,
  parseImportFileDemo,
} from "./parser-adapter";
import type {
  ExtractedParameter,
  ImportFile,
  ImportSession,
  ParameterAlternative,
} from "./types";

export type ImportToolTrace = { tool: string; ok: boolean; detail?: string };

export function createImportSessionTool(
  repos: DemoRepositories,
  partial?: Partial<ImportSession>,
): { session: ImportSession; trace: ImportToolTrace } {
  const session = repos.imports.createSession(partial);
  return { session, trace: { tool: "createImportSession", ok: true, detail: session.id } };
}

export function addImportFilesTool(
  repos: DemoRepositories,
  sessionId: string,
  files: { name: string; mimeType?: string; size?: number }[],
): { session: ImportSession | null; added: ImportFile[]; trace: ImportToolTrace } {
  const session = repos.imports.getSession(sessionId);
  if (!session) return { session: null, added: [], trace: { tool: "addImportFiles", ok: false, detail: "session missing" } };

  const MAX_FILES = 12;
  const MAX_SIZE = 20 * 1024 * 1024;
  const allowed = /\.(xlsx|xls|pdf|docx|doc|png|jpe?g)$/i;
  const added: ImportFile[] = [];
  const errors: string[] = [];

  for (const f of files) {
    if (session.files.length + added.length >= MAX_FILES) {
      errors.push("超过单次上传数量上限");
      break;
    }
    if (!allowed.test(f.name)) {
      errors.push(`${f.name}：类型不允许`);
      continue;
    }
    if ((f.size ?? 0) > MAX_SIZE) {
      errors.push(`${f.name}：超过 20MB`);
      continue;
    }
    const safeName = f.name.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_");
    added.push(createImportFileMeta({ name: safeName, mimeType: f.mimeType, size: f.size }));
  }

  const nextFiles = [...session.files, ...added];
  const saved = repos.imports.updateFiles(sessionId, nextFiles);
  return {
    session: saved,
    added,
    trace: { tool: "addImportFiles", ok: added.length > 0, detail: errors.join(";") || `${added.length} added` },
  };
}

export function loadDemoSampleFilesTool(
  repos: DemoRepositories,
  sessionId: string,
): { session: ImportSession | null; trace: ImportToolTrace } {
  return addImportFilesTool(
    repos,
    sessionId,
    DEMO_IMPORT_SAMPLE_FILES.map((f) => ({ name: f.name, mimeType: f.mimeType, size: f.size })),
  );
}

export function parseImportFilesTool(
  repos: DemoRepositories,
  sessionId: string,
): { session: ImportSession | null; trace: ImportToolTrace } {
  const session = repos.imports.getSession(sessionId);
  if (!session) return { session: null, trace: { tool: "parseImportFiles", ok: false } };

  session.status = "parsing";
  repos.imports.saveSession(session);

  const batches = [];
  for (const file of session.files) {
    file.status = "PARSING";
    const result = parseImportFileDemo(file);
    file.parserMode = "demo";
    if (!result.ok) {
      file.status = "FAILED";
      file.errorMessage = result.errorMessage;
    } else {
      file.status = "PARSED";
      file.errorMessage = undefined;
    }
    batches.push(result);
    if (result.suggestedProjectName) {
      session.suggestedProjectName = result.suggestedProjectName;
    }
  }

  const parameters = mergeExtractedParameters(batches);
  session.parameters = parameters;
  session.status = "review";
  session.updatedAt = nowIso();

  // 尝试匹配已有项目（仅建议，不自动绑定）
  if (session.suggestedProjectName) {
    const hit = repos.projects
      .listProjects()
      .find((p) => p.projectName.includes(session.suggestedProjectName!) || session.suggestedProjectName!.includes(p.projectName));
    if (hit) {
      session.suggestedProjectId = hit.projectId;
    }
  }

  const saved = repos.imports.saveSession(session);
  return {
    session: saved,
    trace: { tool: "parseImportFiles", ok: true, detail: `params=${parameters.length}` },
  };
}

export function retryImportFileTool(
  repos: DemoRepositories,
  sessionId: string,
  fileId: string,
): { session: ImportSession | null; trace: ImportToolTrace } {
  const session = repos.imports.getSession(sessionId);
  if (!session) return { session: null, trace: { tool: "retryImportFile", ok: false } };
  const file = session.files.find((f) => f.id === fileId);
  if (!file) return { session, trace: { tool: "retryImportFile", ok: false, detail: "file missing" } };
  file.status = "UPLOADED";
  file.errorMessage = undefined;
  repos.imports.saveSession(session);
  return parseImportFilesTool(repos, sessionId);
}

export function confirmExtractedParameterTool(
  repos: DemoRepositories,
  sessionId: string,
  field: string,
  value: string | number,
  status: ExtractedParameter["status"] = "CONFIRMED",
): { session: ImportSession | null; trace: ImportToolTrace } {
  const session = repos.imports.getSession(sessionId);
  if (!session) return { session: null, trace: { tool: "confirmExtractedParameter", ok: false } };
  const p = session.parameters.find((x) => x.field === field);
  if (!p) return { session, trace: { tool: "confirmExtractedParameter", ok: false, detail: "field missing" } };
  p.value = value;
  p.normalizedValue = value;
  p.status = status;
  const saved = repos.imports.saveSession(session);
  return { session: saved, trace: { tool: "confirmExtractedParameter", ok: true, detail: field } };
}

export function resolveConflictTool(
  repos: DemoRepositories,
  sessionId: string,
  field: string,
  choice: { alternativeIndex?: number; manualValue?: string | number },
): { session: ImportSession | null; trace: ImportToolTrace } {
  const session = repos.imports.getSession(sessionId);
  if (!session) return { session: null, trace: { tool: "resolveConflict", ok: false } };
  const p = session.parameters.find((x) => x.field === field);
  if (!p || p.status !== "CONFLICT") {
    return { session, trace: { tool: "resolveConflict", ok: false, detail: "not conflict" } };
  }

  let value: string | number | null = null;
  let picked: ParameterAlternative | undefined;
  if (choice.manualValue != null && choice.manualValue !== "") {
    value = choice.manualValue;
    p.status = "MANUAL";
  } else if (choice.alternativeIndex != null && p.alternatives?.[choice.alternativeIndex]) {
    picked = p.alternatives[choice.alternativeIndex];
    value = picked.value;
    p.status = "CONFIRMED";
    if (picked.source) p.sources = [picked.source];
  } else {
    return { session, trace: { tool: "resolveConflict", ok: false, detail: "no choice" } };
  }

  p.value = value;
  p.normalizedValue = value;
  p.alternatives = undefined;
  const saved = repos.imports.saveSession(session);
  return { session: saved, trace: { tool: "resolveConflict", ok: true, detail: field } };
}

export function confirmInferredParameterTool(
  repos: DemoRepositories,
  sessionId: string,
  field: string,
  accept: boolean,
  manualValue?: string | number,
): { session: ImportSession | null; trace: ImportToolTrace } {
  const session = repos.imports.getSession(sessionId);
  if (!session) return { session: null, trace: { tool: "confirmInferredParameter", ok: false } };
  const p = session.parameters.find((x) => x.field === field);
  if (!p) return { session, trace: { tool: "confirmInferredParameter", ok: false } };
  if (!accept) {
    if (manualValue == null) {
      p.status = "MISSING";
      p.value = null;
      p.normalizedValue = null;
    } else {
      p.value = manualValue;
      p.normalizedValue = manualValue;
      p.status = "MANUAL";
    }
  } else {
    p.status = "CONFIRMED";
  }
  return {
    session: repos.imports.saveSession(session),
    trace: { tool: "confirmInferredParameter", ok: true, detail: field },
  };
}

/** AI 补参：仅生成预览变更，不直接写入（需 confirmApplyImportPatches） */
export type ImportParamPatch = { field: string; value: string | number; label: string; unit?: string };

export function previewImportParamPatches(
  session: ImportSession,
  patches: ImportParamPatch[],
): { changes: { field: string; label: string; from: string; to: string; unit: string }[] } {
  return {
    changes: patches.map((patch) => {
      const cur = session.parameters.find((p) => p.field === patch.field);
      return {
        field: patch.field,
        label: patch.label || cur?.label || patch.field,
        from: cur?.normalizedValue == null ? "—" : String(cur.normalizedValue),
        to: String(patch.value),
        unit: patch.unit || cur?.unit || "",
      };
    }),
  };
}

export function applyImportParamPatchesTool(
  repos: DemoRepositories,
  sessionId: string,
  patches: ImportParamPatch[],
): { session: ImportSession | null; trace: ImportToolTrace } {
  const session = repos.imports.getSession(sessionId);
  if (!session) return { session: null, trace: { tool: "updateExtractedParameter", ok: false } };
  for (const patch of patches) {
    let p = session.parameters.find((x) => x.field === patch.field);
    if (!p) {
      p = {
        field: patch.field,
        label: patch.label,
        value: patch.value,
        normalizedValue: patch.value,
        unit: patch.unit,
        status: "MANUAL",
        sources: [],
        required: true,
        group: "cost",
      };
      session.parameters.push(p);
    } else {
      p.value = patch.value;
      p.normalizedValue = patch.value;
      p.status = "MANUAL";
      if (patch.unit) p.unit = patch.unit;
    }
  }
  return {
    session: repos.imports.saveSession(session),
    trace: { tool: "updateExtractedParameter", ok: true, detail: patches.map((p) => p.field).join(",") },
  };
}

export function createScenarioFromImportTool(
  repos: DemoRepositories,
  sessionId: string,
  opts?: {
    projectId?: string;
    linkSuggested?: boolean;
    createTempProject?: boolean;
    tempName?: string;
  },
): {
  session: ImportSession | null;
  scenario: DemoCalcScenario | null;
  project: DemoProjectRecord | null;
  defaultsUsed: { field: string; label: string; defaultValue: string }[];
  errors: string[];
  trace: ImportToolTrace;
} {
  const session = repos.imports.getSession(sessionId);
  if (!session) {
    return {
      session: null,
      scenario: null,
      project: null,
      defaultsUsed: [],
      errors: ["导入会话不存在"],
      trace: { tool: "createScenarioFromImport", ok: false },
    };
  }

  const gate = canStartCalculation(session.parameters);
  if (!gate.ok) {
    return {
      session,
      scenario: null,
      project: null,
      defaultsUsed: [],
      errors: gate.reasons,
      trace: { tool: "createScenarioFromImport", ok: false, detail: gate.reasons.join(";") },
    };
  }

  const mapped = mapToSchemeCalculationInput(session.parameters);
  if (!mapped.ok || !mapped.inputs) {
    return {
      session,
      scenario: null,
      project: null,
      defaultsUsed: mapped.defaultsUsed,
      errors: mapped.errors,
      trace: { tool: "mapToCalculationInput", ok: false },
    };
  }

  let projectId = opts?.projectId || session.projectId;
  let project: DemoProjectRecord | null = projectId ? repos.projects.getProject(projectId) : null;

  if (!project && opts?.linkSuggested && session.suggestedProjectId) {
    project = repos.projects.getProject(session.suggestedProjectId);
    projectId = project?.projectId;
  }

  if (!project && (opts?.createTempProject || !projectId)) {
    const now = nowIso();
    const tempId = `PRJ-TEMP-${Date.now().toString(36).toUpperCase()}`;
    project = {
      projectId: tempId,
      projectName: opts?.tempName || mapped.projectPatch.projectName || session.tempProjectName || "临时测算项目",
      customer: mapped.projectPatch.customer || "待补客户",
      region: mapped.projectPatch.region || "待定",
      owner: mapped.projectPatch.owner || "未指定",
      projectType: mapped.projectPatch.projectType || "临时测算",
      place: "",
      tractorDemand: null,
      trailerDemand: null,
      members: [],
      stage: "方案测算",
      status: "进行中",
      createdAt: now,
      updatedAt: now,
      source: "ai_import_temp",
    };
    project = repos.projects.saveProject(project);
    projectId = project.projectId;
  }

  if (!project || !projectId) {
    return {
      session,
      scenario: null,
      project: null,
      defaultsUsed: mapped.defaultsUsed,
      errors: ["请先关联已有项目或创建临时测算"],
      trace: { tool: "createScenarioFromImport", ok: false, detail: "no project" },
    };
  }

  session.projectId = projectId;
  const scenario = repos.scenarios.saveScenario({
    projectId,
    name: mapped.inputs.schemeName || "AI导入测算方案",
    status: "calculated",
    inputs: mapped.inputs,
    notes: `来自导入会话 ${session.id}；mode=demo parser`,
    inputsSource: "user",
  });

  session.status = "completed";
  session.completedScenarioId = scenario.id;
  repos.imports.saveSession(session);

  return {
    session: cloneJson(session),
    scenario,
    project,
    defaultsUsed: mapped.defaultsUsed,
    errors: [],
    trace: { tool: "createScenarioFromImport", ok: true, detail: scenario.id },
  };
}

export function getImportSummaryTool(session: ImportSession) {
  return {
    summary: summarizeParameterStates(session.parameters),
    canCalculate: canStartCalculation(session.parameters),
    trace: { tool: "getImportSummary", ok: true } satisfies ImportToolTrace,
  };
}

export { DEMO_IMPORT_SAMPLE_FILES };
