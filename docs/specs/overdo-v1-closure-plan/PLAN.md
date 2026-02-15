# Plan: Overdo v1 Reality-Based Closure

## Intent

Close the gap between current prototype status and true v1 completion criteria in `PRD.md` and `PHASES.md`.

This plan treats Overseer task completion as workflow tracking only. Product completion requires verified
implementation evidence.

## Current Truth Snapshot

- Tests: `npm test` passes (22/22).
- Build: `npm run build` passes.
- Lint: `npm run lint` fails due `references/overseer/**` being linted.
- Core modules exist across foundation, runtime, mcp, commits, validation, planning, and ui.
- Multiple critical areas are still partial per `docs/specs/overdo-gap-audit/SPEC.md`.

## Delivery Strategy

```text
Contract Hardening -> Runtime Safety -> Commit Safety -> Loop Durability -> UI/Skills Closure
        |                 |                  |                |                  |
      tests +          tests +            tests +          tests +            tests +
   fail injection   fail injection     fail injection   fail injection     fail injection
        |                 |                  |                |                  |
                         resume/recovery proofs + evidence artifacts
```

## Phase A: Baseline Hygiene and Contract Freeze

1. Exclude `references/overseer/**` from lint scope.
2. Freeze and document Overdo MCP v1 endpoint contract and invariants.
3. Add requirement traceability table (PRD item -> file -> tests).

Done when:

- `npm run lint`, `npm test`, and `npm run build` all pass in this repo.
- MCP contract doc includes explicit error conditions and idempotency rules.

Validation loop:

- Inject one invalid contract transition and verify deterministic rejection.
- Record artifact in `evidence/milestone-foundation-contract.md`.

## Phase B: Foundation and Event Semantics Completion

1. Expand schema constraints/indexing/migration versioning.
2. Strengthen task graph state transitions and effective blocker semantics.
3. Expand event model for correlation/source and replay querying.

Done when:

- Contract tests cover lifecycle, cycle detection, blocker inheritance, and idempotency replay.

Validation loop:

- Inject duplicate idempotency and stale transition attempts.
- Restart and prove durable state continuity.

## Phase C: Scheduler/Lease and Commit Coordinator Hardening

1. Add deterministic task selection ordering and CAS checks.
2. Harden task/path lease ownership and reclaim semantics under contention.
3. Implement patch-manifest commit flow with stale-base detection.

Done when:

- Contention tests show no duplicate ownership and no concurrent commit corruption.

Validation loop:

- Kill worker mid-lease, force overlap path lease request, simulate stale commit base.
- Verify rescheduling/recovery and persisted audit trail.

## Phase D: Feedback Loop Durability and Policies

1. Persist `loop_runs` and `loop_iterations` with deterministic iteration artifacts.
2. Add rescope/switch/escalation thresholds and flaky-repro playbook policies.
3. Enforce completion gates strictly from persisted loop state.

Done when:

- Tasks cannot complete with unmet required gates.
- Retry/escalation behavior is deterministic and observable.

Validation loop:

- Repeated-failure fingerprint scenario + escalation trigger scenario.
- Restart and verify iteration resume correctness.

## Phase E: Planning/Skills/UI End-to-End Closure

1. Upgrade markdown plan import to full task/dependency/loop-contract mapping.
2. Ensure skills (`overdo-plan`, `overdo-orchestrate`, `overdo-validate`) write only through MCP.
3. Deliver UI graph/list/kanban with orchestration telemetry lanes.
4. Execute one imported plan through full orchestrate + validate cycle.

Done when:

- Imported plan runs end-to-end and produces complete evidence bundle.
- UI reflects worker/lease/lock/retry/gate status during active runs.

Validation loop:

- Invalid plan input injection, stale UI state simulation, reconnect continuity proof.

## Exit Criteria for v1 Completion

All must be true:

1. Every critical gap in `docs/specs/overdo-gap-audit/SPEC.md` is closed and re-scored to `Done`.
2. Quality gates pass: lint, unit, integration, build.
3. Each phase has failure-injection and recovery/resume evidence.
4. MCP remains the sole mutation boundary for skill-driven flows.
5. Final evidence index is updated and linked from `evidence/`.

## Completion Status (2026-02-14)

- Critical gaps from `docs/specs/overdo-gap-audit/SPEC.md` have been re-scored to `Done`.
- Quality gates pass: lint, unit, integration, e2e, and build.
- Failure-injection and recovery evidence is linked in `evidence/v1-closure-implementation-2026-02-14.md`.
- MCP remains the mutation boundary for orchestrated workflows in this codebase.
