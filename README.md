# SecondChance Lab

**Chaos testing for critical user journeys. Break a flow at the worst moment and prove it still finishes safely and exactly once.**

[![Recovery contracts](https://github.com/MadanMohan0537/secondchance-lab/actions/workflows/ci.yml/badge.svg)](https://github.com/MadanMohan0537/secondchance-lab/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D20-43853d.svg)](package.json)

Most end-to-end tests answer: **Did the happy path finish?** SecondChance Lab asks the harder question:

> The client stopped receiving answers. Did the server act, can a retry repeat the side effect, and does the customer know what happened?

Those **ambiguous outcome windows** create duplicate charges, double invitations, missing orders, orphaned records, and support tickets that begin with “Did it go through?” SecondChance Lab models them as code, sweeps them systematically, records actual side effects, and applies deterministic invariants in CI.

## Why this is different

An AI agent or browser can explore a workflow, but it must never grade its own work. SecondChance Lab separates four responsibilities:

```text
Recovery Contract  →  Interruption Runner  →  Application Adapter
                                                  ↓
CI pass/fail        ←  Deterministic Verifier ← Effect Ledger
```

- **Recovery Contract:** versioned YAML describing the action, permitted side effects, interruption windows, state assertions, and failure budget.
- **Interruption Runner:** executes every selected request or session boundary independently.
- **Effect Ledger:** records the durable truth: charge succeeded, order created, email sent, record reversed.
- **Deterministic Verifier:** counts effects and checks state. Explanations may be generated later; pass/fail is always code.

This repository is the backend-first foundation. It does not claim to simulate production infrastructure, inject faults into a real payment provider, or replace an organization’s security and privacy controls.

## Working MVP

The repository currently provides:

- recovery-contract validation;
- request, session, and environment window families;
- in-memory and append-only JSONL Effect Ledgers;
- deterministic exactly-once, range, and state invariants;
- concurrency-safe interruption sweeps;
- three CI gates: safety violations, recovery success, and outcome certainty;
- Markdown evidence reports with suggested product and engineering fixes;
- a CLI and GitHub Actions workflow;
- vulnerable and corrected checkout simulators demonstrating the difference between blind retry and stable idempotency.

## Quick start

```bash
npm install
npm run check
```

Run the deliberately vulnerable checkout:

```bash
npm run demo
```

The command exits with failure and writes `.secondchance/report.md`. It discovers that a lost acknowledgement can produce two successful charges and that a refresh can leave the UI uncertain even though the backend says `paid`.

Prove the corrected implementation:

```bash
npm run dev -- run examples/checkout.recovery.yml \
  --adapter resilient \
  --out .secondchance/resilient-report.md
```

### Author recovery contracts

Turn workflow intent into reviewable contract-as-code, then test whether the contract itself is strong enough to trust:

```bash
npm run dev -- generate "User invites a teammate; invite sends exactly once; form survives reload" --out examples/invite.recovery.yml
npm run dev -- lint examples/invite.recovery.yml --fix
npm run dev -- compose examples/base.recovery.yml examples/email.recovery.yml --out examples/combined.recovery.yml
npm run dev -- diff examples/base.recovery.yml examples/combined.recovery.yml
npm run dev -- fuzz examples/checkout.recovery.yml --limit 50
npm run dev -- coverage examples/checkout.recovery.yml
```

`generate` returns clarification questions when prose does not specify cardinality, interruption points, or authoritative backend evidence. It does not silently invent those guarantees.

## Recovery Contract

```yaml
version: 1
name: checkout-exactly-once

action:
  name: submit-payment
  idempotencyKey: checkout-session-id

windows:
  - id: after_send_before_ack
    family: request
  - id: after_commit_before_response
    family: request
  - id: refresh_during_processing
    family: session

invariants:
  effects:
    - effect: charge.succeeded
      exactly: 1
    - effect: order.created
      exactly: 1
  state:
    - path: visible.paymentStatus
      operator: equals
      value: paid

failureBudget:
  safetyViolations: 0
  recoverySuccessRate: 1
  outcomeCertaintyRate: 1
```

The contract lives beside application code, receives normal pull-request review, and defines what the flow must tolerate. See the complete [checkout contract](examples/checkout.recovery.yml) and [contract reference](docs/contracts.md).

## Interruption model

SecondChance Lab teaches three families instead of presenting a flat catalogue of faults:

| Family | Initial boundaries | What it reveals |
|---|---|---|
| Request lifecycle | duplicate click, after send/before acknowledgement, after commit/before response | duplicate or missing side effects |
| Session lifecycle | refresh, back navigation, expiration, close/reopen | lost work and uncertain outcomes |
| Environment lifecycle | deploy, feature-flag transition, dependency degradation | cross-version and infrastructure failures; planned, not yet injected by the MVP |

The first two families are the current product wedge. Environment lifecycle testing belongs in a later infrastructure adapter.

## Effect Ledger

Every durable side effect uses a normalized record:

```json
{
  "runId": "run-123",
  "attemptId": "attempt-2",
  "type": "charge.succeeded",
  "status": "succeeded",
  "externalId": "ch_123",
  "idempotencyKey": "checkout-42",
  "occurredAt": "2026-09-19T14:21:06.000Z"
}
```

The ledger is intentionally a small port. Future adapters can consume payment webhooks, database change records, queues, OpenTelemetry spans, or AI-agent tool calls without changing verification semantics.

## Build a real adapter

Implement `ScenarioAdapter` from [`src/types.ts`](src/types.ts). The adapter operates the system under test and returns the visible and backend states. Whenever the application produces a durable effect, append it to the supplied ledger.

```ts
const checkout: ScenarioAdapter = {
  name: "staging-checkout",
  async run(context) {
    // Drive a staging API or Playwright page.
    // Record provider/DB effects through context.ledger.
    // Call context.interrupt("after_send_before_ack") at supported boundaries.
    return {
      recovered: true,
      outcomeCertain: true,
      state: {
        backend: { paymentStatus: "paid" },
        visible: { paymentStatus: "paid" }
      }
    };
  }
};
```

The example adapter is a deterministic simulator, not a Stripe integration. A production adapter should use test accounts, least-privilege read access, isolated data, and deterministic teardown.

## Report contract

Every run reports only three headline metrics:

- **Safety violations:** hard failures such as duplicate charges or inconsistent records.
- **Recovery success rate:** interrupted tasks that reach their intended outcome.
- **Outcome certainty rate:** scenarios where the user-visible state communicates the system-of-record result.

Detailed traces and evidence IDs remain available for diagnosis without being compressed into an opaque score.

## Roadmap grounded in validation

1. Publish the contract and ledger packages independently.
2. Add an HTTP proxy capable of precise request-boundary interruption.
3. Add a Playwright adapter for duplicate submission, refresh, and back navigation.
4. Add Stripe test-mode and webhook-ledger adapters.
5. Audit open-source checkout and invitation flows and submit reproducible upstream issues.
6. Validate the same architecture for ambiguous AI-agent tool calls.

Production fault injection, autonomous remediation, certification, and a runtime Recovery Copilot are deliberately outside the current roadmap.

## Security boundary

- Use staging or disposable test environments.
- Do not place credentials, payment data, PII, or raw production payloads in contracts or ledgers.
- Prefer read-only verification adapters.
- Redact adapter metadata before persisting evidence.
- Treat generated repair suggestions as reviewable tickets, never automatic production changes.

See [SECURITY.md](SECURITY.md) for reporting and deployment guidance.

## Project status

This is an early, executable research and product prototype. The contract schema and TypeScript API may change before `1.0`. The current demo proves the architecture locally; real provider and browser adapters require design-partner validation.

## License

Apache License 2.0.
