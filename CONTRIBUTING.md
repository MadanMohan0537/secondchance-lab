# Contributing

Open an issue before a large change. A contribution should include a focused recovery contract, deterministic verifier behavior, tests, and documentation of its trust boundary.

```bash
npm install
npm run check
npm run build
```

Do not submit adapters containing live credentials, production endpoints, personal data, or provider secrets. Keep fault injection opt-in and safe for a disposable environment.
