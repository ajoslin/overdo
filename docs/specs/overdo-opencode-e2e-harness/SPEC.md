# Overdo OpenCode Multi-Process E2E Harness

## Problem

Current tests validate in-process orchestration behavior, but do not prove production-style resilience when one or
more OpenCode worker processes execute tasks concurrently, fail, crash, and resume against shared SQLite state.

### Why Now?

- Overdo aims to be restart-safe and contention-safe under local multi-worker execution.
- In-process e2e coverage cannot prove process-boundary failure modes.
- We need reproducible evidence for crash-resume correctness and feedback-loop persistence.

## Summary

Build a deterministic multi-process e2e harness that spawns one or more OpenCode worker processes using a cheap model,
injects realistic failure modes, and asserts invariant-safe recovery across scheduler, leases, loops, events,
commit coordination, and persisted SQLite state.

Execution policy:

- PR/CI path uses deterministic stubbed model responses as the blocking pass/fail signal.
- Optional local/nightly path can run live cheap-model smoke checks and is non-blocking.

## Goals & Success Metrics
| Metric | Current | Target | How Measured |
|--------|---------|--------|--------------|
| Multi-process orchestration coverage | None | 1, 2, and 3+ worker process scenarios | `packages/overdo-cli/tests/e2e/process/*.test.ts` |
| Crash-resume correctness | Partial (simulated) | Real process kill + restart resume | Durable state assertions from SQLite |
| Feedback-loop behavior under retries/rejects | Partial | Deterministic retry/escalation/review loops | Loop iteration/evidence assertions |
| Commit lock safety under contention | Partial | No concurrent commit corruption | Concurrent commit worker tests |
| End-to-end confidence artifact | Low | Repeatable evidence bundle per run | `artifacts/e2e/` logs + summary JSON |

## Non-Goals

- Cloud/distributed orchestration across machines.
- UI visual regression testing.
- Long-running infinite retries without escalation controls.

## Scope & Phasing
### Phase 1

1. Build process harness utility:
   - Spawn OpenCode worker processes (1..N)
   - Configure cheap model and deterministic env
   - Capture stdout/stderr/events
   - Kill/restart workers under test control
2. Add SQLite assertion helpers for:
   - task statuses
   - leases
   - loop runs/iterations
   - commit queue/transactions
   - event replay continuity
3. Add first e2e scenarios:
   - single-worker happy path through loop + commit
   - two-worker contention scenario
   - one deterministic crash-resume checkpoint scenario

### Later

1. Add full crash-resume matrix (all checkpoints below).
2. Add review-reject loop scenario (failed validation, reject, retry, pass).
3. Add escalation scenario (bounded retry exhausted).
4. Add chaos matrix suite with mixed failures and resume points.

## Crash Injection Matrix (Required)

Each checkpoint must be tested with forced process kill and resume assertions:

1. After lease claim and before task transition to `running`.
2. After `loop.start` and before first loop iteration write.
3. After failed loop iteration write and before retry scheduling.
4. After commit enqueue and before commit worker lock claim.
5. While commit lock is held during commit processing.

For each checkpoint, verify:

- Work is resumable without manual DB edits.
- No duplicate terminal transitions.
- No duplicate commit completion rows.
- Event replay remains monotonic and semantically idempotent.

## Test Checkpoint Hook Contract

To make crash checkpoints deterministic, runtime paths must emit named test barriers in e2e mode.

- Barrier API shape: `emitCheckpoint(name: string, context: object)`.
- Harness contract: wait for checkpoint, confirm persisted preconditions, then kill process.
- Required checkpoint names:
  - `lease-claimed-before-running`
  - `loop-started-before-iteration`
  - `loop-failed-before-retry-schedule`
  - `commit-enqueued-before-lock`
  - `commit-lock-held`
- In non-e2e runtime mode, checkpoint emission is disabled.

## Constraints

- TypeScript only.
- Use local SQLite in temp workspace per test.
- Tests must be deterministic and bounded in runtime.
- Use cheap model configuration (default test model + low token limits).
- No reliance on external network APIs for pass/fail semantics.
- CI assertions must pass with stubbed model outputs only.
- Lease TTL must be configurable in e2e mode (`250ms` to `1000ms`) to keep tests bounded.

## Invariant Assertions (Must Hold)

- **Lease safety:** dual ownership is never observed for the same task/path.
- **Lease recovery:** crashed worker lease blocks redispatch until TTL, then exactly one successor worker claims the task.
- **Commit lock safety:** at most one lock owner at any instant.
- **Commit processing:** exactly-once completion per task queue item, no duplicate commit transaction rows after restart.
- **Event/idempotency safety:** replay is monotonic and restart does not create semantic duplicates for iterations/transitions.
- **Loop durability:** iteration history for a run remains ordered and resumable after crashes.

## Risks & Mitigations
| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Flaky timing in process tests | High | High | Deterministic polling windows + explicit state barriers |
| Zombie worker processes | Medium | High | Process supervisor with guaranteed teardown and timeout kill |
| Non-deterministic model output | Medium | Medium | Test prompts with strict expected outputs and fallback stubs |
| SQLite lock contention false positives | Medium | Medium | Distinguish expected busy-retry from invariant failures |

## Dependencies

- `packages/overdo-core/src/mcp/v1.ts`
- `packages/overdo-core/src/runtime/scheduler.ts`
- `packages/overdo-core/src/runtime/leases.ts`
- `packages/overdo-core/src/validation/loop-engine.ts`
- `packages/overdo-core/src/commits/coordinator.ts`
- `packages/overdo-core/tests/helpers/db.ts`
- Node child-process harness utilities

## Integration Touchpoints

- New harness utilities under `packages/overdo-cli/tests/e2e/helpers/`.
- New process scenarios under `packages/overdo-cli/tests/e2e/process/`.
- Potential package scripts:
  - `e2e:process`
  - `e2e:process:chaos`
- Evidence output under `artifacts/e2e/`.

## Timing and Barrier Policy

- Poll interval: `100ms`.
- Barrier timeout (single wait): `10s`.
- Per-test timeout: `90s`.
- Process-suite timeout: `8m`.
- Barrier miss behavior: fail fast, dump timeline + DB snapshot, and terminate remaining child processes.

## Artifact Contract

Each process e2e test must emit:

- `process-stdout.log`
- `process-stderr.log`
- `timeline.json`
- `assertions.json`
- `db-dump.json` (or equivalent reproducible structured state dump)

Artifact directory must be unique per run:

- `artifacts/e2e/<scenario>/<seed>/<runId>/...`

`assertions.json` required fields:

- `scenario`
- `seed`
- `runId`
- `crashCheckpoint` (or `none`)
- `timings`
- `invariants`
- `result`

## Demo Path

1. Start one worker process with cheap model.
2. Execute task with validation loop requiring two attempts.
3. Confirm persisted loop iterations and final completion.
4. Re-run with two workers and forced contention.
5. Kill one worker mid-run and restart; verify resume to completion.

## Teardown Contract

After each test:

- No live child PIDs remain.
- SQLite handles are closed.
- Temp workspace is deleted.
- Teardown escalation policy: `SIGTERM` wait `2s`, then `SIGKILL` wait `2s`, then test fails hard.

## Decision & Trade-offs

Choose deterministic process-level harness tests over broad random fuzzing first.

Trade-offs:

- Better reliability and debuggability vs less exploratory bug discovery.
- Slightly slower test runtime vs materially higher confidence in resumability and lock safety.

## Initial Execution Policy

- PR suite runs deterministic process subset (single-worker flow, lease contention, one crash-resume checkpoint).
- Nightly suite runs full crash matrix + chaos combinations.
- CI runtime budget target:
  - PR process subset: <= 5 minutes
  - Nightly full suite: <= 20 minutes

## Context
### Patterns to Follow

- Deterministic state-machine assertions over textual agent output.
- Explicit failure injection and resume checkpoints.
- Evidence-first artifact capture for post-mortem diagnosis.

### Key Files

- `docs/specs/overdo-v1-closure-plan/PLAN.md`
- `docs/specs/overdo-gap-audit/SPEC.md`
- `packages/overdo-core/tests/e2e/full-orchestrate.e2e.test.ts`
- `packages/overdo-core/src/runtime/scheduler.ts`
- `packages/overdo-core/src/validation/loop-engine.ts`
