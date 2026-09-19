import type { ContractCoverage, RecoveryContract, WindowFamily } from "./types.js";

export function contractCoverage(contract: RecoveryContract): ContractCoverage {
  const expected: WindowFamily[] = ["request", "session", "environment"];
  const coveredFamilies = expected.filter((family) => contract.windows.some((window) => window.family === family && window.enabled !== false));
  const enabledWindows = contract.windows.filter((window) => window.enabled !== false).length;
  const windowRatio = contract.windows.length ? enabledWindows / contract.windows.length : 0;
  const familyRatio = coveredFamilies.length / expected.length;
  return {
    totalWindows: contract.windows.length,
    enabledWindows,
    coveredFamilies,
    missingFamilies: expected.filter((family) => !coveredFamilies.includes(family)),
    score: Math.round((windowRatio * 0.6 + familyRatio * 0.4) * 100),
    windows: contract.windows.map((window) => ({ id: window.id, family: window.family, status: window.enabled === false ? "disabled" : "covered" }))
  };
}
