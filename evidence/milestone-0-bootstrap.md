# Milestone 0 Evidence - Bootstrap Baseline

## Acceptance criteria

- Fresh clone can run install, lint, and unit checks.
- CI enforces required gates and uploads artifacts.
- SQLite integration harness exists for deterministic fixtures.

## Validation evidence

- `npm run lint` passes.
- `npm run unit` passes (`tests/unit/baseline.test.ts`).
- `npm run integration` passes including:
  - `tests/integration/sqlite-harness.test.ts`
  - `tests/integration/resume-proof.test.ts`
  - `tests/integration/spawn-dispatch-proof.test.ts`

## Controlled failure injection

- `tests/integration/sqlite-harness.test.ts` executes invalid SQL against a missing table and asserts expected failure behavior.

## Recovery/resume proof

- `tests/integration/resume-proof.test.ts` persists run state, simulates restart by reloading state, and proves resumed progress is durable.

## Spawn/dispatch proof

- `tests/integration/spawn-dispatch-proof.test.ts` loads fixture graph and claims the next dependency-ready task via worker dispatch.
