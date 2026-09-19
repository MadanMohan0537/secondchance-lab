import type { RecoveryContract, ScenarioResult, VerificationReport, Violation } from "./types.js";

const round = (value: number) => Number(value.toFixed(4));
const readPath = (root: Record<string, unknown>, path: string): unknown => path.split(".").reduce<unknown>((value, key) => value && typeof value === "object" ? (value as Record<string, unknown>)[key] : undefined, root);

export function verify(contract: RecoveryContract, results: ScenarioResult[], now = new Date()): VerificationReport {
  if (results.length === 0) throw new Error("No scenario results to verify");
  const scenarios = results.map((result) => {
    const violations: Violation[] = [];
    for (const invariant of contract.invariants.effects) {
      const observed = result.effects.filter((e) => e.type === invariant.effect && e.status === "succeeded" && !result.effects.some((r) => r.type === e.type && r.externalId === e.externalId && r.status === "reversed")).length;
      const valid = invariant.exactly !== undefined ? observed === invariant.exactly : observed >= (invariant.min ?? 0) && observed <= (invariant.max ?? Infinity);
      if (!valid) violations.push({ kind: "safety", invariant: invariant.effect, expected: invariant, observed, windowId: result.window.id, evidence: result.effects.filter((e) => e.type === invariant.effect).map((e) => e.id) });
    }
    for (const assertion of contract.invariants.state ?? []) {
      const observed = readPath({ backend: result.state.backend, visible: result.state.visible }, assertion.path);
      const valid = assertion.operator === "equals" ? Object.is(observed, assertion.value) : assertion.operator === "not_equals" ? !Object.is(observed, assertion.value) : assertion.operator === "exists" ? observed !== undefined && observed !== null : observed === undefined || observed === null;
      if (!valid) violations.push({ kind: "state", invariant: assertion.path, expected: assertion, observed, windowId: result.window.id, evidence: result.trace });
    }
    if (!result.recovered) violations.push({ kind: "recovery", invariant: "task_recovered", expected: true, observed: false, windowId: result.window.id, evidence: result.trace });
    if (!result.outcomeCertain) violations.push({ kind: "certainty", invariant: "outcome_certain", expected: true, observed: false, windowId: result.window.id, evidence: result.trace });
    return { ...result, violations };
  });
  const safetyViolations = scenarios.flatMap((s) => s.violations).filter((v) => v.kind === "safety").length;
  const recoverySuccessRate = round(results.filter((r) => r.recovered).length / results.length);
  const outcomeCertaintyRate = round(results.filter((r) => r.outcomeCertain).length / results.length);
  const summary = { scenarios: results.length, safetyViolations, recoverySuccessRate, outcomeCertaintyRate };
  const suggestions = suggest(scenarios.flatMap((s) => s.violations));
  return { contract: contract.name, generatedAt: now.toISOString(), passed: safetyViolations <= contract.failureBudget.safetyViolations && recoverySuccessRate >= contract.failureBudget.recoverySuccessRate && outcomeCertaintyRate >= contract.failureBudget.outcomeCertaintyRate, summary, scenarios, suggestions };
}

function suggest(violations: Violation[]): string[] {
  const suggestions = new Set<string>();
  if (violations.some((v) => v.kind === "safety" && Number(v.observed) > 1)) suggestions.add("Enforce an idempotency key at the side-effect boundary and return the original result for repeated attempts.");
  if (violations.some((v) => v.kind === "state")) suggestions.add("Reconcile visible state against the system of record after reconnect, reload, and timeout.");
  if (violations.some((v) => v.kind === "recovery")) suggestions.add("Persist a resume token or durable workflow state so the task can continue without repeating the side effect.");
  if (violations.some((v) => v.kind === "certainty")) suggestions.add("Show a pending state with a status check instead of a generic failure that encourages blind retry.");
  return [...suggestions];
}
