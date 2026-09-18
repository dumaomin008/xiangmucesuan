import { DEMO_STORAGE_KEYS } from "./keys";
import { ImportRepository } from "./repository/importRepository";
import { ParameterRepository } from "./repository/parameterRepository";
import { ProjectRepository } from "./repository/projectRepository";
import { ScenarioRepository } from "./repository/scenarioRepository";
import { buildSeedProjects, buildSeedScenarios } from "./seed/demo-seed";
import { createLocalStorageAdapter, createMemoryStorage, type KeyValueStorage } from "./storage/kv";

export type DemoRepositories = {
  storage: KeyValueStorage;
  projects: ProjectRepository;
  scenarios: ScenarioRepository;
  parameters: ParameterRepository;
  imports: ImportRepository;
};

export type CreateDemoReposOptions = {
  /** 默认浏览器 LocalStorage；测试可注入 memory */
  storage?: KeyValueStorage;
  /** 空库时写入演示种子 */
  seedIfEmpty?: boolean;
  /** 强制重置并重新种子 */
  forceReseed?: boolean;
};

export function createDemoRepositories(options: CreateDemoReposOptions = {}): DemoRepositories {
  const storage = options.storage ?? createLocalStorageAdapter();
  const projects = new ProjectRepository(storage);
  const scenarios = new ScenarioRepository(storage);
  const parameters = new ParameterRepository(storage);
  const imports = new ImportRepository(storage);

  const empty = projects.listProjects().length === 0 && scenarios.listScenarios().length === 0;
  if (options.forceReseed || (options.seedIfEmpty !== false && empty)) {
    seedDemoData({ projects, scenarios, parameters });
  }

  return { storage, projects, scenarios, parameters, imports };
}

export function seedDemoData(repos: Pick<DemoRepositories, "projects" | "scenarios" | "parameters">) {
  repos.projects.replaceAll(buildSeedProjects());
  repos.scenarios.replaceAll(buildSeedScenarios());
  repos.parameters.savePreferences({
    lastProjectId: "PRJ-DEMO-001",
    lastScenarioId: "SCN-001-BASE",
    compareScenarioIds: ["SCN-001-BASE", "SCN-001-CMP"],
    uiDensity: "comfortable",
  });
}

export function resetDemoData(repos: DemoRepositories) {
  repos.projects.clear();
  repos.scenarios.clear();
  repos.parameters.clear();
  repos.imports.clear();
  seedDemoData(repos);
}

export function createMemoryDemoRepositories(forceReseed = true): DemoRepositories {
  return createDemoRepositories({
    storage: createMemoryStorage(),
    seedIfEmpty: true,
    forceReseed,
  });
}

export { DEMO_STORAGE_KEYS, createMemoryStorage, createLocalStorageAdapter };
