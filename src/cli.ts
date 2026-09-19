#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { loadContract, markdownReport, runRecoveryContract } from "./index.js";
import { resilientCheckout, vulnerableCheckout } from "./demo.js";

async function main(): Promise<void> {
  const [command = "help", ...args] = process.argv.slice(2);
  if (command === "validate") {
    const path = required(args[0], "Usage: secondchance validate <contract.yml>");
    const contract = await loadContract(path); console.log(`Valid recovery contract: ${contract.name} (${contract.windows.length} windows)`); return;
  }
  if (command === "demo" || command === "run") {
    const contractPath = command === "demo" ? resolve("examples/checkout.recovery.yml") : required(args[0], "Usage: secondchance run <contract.yml> [--adapter vulnerable|resilient] [--out report.md]");
    const adapterName = valueAfter(args, "--adapter") ?? (command === "demo" ? "vulnerable" : "resilient");
    const output = valueAfter(args, "--out") ?? ".secondchance/report.md";
    const contract = await loadContract(contractPath);
    const report = await runRecoveryContract(contract, adapterName === "vulnerable" ? vulnerableCheckout : resilientCheckout);
    await mkdir(dirname(output), { recursive: true }); await writeFile(output, markdownReport(report));
    console.log(`${report.passed ? "PASS" : "FAIL"} ${contract.name}: ${report.summary.safetyViolations} safety violation(s), ${Math.round(report.summary.recoverySuccessRate * 100)}% recovery, ${Math.round(report.summary.outcomeCertaintyRate * 100)}% certainty`);
    console.log(`Report: ${output}`); process.exitCode = report.passed ? 0 : 1; return;
  }
  console.log("SecondChance Lab\n\n  validate <contract.yml>\n  run <contract.yml> [--adapter vulnerable|resilient] [--out report.md]\n  demo");
}

const required = (value: string | undefined, message: string): string => { if (!value) throw new Error(message); return value; };
const valueAfter = (args: string[], flag: string): string | undefined => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : undefined; };
main().catch((error) => { console.error(`secondchance: ${error.message}`); process.exitCode = 2; });
