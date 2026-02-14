# Overdo v1 Complete Implementation (TypeScript)

## Problem

Overdo has core slices implemented, but v1 completion needs a single implementation spec with strict exits.

## Summary

Ship a TypeScript-first Overdo v1 with SQLite durability, MCP-enforced invariants, safe worker orchestration,
feedback loops, serialized commit coordination, and operator observability.

## Goals & Success Metrics

| Metric | Target | Measure |
|---|---|---|
| PRD v1 coverage | 100% | PRD->code/test traceability |
| MCP contract completeness | 100% planned v1 surface | contract tests |
| Orchestration safety | deterministic under contention | scheduler/lease tests |
| Commit safety | serialized writes, no corruption | lock/queue tests |
| Feedback loop enforcement | required gates must pass | loop tests + integration |
| UI operability | graph/list/kanban + telemetry | UI integration tests |

## Non-Goals

- Rust implementation in this repo.
- Distributed scheduler in v1.
- Mandatory worktree-per-worker.

## Scope & Phasing

### Phase 1 - Foundation

1. Finalize schema + migrations + event log semantics.
2. Harden task graph and lifecycle invariants.
3. Freeze MCP v1 contract and TS types.

### Phase 2 - Scheduler and Workers

1. Deterministic scheduler selection and bounded concurrency.
2. Task/path lease claim, heartbeat, expiry reclaim.
3. Recovery/resume after restart.

### Phase 3 - Commit Coordinator

1. Global commit lock and queue.
2. Patch-level staging protocol with audit linkage.
3. Conflict/stale-base handling.

### Phase 4 - Feedback Loops

1. Per-task gate contracts and persistence.
2. Retry/backoff/escalation policies.
3. Deterministic iteration artifacts.

### Phase 5 - Planning, Skills, UI

1. Markdown plan import with loop contract validation.
2. MCP-only skill orchestration/validation flows.
3. UI observability for tasks, workers, locks, retries, gates.

## Constraints

- TypeScript-only code deliverables.
- SQLite as persistent store.
- MCP as mutation boundary.
- Overseer template usage only.

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Invariant regressions | cross-surface contract tests |
| Race conditions | contention + failure injection tests |
| UI lagging backend | explicit UI acceptance criteria per phase |

## Dependencies

- `PRD.md`
- `PHASES.md`
- `docs/specs/overdo-gap-audit/SPEC.md`
- `references/overseer/docs/ARCHITECTURE.md`
- `references/overseer/docs/MCP.md`
- `references/overseer/docs/CLI.md`

## Integration Touchpoints

- `src/foundation/*`, `src/mcp/*`, `src/runtime/*`, `src/commits/*`, `src/validation/*`, `src/planning/*`, `src/ui/*`

## Demo Path

1. Import plan into tasks.
2. Orchestrate tasks with scheduler/workers.
3. Run loop gates to completion.
4. Serialize commits through coordinator.
5. Verify telemetry + event trails.

## Decision & Trade-offs

Implement in TypeScript for stack consistency and velocity; adopt Overseer patterns where they improve safety.

## Open Questions

| Question | Owner | Status |
|---|---|---|
| UI v1 read-only vs interactive editing | Product | Open |
| Patch-level staging fallback behavior | Engineering | Open |

## Execution Handoff

Use `docs/specs/overdo-v1-closure-plan/PLAN.md` as the active closure sequence for implementation.
