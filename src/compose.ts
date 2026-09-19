import type { RecoveryContract } from "./types.js";
import { validateContract } from "./contract.js";

export function composeContracts(base: RecoveryContract, ...extensions: RecoveryContract[]): RecoveryContract {
  const result = structuredClone(base);
  for (const extension of extensions) {
    result.name = extension.name || result.name;
    result.description = extension.description ?? result.description;
    result.action = { ...result.action, ...extension.action };
    result.windows = mergeBy(result.windows, extension.windows, "id");
    result.invariants.effects = mergeBy(result.invariants.effects, extension.invariants.effects, "effect");
    result.invariants.state = mergeBy(result.invariants.state ?? [], extension.invariants.state ?? [], "path");
    result.failureBudget = {
      safetyViolations: Math.min(result.failureBudget.safetyViolations, extension.failureBudget.safetyViolations),
      recoverySuccessRate: Math.max(result.failureBudget.recoverySuccessRate, extension.failureBudget.recoverySuccessRate),
      outcomeCertaintyRate: Math.max(result.failureBudget.outcomeCertaintyRate, extension.failureBudget.outcomeCertaintyRate)
    };
  }
  return validateContract(result);
}

function mergeBy<T, K extends keyof T>(base: T[], extension: T[], key: K): T[] {
  const result = new Map(base.map((item) => [String(item[key]), item]));
  for (const item of extension) result.set(String(item[key]), item);
  return [...result.values()];
}
