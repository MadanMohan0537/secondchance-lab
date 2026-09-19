import test from "node:test";
import assert from "node:assert/strict";
import { validateContract } from "../src/contract.js";

const base = { version: 1, name: "invite", action: { name: "send" }, windows: [{ id: "duplicate_click", family: "request" }], invariants: { effects: [{ effect: "invite.created", exactly: 1 }] }, failureBudget: { safetyViolations: 0, recoverySuccessRate: 1, outcomeCertaintyRate: 1 } };
test("validates a recovery contract", () => assert.equal(validateContract(base).name, "invite"));
test("rejects duplicate windows", () => assert.throws(() => validateContract({ ...base, windows: [base.windows[0], base.windows[0]] }), /Duplicate window/));
test("rejects ambiguous effect limits", () => assert.throws(() => validateContract({ ...base, invariants: { effects: [{ effect: "invite.created", exactly: 1, max: 1 }] } }), /cannot combine/));
