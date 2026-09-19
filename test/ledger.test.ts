import test from "node:test";
import assert from "node:assert/strict";
import { MemoryEffectLedger, effect } from "../src/ledger.js";

test("isolates effects by run", async () => { const ledger = new MemoryEffectLedger(); await ledger.append(effect({ runId: "a", attemptId: "1", type: "charge.succeeded", status: "succeeded" })); await ledger.append(effect({ runId: "b", attemptId: "1", type: "charge.succeeded", status: "succeeded" })); assert.equal((await ledger.list("a")).length, 1); });
test("returns defensive copies", async () => { const ledger = new MemoryEffectLedger(); await ledger.append(effect({ runId: "a", attemptId: "1", type: "x", status: "succeeded", metadata: { safe: true } })); const list = await ledger.list("a"); list[0]!.type = "changed"; assert.equal((await ledger.list("a"))[0]!.type, "x"); });
