import { readFile } from "node:fs/promises";
import YAML from "yaml";
import type { RecoveryContract } from "./types.js";

const allowedFamilies = new Set(["request", "session", "environment"]);
const allowedOperators = new Set(["equals", "not_equals", "exists", "not_exists"]);

export function validateContract(value: unknown): RecoveryContract {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Contract must be an object");
  const c = value as Record<string, any>;
  if (c.version !== 1) throw new Error("Only recovery contract version 1 is supported");
  if (typeof c.name !== "string" || !c.name.trim()) throw new Error("Contract name is required");
  if (!c.action || typeof c.action.name !== "string" || !c.action.name.trim()) throw new Error("action.name is required");
  if (!Array.isArray(c.windows) || c.windows.length === 0) throw new Error("At least one interruption window is required");
  const windowIds = new Set<string>();
  for (const window of c.windows) {
    if (!window || typeof window.id !== "string" || !window.id.trim()) throw new Error("Every window requires an id");
    if (windowIds.has(window.id)) throw new Error(`Duplicate window id: ${window.id}`);
    windowIds.add(window.id);
    if (!allowedFamilies.has(window.family)) throw new Error(`Invalid window family: ${window.family}`);
  }
  if (!c.invariants || !Array.isArray(c.invariants.effects) || c.invariants.effects.length === 0) throw new Error("At least one effect invariant is required");
  for (const invariant of c.invariants.effects) {
    if (!invariant || typeof invariant.effect !== "string" || !invariant.effect) throw new Error("Effect invariant requires effect");
    const limits = [invariant.exactly, invariant.min, invariant.max].filter((n) => n !== undefined);
    if (limits.length === 0 || limits.some((n) => !Number.isSafeInteger(n) || n < 0)) throw new Error(`Invalid limits for ${invariant.effect}`);
    if (invariant.exactly !== undefined && limits.length > 1) throw new Error(`${invariant.effect} cannot combine exactly with min/max`);
  }
  for (const assertion of c.invariants.state ?? []) {
    if (typeof assertion.path !== "string" || !assertion.path || !allowedOperators.has(assertion.operator)) throw new Error("Invalid state assertion");
  }
  const budget = c.failureBudget;
  if (!budget || !Number.isSafeInteger(budget.safetyViolations) || budget.safetyViolations < 0) throw new Error("Invalid safety violation budget");
  for (const key of ["recoverySuccessRate", "outcomeCertaintyRate"] as const) {
    if (typeof budget[key] !== "number" || budget[key] < 0 || budget[key] > 1) throw new Error(`${key} must be between 0 and 1`);
  }
  return c as RecoveryContract;
}

export async function loadContract(path: string): Promise<RecoveryContract> {
  const text = await readFile(path, "utf8");
  return validateContract(YAML.parse(text));
}
