# Security policy

## Safe use

SecondChance Lab is designed for staging, sandbox, and disposable test environments. Do not use the example adapters against real payment accounts or production customer data.

- Keep secrets outside recovery contracts and source control.
- Use test accounts and synthetic records.
- Give ledger adapters the minimum read permissions necessary.
- Redact PII, payment details, authorization headers, and provider payloads.
- Bound every fault sweep and provide deterministic cleanup.
- Review every suggested repair before changing an application.

## Reporting vulnerabilities

Open a private security advisory in this repository. Do not include real credentials, customer data, or exploitable production endpoints in a public issue.
