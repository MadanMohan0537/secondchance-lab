# Product roadmap

SecondChance Lab is being developed as a recovery-verification platform, not a collection of disconnected demos. Features are grouped around stable ports so browser, API, queue, mobile, and agent runners can share the same contract and verifier.

## Milestone 1: contract authoring and trust

- Natural-language draft generation with explicit clarification questions
- Contract inheritance and composition
- Deterministic linter and safe fixes
- Semantic contract diffing
- Interruption permutation fuzzing
- Recovery coverage model
- Mutation testing and reusable templates

## Milestone 2: execution surfaces

- Browser and cross-browser runners
- API, webhook, queue, and background-job adapters
- Offline and mobile lifecycle interruptions
- Time-travel snapshots and live state graphs
- Concurrency and load testing

## Milestone 3: evidence and collaboration

- Orphaned-state detection and outcome certainty
- SLOs, score diffs, environment diffs, and regression bisect
- Shareable replays, pull-request gates, postmortems, and digests
- Feature-flag, mock-provider, observability, and editor integrations

## Milestone 4: advanced verification

- Multi-actor and agent tool-call contracts
- State-machine import and formal-method exports
- Pattern mining and risk-weighted recovery debt
- Registry, benchmark, deploy gates, and Recovery API

Every milestone requires executable behavior, automated tests, documentation, and a reproducible example. A roadmap entry is not represented as implemented until those conditions are met.
