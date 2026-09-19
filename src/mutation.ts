import type { RecoveryContract } from "./types.js";

export interface ContractMutation {
  id: string;
  operator: "remove-window" | "disable-window" | "remove-state" | "weaken-effect" | "relax-budget";
  contract: RecoveryContract;
  description: string;
}

export function mutateContract(contract: RecoveryContract): ContractMutation[] {
  const mutations: ContractMutation[] = [];
  for (const window of contract.windows) {
    const removed = structuredClone(contract); removed.windows = removed.windows.filter((item) => item.id !== window.id);
    if (removed.windows.length) mutations.push({ id: `remove-window:${window.id}`, operator: "remove-window", contract: removed, description: `Remove interruption window ${window.id}` });
    const disabled = structuredClone(contract); disabled.windows.find((item) => item.id === window.id)!.enabled = false;
    mutations.push({ id: `disable-window:${window.id}`, operator: "disable-window", contract: disabled, description: `Disable interruption window ${window.id}` });
  }
  for (const assertion of contract.invariants.state ?? []) {
    const mutated = structuredClone(contract); mutated.invariants.state = mutated.invariants.state?.filter((item) => item.path !== assertion.path);
    mutations.push({ id: `remove-state:${assertion.path}`, operator: "remove-state", contract: mutated, description: `Remove state assertion ${assertion.path}` });
  }
  for (const effect of contract.invariants.effects) {
    const mutated = structuredClone(contract); const target = mutated.invariants.effects.find((item) => item.effect === effect.effect)!;
    if (target.exactly !== undefined) { target.max = target.exactly + 1; delete target.exactly; }
    else target.max = (target.max ?? 1) + 1;
    mutations.push({ id: `weaken-effect:${effect.effect}`, operator: "weaken-effect", contract: mutated, description: `Allow an extra ${effect.effect} side effect` });
  }
  const budget = structuredClone(contract); budget.failureBudget.safetyViolations += 1;
  mutations.push({ id: "relax-budget:safety", operator: "relax-budget", contract: budget, description: "Permit one additional safety violation" });
  return mutations;
}

export function mutationScore(mutations: ContractMutation[], detectedIds: Iterable<string>): number {
  if (!mutations.length) return 100;
  const detected = new Set(detectedIds);
  return Math.round(mutations.filter((mutation) => detected.has(mutation.id)).length / mutations.length * 100);
}
