# Overdo Phases

## Purpose

This document defines implementation phases and the required self-validation loop for each phase.

Core requirement: every phase must test itself, spawn its own execution path, and verify results with evidence before phase completion.

## Global Validation Loop (required for every phase)

Each phase uses the same loop and cannot be marked complete unless all steps pass.

1. Define explicit phase contracts.
2. Build the smallest vertical slice for the contract.
3. Run automated validation checks.
4. Inject at least one controlled failure.
5. Verify auto-recovery and resumability.
6. Run a spawn test (scheduler dispatches a subagent or child task for this phase).
7. Verify produced results against acceptance criteria.
8. Record evidence artifacts and close phase.

Required artifacts per phase:

- Test results (unit/integration/e2e as applicable)
- Failure-injection result
- Recovery/resume proof
- Spawn/dispatch proof
- Commit and event-log proof

Global architectural requirement for all phases:

- Every behavior change must flow through MCP contracts.
- Skills must orchestrate by calling MCP, never by mutating DB/state directly.

## Phase 1 - Foundation

Scope:

- Fork baseline shell patterns (CLI and UI ergonomics)
- Implement core schema and task/dependency engine
- Add append-only event log
- Remove hard VCS requirement from lifecycle transitions
- Define and freeze MCP v1 contract in `MCP.md`
- Define initial skills: `overdo-plan`, `overdo-orchestrate`, `overdo-validate`

Validation loop for Phase 1:

1. Contract checks
   - Create/read/update/list tasks and dependencies from SQLite
   - Readiness and blocker logic returns correct next runnable tasks
   - Task lifecycle works without git/jj repository state
   - MCP endpoints enforce transition invariants and idempotency keys
2. Automated checks
   - Schema migration tests
   - Task graph unit tests (including cycle prevention)
   - Event log append/idempotency tests
3. Controlled failure injection
   - Corrupt transition attempt (invalid state change)
   - Duplicate event idempotency replay
4. Recovery/resume
   - Restart service mid-transaction and confirm DB consistency
5. Spawn proof
   - Trigger one synthetic task dispatch from scheduler stub
   - Trigger one synthetic skill call that executes only through MCP
6. Result verification
   - Assertions on task state, dependency state, event sequence

Phase 1 exit criteria:

- All checks pass
- Failure injection handled safely
- Restart shows durable correct state

## Phase 2 - Scheduler and Workers

Scope:

- Implement single-process scheduler
- Add local worker pool
- Add task and path leases
- Add context bundle propagation into subagents
- Implement skill adapters to use MCP as the only execution/state API

Validation loop for Phase 2:

1. Contract checks
   - Workers can claim ready tasks with leases
   - Lease expiry reclaims stale work
   - Context bundle includes dependency outputs and prior attempt history
2. Automated checks
   - Claim/heartbeat/expiry tests
   - Concurrent non-overlapping task execution tests
   - Context propagation tests
3. Controlled failure injection
   - Kill worker during active lease
   - Force overlapping path-lease request
4. Recovery/resume
   - Scheduler recovers orphaned task and requeues correctly
5. Spawn proof
   - One task spawns subagent execution with validated context payload
6. Result verification
   - Correct ownership, no duplicate claims, deterministic rescheduling
   - Skill-driven execution and direct MCP execution produce equivalent persisted state

Phase 2 exit criteria:

- Safe parallel execution for non-overlapping scopes
- Reliable lease recovery from crashes

## Phase 3 - Commit Coordinator

Scope:

- Add global commit lock and queue
- Add non-interactive patch-level staging (`git add -p` semantics)
- Attach commit metadata to tasks/attempts/events
- Add contract parity checks across CLI, UI, and skills

Validation loop for Phase 3:

1. Contract checks
   - Only one commit transaction runs at a time
   - Patch-level staging includes intended hunks only
   - Commit metadata links to task and attempt IDs
2. Automated checks
   - Commit queue ordering tests
   - Lock contention tests
   - Hunk selection and staging correctness tests
3. Controlled failure injection
   - Simulate commit conflict during queue processing
   - Force stale file hash during commit transaction
4. Recovery/resume
   - Commit coordinator resumes pending queue after restart
5. Spawn proof
   - Worker completes task, submits commit manifest, coordinator finalizes commit
6. Result verification
   - Git history contains expected commit boundaries and metadata
   - Same operation from CLI/UI/skill yields identical task and event-log outcomes

Phase 3 exit criteria:

- No concurrent commit corruption
- Deterministic serialized commit behavior

## Phase 4 - Feedback Loops and Never-Give-Up Policies

Scope:

- Enforce per-task feedback loop contracts
- Add retry classes, backoff, escalation, and ticket path
- Add loop run and iteration tracking
- Expose loop operations through MCP and enforce use from skills

Validation loop for Phase 4:

1. Contract checks
   - Task cannot complete until its required loop gates pass
   - Retry classification drives correct next action
   - Hard blockers trigger ticket/escalation flow
2. Automated checks
   - Gate-policy tests (lint/unit/e2e combinations)
   - Retry and backoff tests
   - Loop iteration persistence tests
3. Controlled failure injection
   - Repeated test failures with same fingerprint
   - Forced gate rejection after partial success
4. Recovery/resume
   - Loop resumes at correct iteration after restart
5. Spawn proof
   - Loop controller spawns fix task(s), re-runs gates, and records iteration outcome
6. Result verification
   - Event timeline proves correct loop transitions and escalation behavior

Phase 4 exit criteria:

- Feedback loops are first-class and enforced
- Never-give-up behavior is bounded and observable

## Phase 5 - UI and Planning

Scope:

- Add orchestration and loop observability to UI
- Add plan import (`markdown -> tasks/deps/feedback loops`)
- Ensure every planned task includes feedback loop definition
- Ensure planning and orchestration commands are implemented as skills on MCP

Validation loop for Phase 5:

1. Contract checks
   - UI surfaces worker lanes, locks, retries, and loop status
   - Plan import generates valid tasks/dependencies/loop contracts
2. Automated checks
   - UI state rendering tests for orchestration events
   - Plan parser and validator tests
3. Controlled failure injection
   - Invalid plan input (missing feedback loop definition)
   - UI stale-state simulation during active updates
4. Recovery/resume
   - UI/API reconnect without losing task/loop continuity
5. Spawn proof
   - Imported plan creates executable tasks that scheduler dispatches
6. Result verification
   - Imported task graph executes through at least one full feedback-loop cycle

Phase 5 exit criteria:

- Planning and UI close the build-operate-observe loop
- Invalid plans fail fast with actionable diagnostics

## Ongoing Validation Policy

After Phase 5, all new features must include:

- Feature-level contract tests
- One intentional failure scenario
- One resumability scenario
- One spawn/dispatch verification
- Event-log and commit-trail evidence

No feature is complete without this loop.
