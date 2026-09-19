# Architecture

The core is intentionally headless. Browser automation, payment providers, and databases are integration adapters around a deterministic verification kernel.

## Trust boundaries

1. An adapter may explore, retry, or use an AI agent.
2. The Effect Ledger accepts normalized observations from approved hooks.
3. The verifier reads the contract, ledger, and declared states.
4. Only the verifier decides pass or fail.
5. Suggested fixes are explanatory output and require human review.

This prevents an explorer from declaring success based on a confirmation screen while a provider or database records a different outcome.

## Current modules

| Module | Responsibility |
|---|---|
| `contract.ts` | Parse and validate versioned YAML contracts |
| `ledger.ts` | In-memory and append-only JSONL effect storage |
| `runner.ts` | Isolated window execution and adapter orchestration |
| `verifier.ts` | Deterministic invariants and failure budgets |
| `report.ts` | Human-readable evidence report |
| `demo.ts` | Vulnerable and resilient reference flows |

## Extension ports

- `ScenarioAdapter` for APIs, Playwright, agent tools, or other explorers.
- `EffectLedgerPort` for webhooks, database CDC, queues, traces, or hosted storage.

Adapters should be least privilege and environment-specific. The core deliberately has no direct database, browser, or provider credential handling.
