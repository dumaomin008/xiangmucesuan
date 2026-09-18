/** LocalStorage Key（演示模式） */
export const DEMO_STORAGE_KEYS = {
  projects: "pm_demo_projects",
  scenarios: "pm_demo_calc_scenarios",
  drafts: "pm_demo_calc_drafts",
  preferences: "pm_demo_calc_preferences",
  imports: "pm_demo_calc_imports",
} as const;

export type DemoStorageKey = (typeof DEMO_STORAGE_KEYS)[keyof typeof DEMO_STORAGE_KEYS];
