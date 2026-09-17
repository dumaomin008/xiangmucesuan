export const ROLES = {
  BUSINESS: "BUSINESS",
  MANAGER: "MANAGER",
  ADMIN: "ADMIN",
  READONLY: "READONLY",
} as const;

export type DemoRole = (typeof ROLES)[keyof typeof ROLES];

export const ROLE_LABEL: Record<DemoRole, string> = {
  BUSINESS: "项目业务人员",
  MANAGER: "项目负责人",
  ADMIN: "管理员 / 财务规则管理员",
  READONLY: "只读用户",
};

export function canEdit(role: DemoRole) {
  return role === "BUSINESS" || role === "MANAGER" || role === "ADMIN";
}

export function canSetBaseline(role: DemoRole) {
  return role === "MANAGER" || role === "ADMIN";
}

export function canManageRules(role: DemoRole) {
  return role === "ADMIN";
}

export function parseRole(value: string | null | undefined): DemoRole {
  if (value && value in ROLE_LABEL) return value as DemoRole;
  return "MANAGER";
}
