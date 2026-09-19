import type { RecoveryContract, WindowFamily } from "./types.js";

export interface GeneratedContract {
  contract: RecoveryContract;
  questions: string[];
  assumptions: string[];
}

export function contractFromNaturalLanguage(input: string): GeneratedContract {
  if (!input.trim()) throw new Error("A workflow description is required");
  const text = input.toLowerCase();
  const action = inferAction(text);
  const effect = inferEffect(action);
  const questions: string[] = [];
  const assumptions: string[] = [];
  if (!/exactly once|never twice|no duplicate|at most once/.test(text)) questions.push("How many successful side effects are allowed for one user intent?");
  if (!/reload|refresh|timeout|offline|disconnect|retry|duplicate|back button/.test(text)) questions.push("Which interruption should the first contract exercise?");
  if (!/database|backend|record|status|visible|confirmation/.test(text)) questions.push("Which backend state proves that the action completed?");

  const windows = inferWindows(text);
  if (!windows.length) { windows.push({ id: "timeout_after_send", family: "request" as WindowFamily, description: "Request leaves the client but acknowledgement is lost" }); assumptions.push("A timeout after request transmission is the initial ambiguous outcome window."); }
  const exactly = /at most once/.test(text) ? 0 : 1;
  if (exactly === 0) assumptions.push("At-most-once language was interpreted as zero allowed successful effects; confirm whether max: 1 is intended.");

  return {
    contract: {
      version: 1,
      name: slug(`${action}-recovery`),
      description: input.trim(),
      action: { name: action, idempotencyKey: "${intent.id}" },
      windows,
      invariants: { effects: exactly === 0 ? [{ effect, max: 1 }] : [{ effect, exactly }], state: [{ path: `backend.${effect}.status`, operator: "equals", value: "succeeded" }] },
      failureBudget: { safetyViolations: 0, recoverySuccessRate: 1, outcomeCertaintyRate: 1 }
    },
    questions,
    assumptions
  };
}

function inferAction(text: string): string {
  for (const [pattern, action] of [[/invite/, "invite-teammate"], [/charge|checkout|payment|pay/, "capture-payment"], [/transfer/, "transfer-funds"], [/save|draft/, "save-draft"], [/reset.*password/, "reset-password"]] as const) if (pattern.test(text)) return action;
  return "complete-action";
}

function inferEffect(action: string): string {
  return ({ "invite-teammate": "invite.sent", "capture-payment": "payment.captured", "transfer-funds": "transfer.completed", "save-draft": "draft.saved", "reset-password": "password.reset" } as Record<string, string>)[action] ?? "action.completed";
}

function inferWindows(text: string): RecoveryContract["windows"] {
  const windows: RecoveryContract["windows"] = [];
  const add = (id: string, family: WindowFamily, description: string): void => { if (!windows.some((window) => window.id === id)) windows.push({ id, family, description }); };
  if (/timeout|disconnect|network/.test(text)) add("timeout_after_send", "request", "Acknowledgement is lost after transmission");
  if (/duplicate|twice|double|retry/.test(text)) add("duplicate_submission", "request", "The user or client repeats the action");
  if (/reload|refresh/.test(text)) add("reload_mid_flow", "session", "The page reloads before confirmation");
  if (/offline/.test(text)) add("offline_transition", "session", "Connectivity is lost and restored");
  if (/deploy|feature flag/.test(text)) add("environment_change", "environment", "The environment changes during the flow");
  return windows;
}

const slug = (value: string): string => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
