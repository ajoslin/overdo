# Milestone 5 Evidence - UI Observability and Plan Import

## Contract

- Markdown plans can be imported into executable task definitions.
- UI observability snapshot reflects workers, leases, locks, and queued commits.

## Validation

- Unit: `tests/unit/markdown-import.test.ts`
- Integration: `tests/integration/ui-observability.test.ts`

## Failure injection

- Parser throws on markdown without milestone task lines, ensuring fail-fast import behavior.

## End-to-end operability proof

- `BUILD_FROM_ZERO_PLAN.md` is parsed into linked imported tasks with gate contracts.
- Observability snapshot reflects live runtime telemetry from SQLite state.
