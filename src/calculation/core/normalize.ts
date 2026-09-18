import { validateSchemeInput } from "@/lib/engine/validate";
import type { SchemeCalculationInput, ValidationIssue } from "./types";

/** 深拷贝输入，保证浏览器侧与服务端侧互不污染 */
export function cloneCalculationInput(input: SchemeCalculationInput): SchemeCalculationInput {
  return JSON.parse(JSON.stringify(input)) as SchemeCalculationInput;
}

/** 校验并返回 issues；不抛错，供 UI 预检 */
export function normalizeAndValidate(input: SchemeCalculationInput): {
  input: SchemeCalculationInput;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
} {
  const cloned = cloneCalculationInput(input);
  const { errors, warnings } = validateSchemeInput(cloned);
  return { input: cloned, errors, warnings };
}

export { validateSchemeInput } from "@/lib/engine/validate";
