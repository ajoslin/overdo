# Overdo PRD

## Product Summary

Overdo is a fork-inspired evolution of Overseer into a DB-native orchestration system with first-class feedback loops, resumability, and safe multi-worker execution in a single shared repo/dev environment.

Reference baseline: https://github.com/dmmulroy/overseer (MIT).

## Problem

- Current flow splits state management (Overseer) and execution logic (custom orchestration skill code).
- Hard VCS coupling blocks progress when the working tree is dirty.
- Multi-worker execution in one repo is unsafe without locking and lease semantics.
- Feedback loops are not first-class (task-specific gates and retries are ad hoc).
- Resumability exists in custom state files, not in core engine primitives.

## Goals

- SQLite-first orchestration engine with dependency-aware scheduling.
- Single-process scheduler + local workers.
- Safe parallelism in one shared repo using leases and locks.
- Per-task required feedback loops (lint/unit/e2e/etc.) with policy enforcement.
- Never-give-up retry strategy with escalation for persistent blockers.
- Strong resumability via event log + lease recovery + idempotent transitions.
- Keep Overseer-like CLI/UI mental model while adding orchestration visibility.

## Non-Goals (v1)

- Mandatory worktree-per-worker execution.
- Distributed scheduler across multiple machines.
- Full replacement for external PM systems.

## Core Architecture

```text
CLI/UI
  |
  v
API Layer
  |
  v
Scheduler (single process)
  |- Task lease manager
  |- Path/file lease manager
  |- Commit coordinator (single writer)
  |- Feedback loop engine
  |
  +--> Worker runtime (local subagents, N concurrency)
  |
  +--> SQLite (tasks, deps, attempts, loops, locks, events)
```

Overdo architecture is explicitly two-layer:

- MCP layer provides stable system APIs and enforces invariants.
- Skill layer provides workflow behavior and command UX.

```text
Skill Layer
  - /overdo-plan
  - /overdo-orchestrate
  - /overdo-validate
        |
        v
MCP Layer
  - tasks/*
  - loops/*
  - locks/*
  - workers/*
  - commits/*
  - events/*
        |
        v
SQLite + Event Log
```

MCP and skill are both required:

- MCP is the durable contract and safety boundary.
- Skills are the orchestration/policy layer for operators and subagents.

## Shared Environment Model

- Single repo, single running app/service stack.
- No mandatory duplicated dev processes per worker.
- Global E2E lock for Playwriter/full-stack E2E.

## Data Model (v1)

- `tasks`
- `task_dependencies`
- `task_attempts`
- `task_feedback`
- `task_reviews`
- `loop_definitions`
- `loop_runs`
- `loop_iterations`
- `events` (append-only)
- `task_leases`
- `path_leases`
- `env_locks` (includes global E2E lock)
- `commit_queue`
- `commit_transactions`

## Concurrency and Safety

- Task leases assign execution ownership.
- Path/file write leases gate mutations.
- CAS checks (`base_hash`/version) prevent stale writes.
- Deterministic lock acquisition order avoids deadlocks.
- Global commit lock serializes all staging/commit actions.
- No read locks by timeout; write-intent leasing only.

## Commit Strategy

Hybrid cadence:

- Time checkpoint every 20-30 minutes when validated changes exist.
- Subfeature boundary commits.
- Gate-green commits when required loop checks pass.
- Risk checkpoint commits before invasive changes.

Commit transaction protocol:

1. Worker submits commit manifest (files/hunks/task metadata).
2. Acquire global commit lock.
3. Validate leases + CAS.
4. Stage selected hunks/files (`git add -p` semantics via non-interactive patch staging).
5. Commit.
6. Persist commit event + attach SHA.
7. Release locks.

## Task and Loop Semantics

Principle: tasks are finite; loops are controllers.

- Task lifecycle remains finite (`pending -> running -> awaiting_review -> done`, with rejection/retry states).
- Loop controllers spawn and evaluate finite task iterations indefinitely or by policy.
- Each planned task must define its own feedback loop contract.

Per-task feedback loop example:

```yaml
feedback_loop:
  gates:
    - lint
    - unit
    - e2e
  on_fail:
    - classify_error
    - auto_fix_if_confident
    - else_open_ticket
  pass_criteria:
    - all_required_gates_green
    - no_new_critical_regressions
  never_give_up: true
```

## Resumability

- Append-only event log for all transitions.
- Lease heartbeat + expiry recovery.
- Idempotency keys on transition mutations.
- On restart, scheduler reclaims stale work and resumes from durable state.

## CLI and UI

CLI:

- Preserve familiar task commands (`list/tree/next/block`).
- Add orchestration commands (`orchestrator run`, `worker run`, `loop *`, `events tail`).

UI:

- Preserve graph/list/kanban views.
- Add worker lanes, lease status, retry timeline, feedback/gate status, lock telemetry.

## MCP and Skill Contract (v1)

MCP must be the single write path to state transitions and must enforce:

- lease TTL, heartbeat, and expiry behavior
- CAS validation for writes
- idempotency keys for retry-safe mutations
- transition invariants for tasks/loops/locks/commits

Initial MCP surface:

- `tasks.create/update/get/list/nextReady/block/unblock/claim/heartbeat/release`
- `loops.define/start/pause/status/iterate`
- `locks.claimPaths/releasePaths/acquireCommit/releaseCommit/acquireE2E/releaseE2E`
- `workers.spawn/status`
- `commits.enqueue/status`
- `events.tail/query`

Initial skill set:

- `overdo-plan`: parse plan markdown into tasks/dependencies/feedback loops
- `overdo-orchestrate`: execute parent tasks via subagents and policy loops
- `overdo-validate`: run self-validation loop and capture evidence artifacts

## Rollout Plan

### Phase 1: Foundation

- Fork baseline shell (CLI/UI ergonomics).
- Implement schema + task/dependency engine + event log.
- Remove hard VCS requirement from lifecycle.
- Define and freeze MCP v1 contract (`MCP.md`).

### Phase 2: Scheduler + Workers

- Implement scheduler loop and local worker pool.
- Implement task/path leases and conflict handling.
- Implement context bundle propagation into subagents.
- Implement skill adapters that call MCP only (no direct DB writes).

### Phase 3: Commit Coordinator

- Add global commit lock and commit queue.
- Add non-interactive patch-level staging support.
- Add commit metadata/trailers and audit linkage.
- Add cross-surface contract test (CLI, UI, and skills produce identical state/events).

### Phase 4: Feedback Loops

- Enforce per-task loop contracts.
- Add retry classes, backoff, and escalation policies.
- Add ticket creation path for hard blockers.

### Phase 5: UI + Planning

- Add orchestration/loop observability in UI.
- Add plan import (`markdown -> tasks/deps/loop contracts`).

## Phase Validation Loops (build-the-builder)

Each implementation phase must include a self-validating loop before moving on:

1. Define phase acceptance tests and observability checks.
2. Implement the smallest vertical slice.
3. Run automated checks (unit/integration/e2e as applicable).
4. Inject at least one failure scenario intentionally.
5. Verify recovery/retry/resume behavior works.
6. Record evidence in phase report.
7. Only then mark phase complete.

Required validation outputs per phase:

- Test run artifact references.
- Failure injection result.
- Recovery/resume proof.
- Lock contention proof (where relevant).
- Commit/audit trail proof.

## Success Metrics

- Safe multi-worker execution in one repo for non-overlapping scopes.
- No staging/commit corruption incidents.
- High restart recovery rate without manual DB surgery.
- Reduced manual orchestration burden.
- Clear auditability for task/loop/commit transitions.
