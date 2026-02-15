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
- OpenCode integration is installed via `npm run overdo:install:opencode`.

## Required audit deliverables

Create/update these artifacts:

1. `docs/audits/overseer-parity-audit.md` (replace partial claims with measured scoring)
2. `docs/audits/overseer-parity-scorecard.md` (table with pass/fail/partial + evidence links)
3. `evidence/overseer-parity-audit-<date>.md` (commands run, outputs, findings)
4. `docs/audits/overseer-parity-gap-plan.md` (prioritized closure plan)

## Hard acceptance criteria

- Every claim must cite at least one concrete file path and one test/command.
- No subjective "feels equivalent" statements without measurable criteria.
- For each category, include:
  - `status`: pass / partial / fail
  - `confidence`: high / medium / low
  - `blocking gaps`: explicit list
  - `next implementation task`: one-line actionable item

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

- run `npm run e2e:process`
- run `E2E_PROCESS_CHAOS_ROUNDS=5 npm run e2e:process:chaos`
- capture chaos report path(s)

## 4) Never-stop + resume across restarts

Score:

- single crash-resume
- double-hop resume
- checkpoint matrix recovery
- escalation/bounded retry correctness

Minimum verification:

- run `tests/e2e/checkpoint-matrix.e2e.test.ts`
- run `tests/e2e/checkpoint-chaos.e2e.test.ts`
- run process crash tests under `tests/e2e/process/`

## Command checklist

Run in this order and record outcomes:

```bash
npm run lint
npm test
npm run build
npm run e2e:process
E2E_PROCESS_CHAOS_ROUNDS=5 npm run e2e:process:chaos
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
