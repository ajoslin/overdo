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

1. Inventory implementation surfaces (`src/`, `tests/`, `evidence/`).
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

- `src/foundation/*`
- `src/mcp/*`
- `src/runtime/*`
- `src/commits/*`
- `src/validation/*`
- `src/planning/*`
- `src/ui/*`

## Demo Path

1. `npm test`
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
| TS baseline and CI | Done | `package.json`, `.github/workflows/ci.yml`, `npm test`, `npm run build` | Lint currently includes reference repo and fails |
| Foundation schema breadth | Partial | `src/foundation/schema.ts`, `tests/integration/sqlite-harness.test.ts` | Add richer constraints/indexes/versioning and missing entities from PRD intent |
| Task graph invariants | Partial | `src/foundation/task-graph.ts`, `tests/unit/foundation-task-graph.test.ts` | Expand lifecycle states, ancestor/effective blocker semantics, stronger cycle and transition guards |
| Event log durability/idempotency | Partial | `src/foundation/event-log.ts`, `tests/integration/mcp-v1-contract.test.ts` | Add correlation/source/task-scope query features and replay ergonomics |
| MCP v1 contract surface | Partial | `src/mcp/v1.ts`, `src/mcp/index.ts` | Expand to planned `loops/*`, `locks/*`, `workers/*`, `commits/*`, `events/*` semantics |
| Scheduler + leases + reclaim | Partial | `src/runtime/scheduler.ts`, `src/runtime/leases.ts`, `tests/integration/scheduler-leases.test.ts` | Add deterministic ordering/CAS and broader contention/resume scenarios |
| Commit coordinator safety | Partial | `src/commits/coordinator.ts`, `tests/integration/commit-coordinator.test.ts` | Implement patch-manifest staging and stale-base conflict handling |
| Feedback-loop policy engine | Partial | `src/validation/loop-engine.ts`, `tests/unit/loop-engine.test.ts` | Persist loop runs/iterations and richer rescope/switch/escalation policies |
| Plan import fidelity | Partial | `src/planning/markdown-import.ts`, `tests/unit/markdown-import.test.ts` | Support full dependency/loop contract import and richer validation diagnostics |
| Operator UI parity | Partial | `src/ui/observability.ts`, `tests/integration/ui-observability.test.ts` | Build full graph/list/kanban and live orchestration telemetry UX |

## Immediate Corrective Notes

1. `npm run lint` fails due `references/overseer/**` being included in lint scope.
2. Completion state in Overseer tasks should be treated as orchestration bookkeeping, not product completeness, until the above gaps are closed.
