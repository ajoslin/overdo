# Overdo Gap Audit

## Problem

Current implementation has validated slices but incomplete parity with `PRD.md` and `PHASES.md`.

## Summary

Create an evidence-based done/partial/missing audit mapped to PRD and phases, using `references/overseer`
as architecture inspiration while staying TypeScript-only.

## Goals & Success Metrics

| Metric | Target |
|---|---|
| Requirement scoring coverage | 100% of PRD/PHASES items scored |
| Evidence linkage | Every scored item links to code/tests/artifacts |
| Closure backlog | Ordered by dependency and risk |

## Non-Goals

- Literal Rust fork parity.
- Features outside PRD v1 scope.

## Scope & Phasing

### Phase 1

1. Inventory implementation surfaces (`packages/overdo-core/src/`, `packages/*/tests/`, `evidence/`).
2. Build requirement map from `PRD.md` + `PHASES.md`.
3. Score each item: done/partial/missing + confidence + severity.

### Later

1. Convert gaps into ordered implementation backlog.
2. Validate each closure with tests + failure injection + recovery proof.

## Constraints

- TypeScript only.
- SQLite persistence.
- MCP is the single write boundary for orchestration state.

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Overstated completion | Require test/evidence links per item |
| Scope drift | Gate backlog against PRD item IDs |

## Dependencies

- `PRD.md`
- `PHASES.md`
- `BUILD_FROM_ZERO_PLAN.md`
- `references/overseer/docs/ARCHITECTURE.md`
- `references/overseer/docs/MCP.md`
- `references/overseer/docs/CLI.md`

## Integration Touchpoints

- `packages/overdo-core/src/foundation/*`
- `packages/overdo-core/src/mcp/*`
- `packages/overdo-core/src/runtime/*`
- `packages/overdo-core/src/commits/*`
- `packages/overdo-core/src/validation/*`
- `packages/overdo-core/src/planning/*`
- `packages/overdo-core/src/ui/*`

## Demo Path

1. `bun run test`
2. Produce matrix and backlog
3. Validate one critical closure item end-to-end

## Decision & Trade-offs

Use Overseer as a template for patterns only, while converging fully in TypeScript.

## Open Questions

| Question | Owner | Status |
|---|---|---|
| UI parity depth in v1 | Product | Open |
| MCP breadth vs depth first | Product+Eng | Open |

## Strict Audit Results (2026-02-14)

Scoring rubric:

- `Done`: implementation + automated tests + recovery/failure evidence
- `Partial`: implementation exists but contract depth/evidence is incomplete
- `Missing`: no meaningful implementation for PRD intent

| Requirement Area | Status | Evidence | Gaps To Close |
|---|---|---|---|
| TS baseline and CI | Done | `package.json`, `.github/workflows/ci.yml`, `bun run test`, `bun run build`, `bun run lint` | None |
| Foundation schema breadth | Done | `packages/overdo-core/src/foundation/schema.ts`, `packages/overdo-core/tests/integration/sqlite-harness.test.ts` | None |
| Task graph invariants | Done | `packages/overdo-core/src/foundation/task-graph.ts`, `packages/overdo-core/tests/unit/foundation-task-graph.test.ts` | None |
| Event log durability/idempotency | Done | `packages/overdo-core/src/foundation/event-log.ts`, `packages/overdo-core/tests/unit/event-log.test.ts`, `packages/overdo-core/tests/integration/mcp-v1-contract.test.ts` | None |
| MCP v1 contract surface | Done | `packages/overdo-core/src/mcp/v1.ts`, `packages/overdo-core/tests/integration/mcp-v1-contract.test.ts`, `packages/overdo-core/tests/e2e/full-orchestrate.e2e.test.ts` | None |
| Scheduler + leases + reclaim | Done | `packages/overdo-core/src/runtime/scheduler.ts`, `packages/overdo-core/src/runtime/leases.ts`, `packages/overdo-core/tests/integration/scheduler-leases.test.ts` | None |
| Commit coordinator safety | Done | `packages/overdo-core/src/commits/coordinator.ts`, `packages/overdo-core/tests/integration/commit-coordinator.test.ts` | None |
| Feedback-loop policy engine | Done | `packages/overdo-core/src/validation/loop-engine.ts`, `packages/overdo-core/tests/unit/loop-engine.test.ts`, `packages/overdo-core/tests/e2e/full-orchestrate.e2e.test.ts` | None |
| Plan import fidelity | Done | `packages/overdo-core/src/planning/markdown-import.ts`, `packages/overdo-core/tests/unit/markdown-import.test.ts` | None |
| Operator UI parity | Done | `packages/overdo-core/src/ui/observability.ts`, `packages/overdo-core/tests/integration/ui-observability.test.ts` | None |

## Immediate Corrective Notes

1. Closure implementation evidence captured in `evidence/v1-closure-implementation-2026-02-14.md`.
