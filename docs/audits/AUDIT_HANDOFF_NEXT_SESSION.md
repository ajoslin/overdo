# Audit Handoff - Next Session

Date: 2026-02-15
Repo: `https://github.com/ajoslin/overdo`
Branch: `master`

## Goal

Finish a production-grade parity audit against Overseer-inspired goals, with hard evidence for:

1. UI parity status
2. aggressive commit behavior status
3. concurrency + lock correctness status
4. restart/resume + never-stop behavior status

Use this as the execution brief for a fresh session.

## Current baseline

- Core audit summary exists in `docs/audits/overseer-parity-audit.md`.
- Process-level matrix + chaos tests are in place and passing.
- OpenCode integration is installed via `bun run overdo:install:opencode`.
- CLI parity scaffold is now implemented and covered by spawned-process e2e in
  `packages/overdo-cli/tests/e2e/process/spawn-overdo-cli.e2e.test.ts`.

## Superset-fork framing (apply throughout audit)

- Treat Overdo as a **superset-fork** of Overseer: preserve Overseer-style command/UX semantics where feasible.
- Equivalent behavior is the default target for shared surfaces.
- Overdo-specific additions are allowed if they do not regress Overseer-compatible workflows.
- In parity scoring, classify each feature as:
  - `equivalent`
  - `superset-equivalent` (equivalent core + additive behavior)
  - `divergent` (explicitly document why)

## What remains (high priority)

1. complete measured scorecard artifacts listed below (audit/scorecard/evidence/gap plan)
2. run and capture full command checklist including chaos report path
3. complete UI smoke loop via Playwriter with saved artifacts under `artifacts/e2e/ui-smoke/`
4. verify aggressive commit behavior against measurable thresholds (not narrative claims)
5. finalize gap-closure plan with ordered implementation tasks and effort estimates

## Required audit deliverables

Create/update these artifacts:

1. `docs/audits/overseer-parity-audit.md` (replace partial claims with measured scoring)
2. `docs/audits/overseer-parity-scorecard.md` (table with pass/fail/partial + evidence links)
3. `evidence/overseer-parity-audit-<date>.md` (commands run, outputs, findings)
4. `docs/audits/overseer-parity-gap-plan.md` (prioritized closure plan)

## Hard acceptance criteria

- Every claim must cite at least one concrete file path and one test/command.
- No subjective "feels equivalent" statements without measurable criteria.
- Every code change made during the audit must be validated before merge via at least one of:
  - unit/integration test
  - e2e test
  - Playwriter smoke verification with saved artifacts
- For each category, include:
  - `status`: pass / partial / fail
  - `confidence`: high / medium / low
  - `blocking gaps`: explicit list
  - `next implementation task`: one-line actionable item

## Testing protocol (mandatory)

When the next session patches code while auditing, run a tight feedback loop and record results in evidence:

1. run the narrowest relevant automated test first (unit/integration/e2e)
2. patch failures
3. re-run the same test until green
4. run broader regression command(s) before final report

Validation mapping to enforce:

- UI behavior changes: Playwriter smoke + `packages/overdo-core/tests/integration/ui-observability.test.ts`
- Commit/lock behavior changes: integration tests touching `packages/overdo-core/src/commits/coordinator.ts`
- Runtime/process behavior changes: `packages/overdo-cli/tests/e2e/process/*`
- CLI behavior changes: add or run an e2e test that spawns the CLI process (see note below)

CLI testing note:

- The CLI is testable in e2e by spawning the executable (`packages/overdo-cli/bin/overdo.mjs` / `overdo` bin)
  using the existing process harness patterns under `packages/overdo-cli/tests/e2e/process/`.
- Do not rely only on mocked function tests for CLI flows; include at least one process-spawn test
  for any user-visible CLI behavior touched by the audit implementation.

## Audit matrix to complete

## 1) UI parity vs Overseer

Score:

- read-only observability
- interactive controls
- graph/list/kanban UX behavior
- streaming/refresh semantics
- visual/theming parity

Minimum verification:

- inspect current UI code in `src/ui/observability.ts`
- identify whether frontend app exists (or not)
- verify any UI runtime/e2e tests

Playwright smoke loop (required):

- Use Playwriter MCP against the running UI surface.
- Run at least 3 smoke flows in a feedback loop:
  1. open status view -> verify task cards render
  2. switch/list or kanban view -> verify state remains consistent
  3. trigger refresh/reconnect path -> verify telemetry updates
- For each failure, patch and re-run until pass.
- Save screenshots/logs to `artifacts/e2e/ui-smoke/` and link them in evidence.

## 2) Aggressive committing

Score:

- commit-per-task
- commit-per-change threshold
- commit-per-time window
- stale-base handling
- exactly-once commit transaction behavior

Minimum verification:

- inspect `src/commits/coordinator.ts`
- run integration + checkpoint tests touching commit flow
- confirm whether real git commit creation is automated or abstracted

## 3) Concurrent workers on one branch

Score:

- lease exclusivity
- commit lock exclusivity
- contention recovery
- soak behavior under repeated rounds

Minimum verification:

- run `bun run e2e:process`
- run `E2E_PROCESS_CHAOS_ROUNDS=5 bun run e2e:process:chaos`
- capture chaos report path(s)

## 4) Never-stop + resume across restarts

Score:

- single crash-resume
- double-hop resume
- checkpoint matrix recovery
- escalation/bounded retry correctness

Minimum verification:

- run `packages/overdo-core/tests/e2e/checkpoint-matrix.e2e.test.ts`
- run `packages/overdo-core/tests/e2e/checkpoint-chaos.e2e.test.ts`
- run process crash tests under `packages/overdo-cli/tests/e2e/process/`

## Command checklist

Run in this order and record outcomes:

```bash
bun run lint
bun run test
bun run build
bun run e2e:process
E2E_PROCESS_CHAOS_ROUNDS=5 bun run e2e:process:chaos
# When CLI behavior is touched, also run targeted spawned-process coverage:
bunx vitest run packages/overdo-cli/tests/e2e/process/spawn-single-opencode.e2e.test.ts
bunx vitest run packages/overdo-cli/tests/e2e/process/spawn-multi-opencode.e2e.test.ts
```

## Suggested final output format (for the next session)

1. Executive verdict (what is truly parity vs not)
2. Scorecard table (pass/partial/fail + confidence)
3. Evidence links (files + command outputs)
4. Top 5 blocking gaps
5. Ordered implementation plan with estimated effort

## Notes

- Keep TypeScript-only policy.
- Do not claim 1:1 Overseer parity unless UI + commit automation gaps are closed.
