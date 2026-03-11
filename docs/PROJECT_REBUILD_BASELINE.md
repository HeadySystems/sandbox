# Project Rebuild Baseline

This repository now includes deterministic rebuild packaging for the current Git state.

## Goals

- Keep environment-aware CORS defaults secure for production.
- Validate shared config behavior with native Node.js tests.
- Produce a reproducible ZIP artifact for handoff/deployment review.

## Commands

- Run shared config regression checks:

```bash
npm run test:shared-config
```

- Produce a ZIP archive of the repository at `HEAD`:

```bash
npm run rebuild:zip
```

The zip file is generated in `dist/` and includes the short commit hash and an ISO timestamp in the filename.
