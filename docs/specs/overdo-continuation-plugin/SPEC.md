# Overdo Continuation Plugin

## Problem

Overdo currently runs inside OpenCode sessions and inherits session idle/abort behavior. If a session stalls,
there is no first-class Overdo continuation policy with explicit safety guards and auditability.

### Why Now?

- The team wants to keep the simple in-session model (skill/plugin), not introduce a separate `overdo run` supervisor.
- Recent process/e2e work proved continuation pressure is real; we now need a production continuation policy, not
  ad-hoc retries.
- Audit direction is now a superset-fork stance relative to Overseer, so resiliency behavior needs a clear
  specification and evidence path.

## Summary

Build `overdo-autocontinue` as an OpenCode plugin package that resumes stalled sessions conservatively based on
idle signals and no-progress checks, with stop controls, cooldown/backoff, and anti-loop protections.

## Goals & Success Metrics

| Metric | Current | Target | How Measured |
|--------|---------|--------|--------------|
| Idle recovery trigger latency | ad hoc / undefined | <= 15s from eligible idle event | plugin event logs + e2e timestamps |
| Successful continuation after eligible idle | undefined | >= 95% in process e2e chaos runs | `packages/overdo-cli/tests/e2e/process/*` continuation scenarios |
| False continuation while waiting for user | unbounded risk | 0 in acceptance suite | blocked-on-human e2e + unit guard tests |
| Repeated loop injections per session | unbounded risk | <= configured max attempts before stop/escalate | plugin state + assertions artifacts |

## Non-Goals

- Building a custom terminal renderer, markdown TUI, or diff UI.
- Adding tmux orchestration as part of this plugin spec.
- Introducing `overdo run` external supervisor runtime.
- Changing model selection policy for process e2e (remain cheap-model default).

## Scope & Phasing

### Phase 1

- Create `packages/overdo-plugin` with `overdo-autocontinue` hook entrypoint.
- Listen to session events and evaluate continuation eligibility with conservative policy:
  - idle threshold reached
  - no active tool execution/progress
  - no active user-input gate / unresolved question state
  - cooldown satisfied
- Inject continuation prompt into same session.
- Persist per-session continuation state (attempt counts, last activity, last injection).
- Provide stop command/flag per session.
- Add unit tests for policy/state transitions and process e2e for happy + failure paths.

### Later

- Pluggable policy profiles (`conservative`, `balanced`, `aggressive`).
- Optional per-project continuation policy file.
- Optional escalation hooks (notify instead of continue after max retries).

## Constraints

- Must run inside OpenCode plugin/hook lifecycle.
- Must preserve current Overdo usage pattern (invoked as skill in session).
- Must avoid continuation loops when human interaction is required.
- Must produce deterministic, auditable artifacts for process e2e and chaos runs.
- Default max continuation attempts: 3 per session before stop/escalate.
- Stop-control supports both command-only and config toggle.

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Infinite continue loop while blocked on human input | Medium | High | explicit blocked-on-human guard + max attempts + stop control |
| Aggressive reinjection causing noisy UX | Medium | Medium | conservative defaults, cooldown/backoff, no-op when progress resumes |
| Session state drift across retries | Medium | High | persisted per-session state + replay-safe transitions |
| Plugin API/event shape changes upstream | Low | Medium | adapter layer + contract tests against current OpenCode event payloads |

## Dependencies

- Monorepo package split available (`packages/overdo-plugin` target).
- OpenCode plugin event APIs and session prompt injection API.
- Existing process harness in `packages/overdo-cli/tests/e2e/helpers/opencode-process.ts`.

## Integration Touchpoints

- `packages/overdo-plugin/src/overdo-autocontinue/*` (new)
- `packages/overdo-cli/tests/e2e/helpers/opencode-process.ts` (continue-path assertions)
- `packages/overdo-cli/tests/e2e/process/*` (new continuation-specific process tests)
- `docs/audits/AUDIT_HANDOFF_NEXT_SESSION.md` (evidence checklist alignment)

## Demo Path

1. Start a session with incomplete tasks and auto-continue enabled.
2. Force eligible idle condition (no new output/activity beyond threshold).
3. Observe single continuation injection, then resumed progress.
4. Trigger blocked-on-human condition; verify no auto-injection occurs.
5. Trigger repeated failures; verify capped retries and stop/escalation behavior.

## Decision & Trade-offs

Use in-session plugin continuation (`overdo-autocontinue`) with conservative policy.

Trade-offs:

- **Pros:** simpler architecture, no new supervisor runtime, preserves user workflow.
- **Cons:** less control than external orchestrator; depends on OpenCode hook/event guarantees.
- **Decision:** acceptable because simplicity and compatibility are prioritized now.

## Open Questions

| Question | Owner | Status |
|----------|-------|--------|
| None | - | - |

## Context

### Patterns to Follow

- conservative continuation policy and stop-guard style from established OpenCode hook ecosystems
- process-level artifact-first validation style already present in this repo

### Key Files

- `packages/overdo-cli/tests/e2e/helpers/opencode-process.ts`
- `packages/overdo-cli/tests/e2e/process/spawn-single-opencode.e2e.test.ts`
- `packages/overdo-cli/tests/e2e/process/crash-resume-opencode.e2e.test.ts`
- `docs/audits/AUDIT_HANDOFF_NEXT_SESSION.md`
