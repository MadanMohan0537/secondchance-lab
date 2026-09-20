import test from "node:test";
import assert from "node:assert/strict";
import { assessOutcomeCertainty, bisectRegression, detectOrphanedState, diffEnvironments, diffRecoveryScores, estimateRecoveryEffort, evaluateRecoverySlo } from "../src/index.js";

test("recovery score diff classifies directional regressions", () => {
  const diff = diffRecoveryScores({ safetyViolations: 0, recoverySuccessRate: 1, outcomeCertaintyRate: 0.9 }, { safetyViolations: 1, recoverySuccessRate: 0.8, outcomeCertaintyRate: 1 });
  assert.equal(diff.find((item) => item.metric === "safetyViolations")?.regression, true);
  assert.equal(diff.find((item) => item.metric === "recoverySuccessRate")?.regression, true);
  assert.equal(diff.find((item) => item.metric === "outcomeCertaintyRate")?.regression, false);
});

test("SLO evaluation calculates compliance and burn rate", () => {
  const now = Date.parse("2026-09-20T12:00:00Z"); const samples = Array.from({ length: 100 }, (_, index) => ({ timestamp: "2026-09-20T11:00:00Z", recovered: index < 98, outcomeCertain: true, durationMs: 50 }));
  const result = evaluateRecoverySlo({ name: "checkout", target: 0.99, windowMs: 86_400_000, metric: "recoverySuccessRate" }, samples, now);
  assert.equal(result.compliant, false); assert.ok(result.burnRate > 1);
});

test("regression bisect finds first failing revision logarithmically", async () => {
  const revisions = Array.from({ length: 100 }, (_, index) => index); const result = await bisectRegression(revisions, async (revision) => revision < 63);
  assert.equal(result.firstFailing, 63); assert.equal(result.previousPassing, 62); assert.ok(result.probes < 10);
});

test("environment diff marks recovery-sensitive configuration", () => {
  const diff = diffEnvironments([{ name: "staging", config: { retry: { count: 2 }, region: "us" }, score: { safetyViolations: 0, recoverySuccessRate: 1, outcomeCertaintyRate: 1 } }, { name: "prod", config: { retry: { count: 5 }, region: "us" }, score: { safetyViolations: 0, recoverySuccessRate: 1, outcomeCertaintyRate: 1 } }], ["retry"]);
  assert.deepEqual(diff.map((item) => [item.path, item.affectsRecovery]), [["retry.count", true]]);
});

test("orphan detector returns rule evidence and severity", () => {
  const findings = detectOrphanedState([{ id: "p1", charged: true, visible: false }, { id: "p2", charged: true, visible: true }], [{ name: "hidden-charge", resource: "payment", severity: "critical", isOrphan: (record) => record.charged && !record.visible, evidence: (record) => ({ id: record.id }) }]);
  assert.deepEqual(findings, [{ rule: "hidden-charge", resource: "payment", severity: "critical", evidence: { id: "p1" } }]);
});

test("outcome certainty penalizes unsafe retry messaging", () => {
  const safe = assessOutcomeCertainty({ visibleStatus: "succeeded", backendStatus: "succeeded", hasConfirmation: true, hasStatusCheck: true, errorAllowsRetry: false, pendingIndicator: false });
  const ambiguous = assessOutcomeCertainty({ visibleStatus: "failed", backendStatus: "succeeded", hasConfirmation: false, hasStatusCheck: false, errorAllowsRetry: true, pendingIndicator: false });
  assert.equal(safe.score, 90); assert.equal(safe.certain, true); assert.equal(ambiguous.score, 0); assert.equal(ambiguous.certain, false);
});

test("recovery effort measures re-entry and cognitive work", () => {
  const effort = estimateRecoveryEffort([{ kind: "click", durationMs: 100 }, { kind: "navigation", durationMs: 500 }, { kind: "input", durationMs: 1000, reenteredCharacters: 50 }, { kind: "decision", durationMs: 300 }]);
  assert.equal(effort.reenteredCharacters, 50); assert.equal(effort.cognitiveSteps, 2); assert.ok(effort.index > 30);
});
