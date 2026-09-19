import test from "node:test";
import assert from "node:assert/strict";
import { loadContract } from "../src/contract.js";
import { runRecoveryContract } from "../src/runner.js";
import { resilientCheckout, vulnerableCheckout } from "../src/demo.js";

const contract = await loadContract(new URL("../examples/checkout.recovery.yml", import.meta.url).pathname);
test("finds duplicate effects and ambiguous UI in the vulnerable checkout", async () => { const report = await runRecoveryContract(contract, vulnerableCheckout); assert.equal(report.passed, false); assert.ok(report.summary.safetyViolations >= 1); assert.ok(report.suggestions.some((s) => s.includes("idempotency"))); });
test("passes a resilient exactly-once implementation", async () => { const report = await runRecoveryContract(contract, resilientCheckout, { concurrency: 2 }); assert.equal(report.passed, true); assert.deepEqual(report.summary, { scenarios: 4, safetyViolations: 0, recoverySuccessRate: 1, outcomeCertaintyRate: 1 }); });
