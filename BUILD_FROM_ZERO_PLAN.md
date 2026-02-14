# Plan: Overdo Build From Zero

## Outcome

Build Overdo from an empty repository into a production-ready v1 system with deterministic
task orchestration, enforced feedback loops, and full resumability.

Done when:

- All phases below are completed with passing validation evidence.
- Every phase includes automated tests, one failure-injection scenario, and one resume proof.
- Every behavior change flows through MCP contracts and is exercised through skills.

## Global Rules (apply to every phase)

- Build in vertical slices from zero to runnable increments.
- Define explicit acceptance criteria before implementation.
- Run required checks before merge: `lint`, `unit`, and phase-required `integration`/`e2e`.
- Inject at least one controlled failure and verify expected recovery.
- Record artifacts: test outputs, failure injection logs, recovery proof, and event/commit traces.
- No direct DB/state mutation from skills; all writes must go through MCP APIs.

## Validation Loop (mandatory per phase)

1. Define phase contract and acceptance criteria.
2. Implement the smallest vertical slice that satisfies part of the contract.
3. Run automated validation checks.
4. Inject one controlled failure mode for this phase.
5. Verify auto-recovery and restart resumability.
6. Run a spawn/dispatch test using scheduler and worker path.
7. Compare outputs against acceptance criteria.
8. Publish evidence artifacts and close the phase.

## Milestone 0: Bootstrap From Empty Repo

Goal: create a clean baseline that can run tests and enforce quality gates from day 1.

Tasks:

1. Initialize repository structure and package layout for MCP, scheduler, workers, and skills.
2. Add local dev environment setup (toolchain, scripts, deterministic config).
3. Stand up CI skeleton with required gates (`lint`, `unit`) and artifact upload.
4. Add testing harness and fixtures for SQLite and orchestration integration tests.

Done when:

- Fresh clone can run install, `lint`, and `unit` successfully.
- CI executes on pull requests and blocks on failed gates.

## Milestone 1: Foundation (Schema, Tasks, Events, MCP Contract)

Goal: durable orchestration core with task/dependency semantics and event sourcing.

Tasks:

1. Implement SQLite schema for tasks, dependencies, attempts, loops, leases, locks, commits, and events.
2. Implement task graph engine (readiness, blockers, cycle prevention).
3. Implement append-only event log with idempotency keys.
4. Freeze MCP v1 contracts for task lifecycle and invariants.
5. Implement initial skills (`overdo-plan`, `overdo-orchestrate`, `overdo-validate`) as MCP-only clients.

Done when:

- Task lifecycle works without requiring git/jj repo cleanliness.
- Event log and idempotency behavior are proven by tests.

## Milestone 2: Scheduler and Local Workers

Goal: safe, deterministic local parallel execution.

Tasks:

1. Implement single-process scheduler with dependency-aware dispatch.
2. Implement worker runtime and bounded concurrency controls.
3. Add task leases and path leases with heartbeat and expiry reclaim.
4. Implement context bundle propagation (task context, dependency outputs, prior attempts).
5. Add conflict handling and deterministic retry scheduling.

Done when:

- Non-overlapping tasks execute concurrently without duplicate claims.
- Crash/restart recovers stale work correctly.

## Milestone 3: Commit Coordinator and Auditability

Goal: serialize mutations to git history safely with traceability.

Tasks:

1. Implement commit queue and global commit lock.
2. Add non-interactive patch-level staging semantics.
3. Attach commit metadata linking task/attempt/event IDs.
4. Add parity tests proving CLI/UI/skill actions yield equivalent persisted state.

Done when:

- No concurrent commit corruption under contention tests.
- Commit and event trails can reconstruct the state transition path.

## Milestone 4: Feedback Loops and Never-Give-Up Policies

Goal: enforce per-task validation loops with bounded escalation behavior.

Tasks:

1. Implement loop definitions, loop runs, and loop iteration persistence.
2. Enforce gate contracts per task (`lint`/`unit`/`integration`/`e2e` as required).
3. Add retry classification, backoff, and escalation/ticket workflows.
4. Implement `overdo-validate` evidence capture pipeline.

Done when:

- Tasks cannot complete unless required gates pass.
- Repeated failures trigger configured escalation with full evidence.

## Milestone 5: UI, Plan Import, and End-to-End Operability

Goal: close the plan -> execute -> validate -> observe loop.

Tasks:

1. Add UI visibility for workers, leases, locks, retries, loops, and gate status.
2. Implement markdown plan import to tasks/dependencies/feedback-loop contracts.
3. Validate imported plans and fail fast on missing loop contracts.
4. Run at least one imported plan through full orchestration and validation cycle.

Done when:

- Imported plan produces executable graph and completes one full feedback loop.
- UI reflects real-time orchestration state with reconnect safety.

## Test Strategy (from zero)

- Unit: task graph logic, lifecycle invariants, idempotency checks, lock ordering.
- Integration: scheduler + workers + leases + loop engine + SQLite.
- End-to-End: skill-driven orchestration including spawn, validation, and commit flow.
- Chaos/failure: worker crash, stale leases, lock contention, invalid transitions, gate failures.
- Contract: MCP endpoint invariants and cross-surface parity checks.

## Evidence and Exit Criteria

For each milestone, publish:

- Test result references (including command outputs and CI run links/ids).
- Failure injection scenario and observed behavior.
- Recovery/resume demonstration after restart.
- Spawn/dispatch proof for at least one child execution.
- Event-log and commit-trace proof tied to task IDs.

Program exits v1 implementation when all milestone criteria are satisfied and evidence is complete.
