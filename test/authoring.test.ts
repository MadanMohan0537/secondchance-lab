import test from "node:test";
import assert from "node:assert/strict";
import { applySafeFixes, composeContracts, contractCoverage, contractFromNaturalLanguage, diffContracts, fuzzContract, lintContract } from "../src/index.js";
import type { RecoveryContract } from "../src/types.js";

const base: RecoveryContract = {
  version: 1, name: "invite", action: { name: "send-invite" },
  windows: [{ id: "after-send", family: "request" }],
  invariants: { effects: [{ effect: "invite.sent", exactly: 1 }] },
  failureBudget: { safetyViolations: 0, recoverySuccessRate: 1, outcomeCertaintyRate: 1 }
};

test("generates an executable contract from a workflow description", () => {
  const result = contractFromNaturalLanguage("User invites a teammate; invite must send exactly once; form data must survive a reload; backend status is visible.");
  assert.equal(result.contract.invariants.effects[0]?.effect, "invite.sent");
  assert.equal(result.contract.windows[0]?.id, "reload_mid_flow");
  assert.equal(result.contract.action.idempotencyKey, "${intent.id}");
});

test("lints evidence gaps and applies only safe fixes", () => {
  const diagnostics = lintContract(base);
  assert.ok(diagnostics.some((item) => item.rule === "idempotency-key"));
  assert.ok(diagnostics.some((item) => item.rule === "backend-state"));
  assert.match(applySafeFixes(base).description ?? "", /send-invite/);
});

test("composes contracts while preserving the strictest budget", () => {
  const extension: RecoveryContract = { ...base, name: "email-invite", action: { name: "send-email", idempotencyKey: "intent" }, windows: [{ id: "reload", family: "session" }], failureBudget: { safetyViolations: 2, recoverySuccessRate: 0.9, outcomeCertaintyRate: 0.8 } };
  const result = composeContracts(base, extension);
  assert.deepEqual(result.windows.map((window) => window.id), ["after-send", "reload"]);
  assert.equal(result.failureBudget.safetyViolations, 0);
  assert.equal(result.failureBudget.recoverySuccessRate, 1);
});

test("semantic diff marks removed verification as breaking", () => {
  const after: RecoveryContract = { ...base, invariants: { effects: [{ effect: "invite.sent", max: 2 }] } };
  assert.ok(diffContracts(base, after).some((change) => change.kind === "weakened" && change.breaking));
});

test("fuzzing is deterministic and covers fault timing combinations", () => {
  const first = fuzzContract(base);
  assert.equal(first.length, 15);
  assert.deepEqual(first, fuzzContract(base));
});

test("coverage reports missing lifecycle families", () => {
  const coverage = contractCoverage(base);
  assert.equal(coverage.score, 73);
  assert.deepEqual(coverage.missingFamilies, ["session", "environment"]);
});
