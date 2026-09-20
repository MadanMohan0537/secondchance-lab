import test from "node:test";
import assert from "node:assert/strict";
import { analyzeMultiActorSteps, contractToTla, contractsFromStateMachine, evaluateDeployGate, expandFeatureFlagPlan, incidentToRecoveryContract, mineRecoveryPatterns, RecoveryApi, RecoveryAwareMock, recoveryBenchmark, recoveryDebt, recoveryPlaybook, simulateJourneyTwin, verifyAgentToolExecution } from "../src/index.js";
import type { RecoveryContract, VerificationReport } from "../src/types.js";

const contract: RecoveryContract = { version: 1, name: "checkout", action: { name: "pay", idempotencyKey: "intent" }, windows: [{ id: "timeout", family: "request" }, { id: "reload", family: "session" }], invariants: { effects: [{ effect: "charge", exactly: 1 }], state: [{ path: "backend.status", operator: "equals", value: "paid" }] }, failureBudget: { safetyViolations: 0, recoverySuccessRate: 1, outcomeCertaintyRate: 1 } };
const report: VerificationReport = { contract: "checkout", passed: true, generatedAt: "now", summary: { scenarios: 1, safetyViolations: 0, recoverySuccessRate: 1, outcomeCertaintyRate: 1 }, scenarios: [{ runId: "r", window: contract.windows[0]!, recovered: true, outcomeCertain: true, effects: [], state: { backend: {}, visible: {} }, trace: [], violations: [] }], suggestions: [] };

test("feature flag plans expand into deterministic interruption cases", () => assert.deepEqual(expandFeatureFlagPlan({ restoreAfterRun: true, variants: [{ flag: "checkout-v2", value: true, atWindow: "after_send" }] })[0], { id: "checkout-v2:true:0", flags: { "checkout-v2": true }, window: "after_send" }));

test("recovery-aware mock applies attempt-specific provider failures", async () => { const mock = new RecoveryAwareMock([{ operation: "charge", attempt: 1, response: { status: 504, drop: true } }], { status: 201 }); assert.equal((await mock.handle("charge")).status, 504); assert.equal((await mock.handle("charge")).status, 201); assert.equal(mock.calls("charge"), 2); });

test("playbooks and incidents produce usable contract artifacts", () => { assert.match(recoveryPlaybook(contract), /Do not repeat/); const generated = incidentToRecoveryContract({ title: "timeout", flow: "User pays for an order", symptom: "Payment response timed out but backend status succeeded" }); assert.equal(generated.contract.action.name, "capture-payment"); });

test("multi-actor analysis detects conflicting effects", () => { const result = analyzeMultiActorSteps([{ id: "a", actor: "user", action: "approve", effect: "record.update" }, { id: "b", actor: "admin", action: "revoke", effect: "record.update" }]); assert.equal(result.conflicts.length, 1); assert.deepEqual(result.order, ["a", "b"]); });

test("agent tool verification enforces authorization and cardinality", () => { const result = verifyAgentToolExecution({ intentId: "i", tool: "charge", argumentsDigest: "x", authorized: true, maxExecutions: 1 }, [{ intentId: "i", tool: "charge", executionId: "1", status: "succeeded" }, { intentId: "i", tool: "charge", executionId: "2", status: "succeeded" }]); assert.equal(result.passed, false); assert.match(result.violations[0]!, /maximum/); });

test("state machines generate transition contracts and formal specs", () => { const contracts = contractsFromStateMachine({ id: "order", initial: "draft", states: { draft: { on: { SUBMIT: "pending" } }, pending: {} } }); assert.equal(contracts.length, 1); assert.equal(contracts[0]!.invariants.state?.[0]?.value, "pending"); assert.match(contractToTla(contract), /MODULE checkout/); assert.match(contractToTla(contract), /Safety/); });

test("deploy gates and debt scores prioritize unsafe recovery", () => { const gate = evaluateDeployGate({ safetyViolations: 1, recoverySuccessRate: 0.9, outcomeCertaintyRate: 0.8 }, { maximumSafetyViolations: 0, minimumRecoveryRate: 0.99, minimumCertaintyRate: 0.95, allowOverride: true }); assert.equal(gate.allowed, false); assert.equal(gate.overrideRequired, true); assert.ok(recoveryDebt({ flow: "checkout", untestedWindows: 3, knownSafetyRisks: 1, businessImpact: 100, effort: 5 }).score > 50); });

test("benchmark ranks safer products first", () => { const ranked = recoveryBenchmark([{ product: "safe", category: "saas", score: { safetyViolations: 0, recoverySuccessRate: 1, outcomeCertaintyRate: 1 }, methodologyVersion: "1", sampledAt: "now" }, { product: "unsafe", category: "saas", score: { safetyViolations: 1, recoverySuccessRate: 0.5, outcomeCertaintyRate: 0.5 }, methodologyVersion: "1", sampledAt: "now" }]); assert.deepEqual(ranked.map((item) => item.product), ["safe", "unsafe"]); });

test("journey twin propagates dependency failures", () => { const child = structuredClone(contract); child.name = "fulfillment"; child.invariants.effects = [{ effect: "shipment", exactly: 1 }]; const result = simulateJourneyTwin([{ id: "checkout", contract }, { id: "fulfillment", contract: child, dependencies: ["checkout"] }], ["charge"]); assert.deepEqual(result.blocked, ["checkout", "fulfillment"]); });

test("Recovery API answers status and untested-window queries", () => { const api = new RecoveryApi(); api.register(contract); api.record(report); assert.equal(api.doesRecover("checkout"), true); assert.deepEqual(api.untestedWindows("checkout"), ["reload"]); assert.equal(api.list()[0]?.untested, 1); });

test("pattern miner returns only observed patterns", () => { const patterns = mineRecoveryPatterns([report], [{ id: "certain", label: "Certain outcomes", recommendation: "Keep status visible", condition: (item) => item.summary.outcomeCertaintyRate === 1 }, { id: "unsafe", label: "Unsafe", recommendation: "Fix", condition: (item) => item.summary.safetyViolations > 0 }]); assert.deepEqual(patterns.map((item) => item.id), ["certain"]); });
