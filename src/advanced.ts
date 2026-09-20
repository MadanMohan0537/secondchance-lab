import type { RecoveryContract } from "./types.js";

export interface ActorStep { id: string; actor: string; action: string; dependsOn?: string[]; effect?: string; }
export interface ActorExecution { order: string[]; conflicts: Array<{ effect: string; actors: string[]; steps: string[] }>; }
export function analyzeMultiActorSteps(steps: ActorStep[]): ActorExecution {
  const complete = new Set<string>(); const order: string[] = []; const remaining = new Map(steps.map((step) => [step.id, step]));
  while (remaining.size) { const ready = [...remaining.values()].filter((step) => (step.dependsOn ?? []).every((dependency) => complete.has(dependency))).sort((a, b) => a.id.localeCompare(b.id)); if (!ready.length) throw new Error("Actor graph contains a cycle or missing dependency"); for (const step of ready) { order.push(step.id); complete.add(step.id); remaining.delete(step.id); } }
  const byEffect = new Map<string, ActorStep[]>(); for (const step of steps) if (step.effect) byEffect.set(step.effect, [...(byEffect.get(step.effect) ?? []), step]);
  const conflicts = [...byEffect.entries()].filter(([, group]) => new Set(group.map((step) => step.actor)).size > 1).map(([effect, group]) => ({ effect, actors: [...new Set(group.map((step) => step.actor))], steps: group.map((step) => step.id) }));
  return { order, conflicts };
}

export interface AgentToolIntent { intentId: string; tool: string; argumentsDigest: string; authorized: boolean; maxExecutions: number; }
export interface AgentToolReceipt { intentId: string; tool: string; executionId: string; status: "attempted" | "succeeded" | "failed"; }
export function verifyAgentToolExecution(intent: AgentToolIntent, receipts: AgentToolReceipt[]): { passed: boolean; violations: string[] } { const matching = receipts.filter((receipt) => receipt.intentId === intent.intentId && receipt.tool === intent.tool); const succeeded = matching.filter((receipt) => receipt.status === "succeeded"); const violations: string[] = []; if (!intent.authorized && matching.length) violations.push("Tool executed without authorization."); if (succeeded.length > intent.maxExecutions) violations.push(`Tool succeeded ${succeeded.length} times; maximum is ${intent.maxExecutions}.`); if (new Set(matching.map((receipt) => receipt.executionId)).size !== matching.length) violations.push("Duplicate execution receipt detected."); return { passed: violations.length === 0, violations }; }

export interface StateMachineDefinition { id: string; initial: string; states: Record<string, { on?: Record<string, string> }>; }
export function contractsFromStateMachine(machine: StateMachineDefinition): RecoveryContract[] { const contracts: RecoveryContract[] = []; for (const [state, definition] of Object.entries(machine.states)) for (const [event, target] of Object.entries(definition.on ?? {})) contracts.push({ version: 1, name: `${machine.id}-${state}-${event}`.toLowerCase(), description: `Recover transition ${state} --${event}--> ${target}`, action: { name: event.toLowerCase(), idempotencyKey: "${transition.intentId}" }, windows: [{ id: "before_transition_commit", family: "request" }, { id: "after_transition_commit", family: "request" }, { id: "session_resume", family: "session" }], invariants: { effects: [{ effect: `${machine.id}.transition.${event}`, exactly: 1 }], state: [{ path: "backend.state", operator: "equals", value: target }] }, failureBudget: { safetyViolations: 0, recoverySuccessRate: 1, outcomeCertaintyRate: 1 } }); return contracts; }

export function contractToTla(contract: RecoveryContract): string { const moduleName = contract.name.replace(/[^a-zA-Z0-9]/g, "_"); const windows = contract.windows.map((window) => `"${window.id}"`).join(", "); const effects = contract.invariants.effects.map((effect) => `/\\ effects["${effect.effect}"] ${effect.exactly !== undefined ? `= ${effect.exactly}` : `>= ${effect.min ?? 0}`}`).join("\n    "); return [`---- MODULE ${moduleName} ----`, "EXTENDS Naturals, Sequences", `Windows == {${windows}}`, "VARIABLES step, effects", "Init == /\\ step = 0 /\\ effects = [e \in {} |-> 0]", "Next == step' = step + 1", `Safety == ${effects || "TRUE"}`, "Spec == Init /\\ [][Next]_<<step, effects>>", "===="].join("\n"); }

export interface Persona { id: string; retryDelayMs: number; maxRetries: number; readsStatus: boolean; usesAssistiveTechnology?: boolean; }
export const syntheticPersonas: Persona[] = [
  { id: "impatient", retryDelayMs: 100, maxRetries: 3, readsStatus: false },
  { id: "cautious", retryDelayMs: 5000, maxRetries: 1, readsStatus: true },
  { id: "mobile-interrupted", retryDelayMs: 1500, maxRetries: 2, readsStatus: true },
  { id: "screen-reader", retryDelayMs: 3000, maxRetries: 1, readsStatus: true, usesAssistiveTechnology: true }
];
