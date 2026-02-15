# Overseer Parity Audit (Current State)

Date: 2026-02-15

## Executive Summary

Overdo now has strong orchestration core/test coverage and process-level crash matrix testing, but it is **not** a
1:1 UI/tooling clone of Overseer. It is a TypeScript-first system with Overseer-inspired architecture patterns.

## Claim-by-Claim Audit

### UI parity with Overseer

- Status: **Partial**
- What exists:
  - backend UI snapshot and view-model builders (`graph/list/kanban`) in `src/ui/observability.ts`
  - UI telemetry tests in `tests/integration/ui-observability.test.ts`
- Missing for near 1:1 parity:
  - full interactive frontend app
  - richer UX controls, streaming updates, and visual parity pass

### Aggressive committing

- Status: **Partial/Functional core**
- What exists:
  - commit queue + serialized global lock
  - manifest validation and stale-base detection
  - commit crash checkpoints and recovery tests
- Missing:
  - autonomous policy engine for commit-per-time / commit-per-change windows
  - direct VCS worker that creates real commits from filesystem changes in production flow

### Concurrent Overdo workers on one branch with safe writes

- Status: **Strong**
- What exists:
  - task/path leases
  - commit lock serialization
  - contention tests and crash matrix coverage
- Remaining hardening:
  - longer-duration soak tests with larger worker counts and mixed workloads

### Never-stop + resume across restarts

- Status: **Strong (bounded escalation model)**
- What exists:
  - loop runs + loop iterations persistence
  - crash/resume process tests (including double-hop)
  - deterministic checkpoint chaos matrix
- Clarification:
  - behavior is bounded retries + escalation (not infinite unbounded loops)

## Recommended Next Steps for Near-1:1 Overseer Feel

1. Ship interactive UI app on top of current view models.
2. Add commit policy daemon (time/changes/task thresholds) and real VCS integration tests.
3. Add nightly soak profile with `E2E_PROCESS_CHAOS_ROUNDS>=5` and worker-count scaling.
4. Add parity acceptance checklist per UX surface against Overseer screenshots/workflows.
