export { DEMO_SCHEMA_VERSION } from "./types";
export type {
  DemoProjectContext,
  DemoProjectRecord,
  DemoCalcScenario,
  DemoCalcDraft,
  DemoCalcPreferences,
  DemoScenarioResults,
  DemoInputsSource,
  ScenarioStatus,
  VersionedEnvelope,
} from "./types";

export { DEMO_STORAGE_KEYS } from "./keys";
export {
  createDemoRepositories,
  createMemoryDemoRepositories,
  seedDemoData,
  resetDemoData,
  createMemoryStorage,
  createLocalStorageAdapter,
} from "./bootstrap";
export type { DemoRepositories, CreateDemoReposOptions } from "./bootstrap";

export { ProjectRepository } from "./repository/projectRepository";
export { ScenarioRepository, fingerprintSchemeInputs } from "./repository/scenarioRepository";
export { ParameterRepository } from "./repository/parameterRepository";
export { VersionedStore } from "./storage/versioned";

export { buildSeedProjects, buildSeedScenarios, computeScenarioResults } from "./seed/demo-seed";
export { analyzeScenarioLocal, buildAiPayload } from "./ai/analyze";
export type { DemoAiInsight, DemoAiRiskItem, DemoAiRiskLevel } from "./ai/analyze";
