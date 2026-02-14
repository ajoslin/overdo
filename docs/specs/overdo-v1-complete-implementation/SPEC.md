# Overdo v1 Complete Implementation (TypeScript)

## Problem

Overdo currently has a validated vertical slice, but not full product completion against `PRD.md` and
`PHASES.md`. We need a single implementation spec that defines the finished TypeScript product scope,
acceptance criteria, and delivery sequence.

### Why Now?

- The project has momentum and core scaffolding, but completion criteria are not yet normalized.
- Milestone status has mixed confidence due to partial implementations in critical areas.
- A complete target spec enables deterministic execution and prevents scope drift.

## Summary

Ship Overdo v1 as a TypeScript-first orchestration platform with SQLite-backed state, MCP-enforced
transitions, safe local multi-worker execution, feedback-loop enforcement, commit serialization, and an
operator UI that closes the plan -> execute -> validate -> observe loop.

## Goals & Success Metrics

| Metric | Current | Target | How Measured |
|--------|---------|--------|--------------|
| PRD requirement implementation coverage | Partial | 100% of v1 goals implemented | Traceability matrix from PRD goals to code/tests |
| MCP contract completeness | Partial | All v1 endpoints and invariants present | MCP contract tests + invariant test suite |
| Scheduler safety | Partial | Deterministic lease behavior under contention and restart | Concurrency, lease, and recovery tests |
| Commit safety | Partial | Zero concurrent commit corruption in stress tests | Commit lock/queue tests + failure injections |
| Feedback-loop enforcement | Partial | Required gates enforced for all planned tasks | Loop contract tests + orchestrate integration tests |
| UI operability | Partial | Graph/list/kanban + orchestration telemetry usable | UI integration tests + operator scenario checks |
| Resumability | Partial | Durable restart recovery across tasks/loops/leases/queue | Resume tests + event replay verification |

## Non-Goals

- Rust runtime or Rust CLI adoption in this repository.
- Distributed/multi-machine scheduler for v1.
- Mandatory worktree-per-worker execution.
- Full PM-suite replacement beyond orchestration and validation loops.

## Scope & Phasing

### Phase 1 - Contract and Storage Foundation

Deliverables:

1. Finalize v1 SQLite schema with constraints, indexes, and migration/versioning.
2. Implement durable event log with correlation and idempotency guarantees.
3. Harden task/dependency semantics (finite lifecycle, blocker graph checks, cycle prevention).
4. Publish MCP v1 contract doc and TypeScript types as source of truth.

Done when:

- Schema migrations are deterministic and reversible.
- Contract tests validate lifecycle and invariant enforcement.
- Event idempotency and ordering are proven by tests.

### Phase 2 - Scheduler, Workers, and Lease Safety

Deliverables:

1. Single-process scheduler with dependency-aware selection and deterministic ordering.
2. Local worker pool with bounded concurrency.
3. Task/path lease manager with heartbeat, expiry, reclaim, and CAS conflict checks.
4. Restart recovery that reclaims stale leases and re-queues eligible work.

Done when:

- Non-overlapping tasks execute concurrently without duplicate ownership.
- Crash and restart recovers in-flight work safely.
- Path conflict tests prove write safety.

### Phase 3 - Commit Coordinator and Audit Trail

Deliverables:

1. Global commit lock + queue with deterministic ordering.
2. Patch-level staging protocol (non-interactive, explicit manifest).
3. Commit transaction records linked to tasks/attempts/events.
4. Conflict and stale-base handling with rollback-safe behavior.

Done when:

- Stress tests show serialized commit behavior with no corruption.
- Commit trail can reconstruct why and when each commit happened.

### Phase 4 - Feedback Loop Engine and Policies

Deliverables:

1. Per-task loop contracts (gates, retries, escalation triggers, pass criteria).
2. Durable loop runs + loop iterations with deterministic artifact schema.
3. Never-give-up strategy with bounded escalation policies.
4. Failure playbooks (flake handling, external blocker classification).

Done when:

- Tasks cannot complete if required gates fail.
- Loop switching and escalation behavior is observable and testable.
- Iteration artifacts are queryable and replayable.

### Phase 5 - Planning, Skills, and Operator UI

Deliverables:

1. `overdo-plan` imports markdown into tasks/deps/loop contracts with validation.
2. `overdo-orchestrate` executes through MCP only, with policy loops and evidence capture.
3. `overdo-validate` emits deterministic artifact bundles.
4. UI ships graph/list/kanban plus worker/lease/lock/retry/gate telemetry.

Done when:

- Imported plans execute end to end through at least one full feedback loop.
- UI reflects real-time orchestration state and reconnects safely.

## Constraints

- **TypeScript-only implementation** for core runtime, MCP, orchestration logic, and UI in this repo.
- SQLite is the single source of persisted orchestration state.
- MCP is the single write path for orchestration transitions from skills.
- Use `references/overseer` as architecture template only; do not import Rust runtime assumptions.

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Template overfitting from Overseer | Medium | Medium | Map patterns to PRD requirements before implementation |
| Invariant gaps between modules | Medium | High | Cross-module contract tests and event-trace assertions |
| Queue/lock race conditions | Medium | High | Deterministic ordering rules + contention failure injection |
| Feedback loops producing noisy artifacts | Medium | Medium | Strict artifact schema and deterministic repro format |
| UI parity slips behind backend work | High | Medium | Define UI MVP exits per phase and test against telemetry contracts |

## Dependencies

- Product docs: `PRD.md`, `PHASES.md`, `BUILD_FROM_ZERO_PLAN.md`
- Current implementation: `src/`, `tests/`, `evidence/`
- Template references: `references/overseer/docs/ARCHITECTURE.md`, `references/overseer/docs/MCP.md`, `references/overseer/docs/CLI.md`

## Integration Touchpoints

- Foundation: `src/foundation/schema.ts`, `src/foundation/task-graph.ts`, `src/foundation/event-log.ts`
- MCP: `src/mcp/v1.ts`, `src/mcp/index.ts`
- Runtime: `src/runtime/scheduler.ts`, `src/runtime/leases.ts`, `src/workers/index.ts`
- Commits: `src/commits/coordinator.ts`
- Validation loops: `src/validation/loop-engine.ts`
- Planning/UI: `src/planning/markdown-import.ts`, `src/ui/observability.ts`
- Tests and evidence: `tests/unit/*`, `tests/integration/*`, `evidence/*`

## Demo Path

1. Import an implementation plan with `overdo-plan` into executable tasks.
2. Run scheduler/workers to dispatch and execute ready tasks.
3. Enforce feedback-loop gates and iterate failures to green.
4. Submit commit manifests through commit queue and finalize serialized commits.
5. Inspect event log and UI telemetry to verify end-to-end traceability.

## Decision & Trade-offs

Decision: implement Overdo v1 as a TypeScript-native product, borrowing Overseer architecture patterns where
they improve safety and operability, while strictly optimizing for the PRD scope.

Trade-offs:

- Faster delivery in current stack vs potential low-level performance of Rust.
- More translation work from template patterns vs direct code reuse.
- Strong product focus on PRD scope vs cloning all template capabilities.

## Open Questions

| Question | Owner | Status |
|----------|-------|--------|
| Should v1 UI include full interactive DAG editing or read-only orchestration observability? | Product | Open |
| Should patch-level staging support file-level fallback for edge cases in v1? | Engineering | Open |
| Should ticket escalation integration be pluggable in v1 or hardcoded to one provider? | Product + Engineering | Open |

## Context

### Patterns to Follow

- Codemode-style MCP execution and typed API ergonomics.
- Explicit invariants for lifecycle transitions and dependency safety.
- Event-first auditability and restart-resume correctness.
- Deterministic feedback loops with bounded escalation.

### Key Files

- Product docs: `PRD.md`, `PHASES.md`
- Current status spec: `docs/specs/overdo-gap-audit/SPEC.md`
- This implementation spec: `docs/specs/overdo-v1-complete-implementation/SPEC.md`
- Template docs: `references/overseer/docs/ARCHITECTURE.md`, `references/overseer/docs/MCP.md`, `references/overseer/docs/CLI.md`
