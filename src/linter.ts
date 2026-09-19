import type { ContractDiagnostic, RecoveryContract } from "./types.js";

const expectedFamilies = ["request", "session", "environment"] as const;

export function lintContract(contract: RecoveryContract): ContractDiagnostic[] {
  const diagnostics: ContractDiagnostic[] = [];
  const add = (diagnostic: ContractDiagnostic): void => { diagnostics.push(diagnostic); };

  if (!contract.description?.trim()) add({ rule: "contract-description", severity: "info", path: "description", message: "Describe the user intent and recovery promise.", fix: "Add a contract description." });
  if (!contract.action.idempotencyKey) add({ rule: "idempotency-key", severity: "warning", path: "action.idempotencyKey", message: "The action has no declared idempotency key.", fix: "Declare the expression used to correlate retries." });
  if (!contract.invariants.state?.length) add({ rule: "backend-state", severity: "warning", path: "invariants.state", message: "No backend or visible-state assertion proves the final outcome.", fix: "Add at least one deterministic state assertion." });
  if (contract.failureBudget.safetyViolations > 0) add({ rule: "safety-budget", severity: "warning", path: "failureBudget.safetyViolations", message: "Critical side-effect violations are permitted.", fix: "Set the safety violation budget to zero for irreversible actions." });

  const families = new Set(contract.windows.filter((window) => window.enabled !== false).map((window) => window.family));
  for (const family of expectedFamilies) {
    if (!families.has(family)) add({ rule: "window-family", severity: "info", path: "windows", message: `No enabled ${family} lifecycle window is tested.`, fix: `Add a ${family} interruption window.` });
  }

  for (const [index, effect] of contract.invariants.effects.entries()) {
    if (effect.exactly === undefined) add({ rule: "bounded-effect", severity: "warning", path: `invariants.effects[${index}]`, message: `${effect.effect} is bounded but not exact; duplicates or losses may still pass.`, fix: "Use exactly when the business effect must occur a precise number of times." });
  }
  for (const [index, assertion] of (contract.invariants.state ?? []).entries()) {
    if ((assertion.operator === "equals" || assertion.operator === "not_equals") && assertion.value === undefined) add({ rule: "assertion-value", severity: "error", path: `invariants.state[${index}].value`, message: `${assertion.operator} requires an explicit value.`, fix: "Provide the expected value." });
  }

  return diagnostics.sort((a, b) => severityRank(a.severity) - severityRank(b.severity) || a.path.localeCompare(b.path));
}

export function applySafeFixes(contract: RecoveryContract): RecoveryContract {
  const fixed = structuredClone(contract);
  fixed.description ||= `Recovery contract for ${fixed.action.name}`;
  if (fixed.invariants.effects.some((effect) => effect.exactly === 1)) fixed.failureBudget.safetyViolations = 0;
  return fixed;
}

const severityRank = (severity: ContractDiagnostic["severity"]): number => ({ error: 0, warning: 1, info: 2 })[severity];
