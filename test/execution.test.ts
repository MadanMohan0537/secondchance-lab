import test from "node:test";
import assert from "node:assert/strict";
import { executeWithFaults, OrderedEventProcessor, mutateEventDelivery, runRecoverableJob, runInterruptedLoad, runRuntimeMatrix, reconcileOfflineState, RecoveryStateGraph, TimeTravelTimeline } from "../src/index.js";

test("time-travel timeline moves across defensive snapshots", () => {
  const timeline = new TimeTravelTimeline<{ status: string }>();
  timeline.capture("created", { status: "pending" }); timeline.capture("committed", { status: "paid" });
  assert.equal(timeline.stepBack()?.state.status, "pending"); assert.equal(timeline.stepForward()?.state.status, "paid");
  const exported = timeline.export(); exported[0]!.state.status = "corrupt"; assert.equal(timeline.seek(0).state.status, "pending");
});

test("state graph validates causality and exports Mermaid", () => {
  const graph = new RecoveryStateGraph(); graph.addNode({ id: "click", kind: "action", label: "Pay" }); graph.addNode({ id: "charge", kind: "effect", label: "Charge succeeded" }); graph.connect({ from: "click", to: "charge", relation: "causes" });
  assert.match(graph.toMermaid(), /click.*causes.*charge/); assert.throws(() => graph.connect({ from: "missing", to: "charge", relation: "causes" }), /unknown node/);
});

test("API execution identifies ambiguous post-commit outcomes and duplicates", async () => {
  let effects = 0; const transport = { async send() { effects++; return { status: 201, body: { effects } }; } };
  const result = await executeWithFaults(transport, { id: "r1", operation: "pay", payload: {} }, [{ at: "after_send", kind: "duplicate" }, { at: "after_commit", kind: "drop" }]);
  assert.equal(result.attempts, 2); assert.equal(result.ambiguous, true); assert.equal(effects, 2);
});

test("runtime matrix isolates failures", async () => {
  const matrix = await runRuntimeMatrix([{ name: "chromium", async execute() { return "ok"; } }, { name: "webkit", async execute() { throw new Error("storage mismatch"); } }]);
  assert.deepEqual(matrix.map((item) => item.ok), [true, false]);
});

test("event recovery buffers out-of-order delivery and rejects duplicates", async () => {
  const handled: number[] = []; const processor = new OrderedEventProcessor(1, async (event) => { handled.push(event.sequence); });
  const events = [{ id: "one", sequence: 1, type: "paid", payload: {}, occurredAt: "now" }, { id: "two", sequence: 2, type: "fulfilled", payload: {}, occurredAt: "now" }];
  const delivery = mutateEventDelivery(events, { duplicateIds: ["one"], reverse: true });
  for (const event of delivery) await processor.accept(event);
  assert.deepEqual(handled, [1, 2]); assert.equal(processor.pending().length, 0);
});

test("background jobs retry crashes and dead-letter exhausted work", async () => {
  const recovered = await runRecoverableJob({ id: "job", payload: {}, maxAttempts: 3 }, async () => {}, { crashAfterAttempts: [1] });
  assert.equal(recovered.status, "completed"); assert.equal(recovered.attempts, 2);
  const failed = await runRecoverableJob({ id: "bad", payload: {}, maxAttempts: 2 }, async () => { throw new Error("poison"); });
  assert.equal(failed.status, "dead-letter");
});

test("interrupted load reports isolated scenario failures", async () => {
  const report = await runInterruptedLoad(20, 4, async (index) => { if (index % 5 === 0) throw new Error("race"); return index; });
  assert.equal(report.completed, 16); assert.equal(report.failed, 4); assert.equal(report.samples.length, 20);
});

test("offline reconciliation exposes equal-version conflicts", () => {
  const client = { value: { title: "client" }, version: 2, updatedAt: "now", actor: "device" }; const server = { value: { title: "server" }, version: 2, updatedAt: "now", actor: "api" };
  const result = reconcileOfflineState(client, server, "server-wins"); assert.equal(result.conflict, true); assert.equal(result.value.value.title, "server");
});
