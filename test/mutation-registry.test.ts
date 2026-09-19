import test from "node:test";
import assert from "node:assert/strict";
import { InMemoryContractRegistry, mutateContract, mutationScore } from "../src/index.js";
import type { RecoveryContract } from "../src/types.js";

const contract: RecoveryContract = { version: 1, name: "checkout", action: { name: "pay", idempotencyKey: "intent" }, windows: [{ id: "timeout", family: "request" }, { id: "reload", family: "session" }], invariants: { effects: [{ effect: "charge", exactly: 1 }], state: [{ path: "backend.status", operator: "equals", value: "paid" }] }, failureBudget: { safetyViolations: 0, recoverySuccessRate: 1, outcomeCertaintyRate: 1 } };

test("creates deterministic contract mutations and scores detections", () => {
  const mutations = mutateContract(contract);
  assert.equal(mutations.length, 7);
  assert.equal(mutationScore(mutations, mutations.map((item) => item.id)), 100);
  assert.equal(mutationScore(mutations, []), 0);
});

test("publishes and searches immutable versioned templates", () => {
  const registry = new InMemoryContractRegistry();
  registry.publish({ namespace: "stripe", name: "checkout", version: "1.0.0", description: "Exactly-once card checkout", contract, tags: ["payment", "idempotency"] });
  assert.equal(registry.get("stripe/checkout@1.0.0").name, "checkout");
  assert.equal(registry.search("payment idempotency").length, 1);
  assert.throws(() => registry.publish({ namespace: "stripe", name: "checkout", version: "1.0.0", description: "duplicate", contract, tags: [] }), /already exists/);
});
