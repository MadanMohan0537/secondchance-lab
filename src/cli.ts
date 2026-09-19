#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import YAML from "yaml";
import { applySafeFixes, composeContracts, contractCoverage, contractFromNaturalLanguage, diffContracts, fuzzContract, lintContract, loadContract, markdownReport, runRecoveryContract } from "./index.js";
import { resilientCheckout, vulnerableCheckout } from "./demo.js";

async function main(): Promise<void> {
  const [command = "help", ...args] = process.argv.slice(2);
  if (command === "validate") {
    const path = required(args[0], "Usage: secondchance validate <contract.yml>");
    const contract = await loadContract(path); console.log(`Valid recovery contract: ${contract.name} (${contract.windows.length} windows)`); return;
  }
  if (command === "generate") {
    const input = required(args.filter((arg) => !arg.startsWith("--"))[0], "Usage: secondchance generate \"workflow description\" [--out contract.yml]");
    const generated = contractFromNaturalLanguage(input);
    const output = valueAfter(args, "--out");
    const yaml = YAML.stringify(generated.contract);
    if (output) { await mkdir(dirname(output), { recursive: true }); await writeFile(output, yaml); console.log(`Contract: ${output}`); } else console.log(yaml);
    for (const question of generated.questions) console.error(`QUESTION: ${question}`);
    for (const assumption of generated.assumptions) console.error(`ASSUMPTION: ${assumption}`);
    process.exitCode = generated.questions.length ? 1 : 0; return;
  }
  if (command === "lint") {
    const path = required(args[0], "Usage: secondchance lint <contract.yml> [--fix]");
    let contract = await loadContract(path);
    if (args.includes("--fix")) { contract = applySafeFixes(contract); await writeFile(path, YAML.stringify(contract)); }
    const diagnostics = lintContract(contract);
    for (const item of diagnostics) console.log(`${item.severity.toUpperCase()} ${item.rule} ${item.path}: ${item.message}`);
    console.log(`${diagnostics.length} diagnostic(s)`);
    process.exitCode = diagnostics.some((item) => item.severity === "error") ? 1 : 0; return;
  }
  if (command === "diff") {
    const before = await loadContract(required(args[0], "Usage: secondchance diff <before.yml> <after.yml> [--json]"));
    const after = await loadContract(required(args[1], "Usage: secondchance diff <before.yml> <after.yml> [--json]"));
    const changes = diffContracts(before, after);
    if (args.includes("--json")) console.log(JSON.stringify(changes, null, 2)); else for (const change of changes) console.log(`${change.breaking ? "!" : "+"} ${change.kind} ${change.path}`);
    process.exitCode = changes.some((change) => change.breaking) ? 1 : 0; return;
  }
  if (command === "fuzz") {
    const contract = await loadContract(required(args[0], "Usage: secondchance fuzz <contract.yml> [--limit N] [--json]"));
    const cases = fuzzContract(contract, Number(valueAfter(args, "--limit") ?? "100"));
    if (args.includes("--json")) console.log(JSON.stringify(cases, null, 2)); else for (const item of cases) console.log(`${item.id} (${item.family})`);
    console.log(`${cases.length} deterministic permutation(s)`); return;
  }
  if (command === "coverage") {
    const coverage = contractCoverage(await loadContract(required(args[0], "Usage: secondchance coverage <contract.yml> [--json]")));
    if (args.includes("--json")) console.log(JSON.stringify(coverage, null, 2)); else console.log(`Recovery coverage: ${coverage.score}% (${coverage.enabledWindows}/${coverage.totalWindows} windows; missing families: ${coverage.missingFamilies.join(", ") || "none"})`);
    return;
  }
  if (command === "compose") {
    const output = valueAfter(args, "--out");
    const paths = args.filter((arg, index) => arg !== "--out" && args[index - 1] !== "--out");
    if (paths.length < 2) throw new Error("Usage: secondchance compose <base.yml> <extension.yml...> [--out combined.yml]");
    const [base, ...extensions] = await Promise.all(paths.map(loadContract));
    const combined = composeContracts(base!, ...extensions);
    const yaml = YAML.stringify(combined);
    if (output) { await mkdir(dirname(output), { recursive: true }); await writeFile(output, yaml); console.log(`Contract: ${output}`); } else console.log(yaml);
    return;
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
  console.log("SecondChance Lab\n\n  validate <contract.yml>\n  generate \"workflow description\" [--out contract.yml]\n  lint <contract.yml> [--fix]\n  compose <base.yml> <extension.yml...> [--out combined.yml]\n  diff <before.yml> <after.yml> [--json]\n  fuzz <contract.yml> [--limit N] [--json]\n  coverage <contract.yml> [--json]\n  run <contract.yml> [--adapter vulnerable|resilient] [--out report.md]\n  demo");
}

const required = (value: string | undefined, message: string): string => { if (!value) throw new Error(message); return value; };
const valueAfter = (args: string[], flag: string): string | undefined => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : undefined; };
main().catch((error) => { console.error(`secondchance: ${error.message}`); process.exitCode = 2; });
