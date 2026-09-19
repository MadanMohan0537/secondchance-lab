# Recovery Contract v1 reference

## Required fields

| Field | Meaning |
|---|---|
| `version` | Contract schema version; currently `1` |
| `name` | Stable flow identifier |
| `action.name` | Human-readable critical action |
| `windows` | One or more independently executed interruption boundaries |
| `invariants.effects` | Allowed counts for durable side effects |
| `failureBudget` | CI thresholds for safety, recovery, and certainty |

## Window families

- `request`: boundaries between intent, transmission, commit, acknowledgement, and retry.
- `session`: browser or authentication lifecycle events.
- `environment`: deployment, flag, dependency, or queue changes. The schema accepts this family so contracts can evolve, but the core does not itself inject infrastructure faults.

Each window requires a unique `id`. Adapters decide which precise boundary an ID represents and call `context.interrupt(id)` when that point is reached. The runner gives every window a clean run identifier.

## Effect invariants

Use one count form per effect:

```yaml
- effect: charge.succeeded
  exactly: 1

- effect: receipt.sent
  min: 0
  max: 1
```

Only effects with `status: succeeded` count. A matching `reversed` effect with the same type and external ID removes that durable effect from the final count.

## State assertions

Paths begin with `backend` or `visible` and use dot notation. Operators are `equals`, `not_equals`, `exists`, and `not_exists`.

State assertions communicate disagreement between the interface and system of record. They do not replace effect invariants for exactly-once guarantees.

## Failure budgets

`safetyViolations` is an absolute maximum. `recoverySuccessRate` and `outcomeCertaintyRate` are values from 0 to 1. A contract passes only when all three gates pass.
