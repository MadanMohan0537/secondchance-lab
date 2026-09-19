import type { FuzzCase, RecoveryContract } from "./types.js";

const faults: FuzzCase["fault"][] = ["timeout", "disconnect", "duplicate", "delay", "restart"];
const timings: FuzzCase["timing"][] = ["before", "during", "after"];

export function fuzzContract(contract: RecoveryContract, limit = Number.POSITIVE_INFINITY): FuzzCase[] {
  const cases: FuzzCase[] = [];
  for (const window of contract.windows.filter((candidate) => candidate.enabled !== false)) {
    for (const fault of faults) for (const timing of timings) {
      cases.push({ id: `${window.id}:${fault}:${timing}`, windowId: window.id, family: window.family, fault, timing });
      if (cases.length >= limit) return cases;
    }
  }
  return cases;
}
