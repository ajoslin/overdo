# Milestone 1 Evidence - Foundation

## Contract

- SQLite schema includes tasks, dependencies, events, attempts, loops, leases, locks, and commit structures.
- Task graph engine enforces readiness, cycle prevention, and lifecycle transitions.
- Event log is append-only with idempotency key uniqueness.
- MCP v1 task contract is implemented as the single transition surface.

## Validation

- Unit: `packages/overdo-core/tests/unit/foundation-task-graph.test.ts`
- Integration: `packages/overdo-core/tests/integration/mcp-v1-contract.test.ts`

## Failure injection

- Invalid lifecycle transition (`done -> running`) is rejected.
- Duplicate event insert with the same `idempotency_key` is rejected by schema constraint.

## Recovery/resume proof

- Existing `packages/overdo-core/tests/integration/resume-proof.test.ts` verifies persisted state survives restart and resumes progress.
