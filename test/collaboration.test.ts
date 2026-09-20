import test from "node:test";
import assert from "node:assert/strict";
import { postmortemMarkdown, recoveryBadge, renderPullRequestComment, ReplayStore, weeklyDigest } from "../src/index.js";
import type { VerificationReport } from "../src/types.js";

const report: VerificationReport = { contract: "checkout", passed: false, generatedAt: "2026-09-20T00:00:00Z", summary: { scenarios: 1, safetyViolations: 1, recoverySuccessRate: 0, outcomeCertaintyRate: 0.5 }, scenarios: [{ runId: "r", window: { id: "timeout", family: "request" }, recovered: false, outcomeCertain: false, effects: [], state: { backend: {}, visible: {} }, trace: ["sent"], violations: [{ kind: "safety", invariant: "charge exactly once", expected: 1, observed: 2, windowId: "timeout", evidence: ["charge-1", "charge-2"] }] }], suggestions: ["Add an idempotency key."] };

test("replay store uses opaque expiring tokens and defensive data", () => {
  const store = new ReplayStore(); const created = store.create(report, { ttlMs: 1000 }); const loaded = store.get(created.token, Date.parse(created.artifact.createdAt));
  assert.equal(loaded.id, created.artifact.id); loaded.report.contract = "changed"; assert.equal(store.get(created.token, Date.parse(created.artifact.createdAt)).report.contract, "checkout"); assert.throws(() => store.get(created.token, Date.parse(created.artifact.createdAt) + 2000), /expired/);
});

test("PR comment renders regressions and replay evidence", () => {
  const comment = renderPullRequestComment({ contract: "checkout", passed: false, deltas: [{ metric: "safetyViolations", before: 0, after: 1, delta: 1, regression: true }], replayUrl: "https://example.test/replay", untestedWindows: ["after_commit"] });
  assert.match(comment, /Recovery regression detected/); assert.match(comment, /after_commit/); assert.match(comment, /Open recovery replay/);
});

test("badge is accessible and reflects thresholds", () => {
  const badge = recoveryBadge({ totalWindows: 4, enabledWindows: 4, coveredFamilies: ["request"], missingFamilies: ["session", "environment"], score: 87, windows: [] }, 5);
  assert.match(badge, /aria-label="recovery: 87% \| 5 critical"/); assert.match(badge, /yellow/);
});

test("postmortem and digest retain actionable evidence", () => {
  assert.match(postmortemMarkdown(report), /charge exactly once/); assert.match(postmortemMarkdown(report), /idempotency key/);
  const digest = weeklyDigest([report]); assert.match(digest, /Safety violations: 1/); assert.match(digest, /checkout/);
});
