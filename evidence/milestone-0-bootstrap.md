# Milestone 0 Evidence - Bootstrap Baseline

## Acceptance criteria

- Fresh clone can run install, lint, and unit checks.
- CI enforces required gates and uploads artifacts.
- SQLite integration harness exists for deterministic fixtures.

## Validation evidence

- `bun run lint` passes.
- `bun run unit` passes (`packages/overdo-core/tests/unit/baseline.test.ts`).
- `bun run integration` passes including:
  - `packages/overdo-core/tests/integration/sqlite-harness.test.ts`
  - `packages/overdo-core/tests/integration/resume-proof.test.ts`
  - `packages/overdo-core/tests/integration/spawn-dispatch-proof.test.ts`

## Controlled failure injection

- `packages/overdo-core/tests/integration/sqlite-harness.test.ts` executes invalid SQL against a missing table and asserts expected failure behavior.

## Recovery/resume proof

- `packages/overdo-core/tests/integration/resume-proof.test.ts` persists run state, simulates restart by reloading state, and proves resumed progress is durable.

## Spawn/dispatch proof

- `packages/overdo-core/tests/integration/spawn-dispatch-proof.test.ts` loads fixture graph and claims the next dependency-ready task via worker dispatch.
