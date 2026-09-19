import { effect, type ScenarioAdapter } from "./index.js";

/** Deliberately vulnerable checkout: retry uses a new provider key after a lost acknowledgement. */
export const vulnerableCheckout: ScenarioAdapter = {
  name: "vulnerable-checkout",
  async run(ctx) {
    let charges = 0; let orders = 0; let visibleStatus = "processing"; let timedOut = false;
    const charge = async (attemptId: string, providerId: string) => {
      ctx.trace(`${attemptId}:request_sent`);
      if (ctx.window.id === "after_send_before_ack" && attemptId === "attempt-1") timedOut = true;
      charges++;
      await ctx.ledger.append(effect({ runId: ctx.runId, attemptId, type: "charge.succeeded", status: "succeeded", externalId: providerId }));
      ctx.trace(`${attemptId}:provider_accepted`);
      if (ctx.window.id === "after_commit_before_response" && attemptId === "attempt-1") timedOut = true;
      if (!timedOut) visibleStatus = "paid";
    };
    await charge("attempt-1", "ch_1");
    if (timedOut || ctx.window.id === "duplicate_click") {
      visibleStatus = "failed_try_again"; ctx.trace("ui:retry_prompted");
      await charge("attempt-2", "ch_2");
    }
    orders++;
    await ctx.ledger.append(effect({ runId: ctx.runId, attemptId: "order", type: "order.created", status: "succeeded", externalId: "order_1" }));
    if (ctx.window.id === "refresh_during_processing") { visibleStatus = "unknown"; ctx.trace("ui:refreshed_without_reconciliation"); }
    return { recovered: orders === 1, outcomeCertain: visibleStatus === "paid", state: { backend: { charges, orders, paymentStatus: "paid" }, visible: { paymentStatus: visibleStatus } } };
  }
};

/** Corrected checkout: a stable idempotency key and status reconciliation close the window. */
export const resilientCheckout: ScenarioAdapter = {
  name: "resilient-checkout",
  async run(ctx) {
    const key = "checkout-42"; let charged = false;
    const charge = async (attemptId: string) => {
      ctx.trace(`${attemptId}:request_sent:${key}`);
      if (!charged) { charged = true; await ctx.ledger.append(effect({ runId: ctx.runId, attemptId, type: "charge.succeeded", status: "succeeded", externalId: "ch_stable", idempotencyKey: key })); }
      else ctx.trace(`${attemptId}:provider_returned_original_result`);
    };
    await charge("attempt-1");
    if (["after_send_before_ack", "after_commit_before_response", "duplicate_click"].includes(ctx.window.id)) await charge("attempt-2");
    await ctx.ledger.append(effect({ runId: ctx.runId, attemptId: "order", type: "order.created", status: "succeeded", externalId: "order_1", idempotencyKey: key }));
    ctx.trace("ui:reconciled_from_status_endpoint");
    return { recovered: true, outcomeCertain: true, state: { backend: { charges: 1, orders: 1, paymentStatus: "paid" }, visible: { paymentStatus: "paid" } } };
  }
};
