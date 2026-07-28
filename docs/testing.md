# Testing

The test stack has four layers:

- `bun run test:unit` — fast domain, contract, policy, and UI regression tests.
- `bun run test:component` — React components in jsdom with Testing Library.
- `bun run test:integration` — serial PostgreSQL tests against `DATABASE_URL_TEST`.
- `bun run test:e2e` — PostgreSQL reset/seed, production Next.js build, Playwright API tests, and Chromium UI tests.

`bun run test:e2e:full` adds Firefox, WebKit, and a mobile Chromium viewport. CI runs Chromium on pull requests and the full browser matrix nightly.

## Database safety

Database tests refuse to run unless the target database name contains `test`. The integration setup also refuses an explicit `DATABASE_URL_TEST` equal to `DATABASE_URL`.

For local E2E, `scripts/run-e2e.ts` uses `DATABASE_URL_TEST` when provided. Otherwise it derives and creates a sibling `<database>_test` database from the local `DATABASE_URL`. Only that test database is dropped, migrated, and seeded.

The deterministic seed includes administrator, read-only, and write roles for roster, groups, and tasks. Authentication state files and Playwright reports are ignored by Git.

## Coverage

`bun run test:coverage` covers unit and component projects. The checked thresholds are a ratchet at the current repository baseline: 13% statements, lines, and functions; 12% branches. Raise them as coverage grows.

## Useful commands

```powershell
bun run lint
bun run typecheck
bun run test:coverage
bun run test:integration
bun run test:e2e
bun run test:e2e:full
```

The pull-request gate runs lint, typecheck, coverage, PostgreSQL integration tests, a production build, Playwright API tests, accessibility checks, and Chromium E2E.
