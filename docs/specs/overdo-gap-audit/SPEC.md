# Overdo Gap Audit (TypeScript, Overseer-Template Guided)

## Problem

Overdo has a validated prototype slice, but milestone completion currently overstates parity with the intended
PRD/PHASES scope. We need a rigorous gap audit that uses Overseer as a template for architecture patterns while
keeping implementation strictly TypeScript-first.

### Why Now?

- Current planning state marks major scope as complete while several areas are only partially implemented.
- Additional work is being queued (feedback-loop hardening) without a normalized done/partial/missing baseline.
- Without a hard audit, execution can drift into local optimizations instead of closing PRD-critical gaps.

## Summary

Create a weighted, evidence-based gap matrix against `PRD.md` and `PHASES.md`, informed by `references/overseer`
patterns, then re-scope implementation milestones into TypeScript-native deliverables with explicit acceptance tests.

## Goals & Success Metrics

| Metric | Current | Target | How Measured |
|--------|---------|--------|--------------|
| PRD requirement coverage with evidence | Informal/implicit | 100% requirements scored (done/partial/missing) | Gap matrix in spec + file/line evidence |
| Phase validation rigor | Mixed depth | Every phase has tests + failure injection + resume proof | Audit checklist over `tests/` and `evidence/` |
| MCP surface parity to v1 intent | Partial (`tasks*` subset) | Full planned surface documented with closure tasks | API inventory vs PRD contract map |
| UI/tooling parity confidence | Low | Explicitly scoped TS UI/tooling closure plan | Deliverable list with measurable exits |
| Language constraint compliance | Unstated in plan docs | TypeScript-only codified | Constraint section + no Rust deliverables |

## Non-Goals

- Literal code fork parity with Overseer Rust internals.
- Rewriting Overdo in Rust or introducing Rust runtime dependencies.
- Reproducing every Overseer feature that is outside Overdo PRD scope.

## Scope & Phasing

### Phase 1

Build the audit baseline and publish weighted matrix.

1. Inventory Overdo implementation surfaces (`src/`, `tests/`, `evidence/`, CI).
2. Extract requirement list from `PRD.md` + `PHASES.md`.
3. Map each requirement to status: `done`, `partial`, `missing` with confidence score.
4. Add severity weight (critical/high/medium/low) based on architecture and safety impact.
5. Produce closure backlog in dependency order.

### Later

Execute closure backlog in TS-native milestones.

1. MCP contract completion and persistence hardening.
2. Runtime and commit coordination hardening.
3. Feedback-loop persistence and policy hardening.
4. UI/tooling parity upgrades and plan-import correctness expansion.

### Weighted Gap Matrix (initial)

| Area | Weight | Status | Confidence | Notes |
|------|--------|--------|------------|-------|
| Schema breadth (tasks/deps/events/leases/locks/commits) | Critical | Partial | High | Tables exist, but some PRD entities and constraints are simplified (`src/foundation/schema.ts`) |
| Task graph + lifecycle invariants | Critical | Partial | High | Basic transitions/dependency checks exist, but finite-state/invariant depth is limited (`src/foundation/task-graph.ts`) |
| MCP v1 surface + invariant enforcement | Critical | Partial | High | Minimal API exists; planned broader surface (`loops/*`, `locks/*`, `workers/*`, `events/*`) not fully implemented (`src/mcp/v1.ts`) |
| Scheduler + leases + recovery | High | Partial | High | Core dispatch/reclaim works; conflict semantics and richer context propagation are limited (`src/runtime/scheduler.ts`, `src/runtime/leases.ts`) |
| Commit coordinator + patch staging + audit linkage | Critical | Partial | High | Queue/lock trail exists, but no real patch-level git staging protocol (`src/commits/coordinator.ts`) |
| Feedback-loop controller persistence/policy | Critical | Partial | High | Gate checks and retry class exist; loop-runs/iterations and richer policies are not fully durable (`src/validation/loop-engine.ts`) |
| UI observability parity (graph/list/kanban + telemetry) | High | Missing/Partial | High | Current implementation is snapshot helper, not full operator UI (`src/ui/observability.ts`) |
| Plan import fidelity + validation | Medium | Partial | High | Sequential parser exists; full markdown->tasks/deps/loop contract mapping is narrow (`src/planning/markdown-import.ts`) |
| Cross-surface parity tests (CLI/UI/skills/MCP) | High | Partial | Medium | Integration tests exist, parity matrix across surfaces is not complete (`tests/integration/*`) |
| TS build/test/CI baseline | Medium | Done | High | Lint, unit, integration, CI pipeline present (`package.json`, `.github/workflows/ci.yml`) |

## Constraints

- **TypeScript only** for runtime, MCP, orchestration logic, and tooling in this repo.
- SQLite remains the primary state store.
- Overseer is used as a **template/reference**, not a line-by-line feature cloning target.
- Preserve MCP as the single mutation boundary for orchestration state.

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Overstating completion status | High | High | Require file-backed evidence per requirement and explicit confidence score |
| Template drift from Overseer patterns | Medium | Medium | Maintain mapping table: Overseer pattern -> Overdo TS implementation decision |
| Scope creep via non-PRD features | Medium | High | Gate backlog entries against PRD/PHASES requirement IDs |
| Thin tests masking behavior gaps | Medium | High | Add contract and failure-injection tests for each partial/missing critical area |
| UI parity ambiguity | Medium | Medium | Define explicit MVP UI exits (views, telemetry, interactions) before implementation |

## Dependencies

- `PRD.md`
- `PHASES.md`
- `BUILD_FROM_ZERO_PLAN.md`
- `references/overseer/README.md`
- `references/overseer/docs/ARCHITECTURE.md`
- `references/overseer/docs/MCP.md`
- `references/overseer/docs/CLI.md`

## Integration Touchpoints

- Foundation: `src/foundation/schema.ts`, `src/foundation/task-graph.ts`, `src/foundation/event-log.ts`
- MCP: `src/mcp/v1.ts`, `src/mcp/index.ts`
- Runtime: `src/runtime/scheduler.ts`, `src/runtime/leases.ts`
- Commits: `src/commits/coordinator.ts`
- Validation loops: `src/validation/loop-engine.ts`
- Planning/UI: `src/planning/markdown-import.ts`, `src/ui/observability.ts`
- Evidence/tests: `tests/integration/*.test.ts`, `tests/unit/*.test.ts`, `evidence/*.md`

## Demo Path

1. Run baseline checks: `npm run lint && npm test`.
2. Generate audit matrix from current code and docs into this spec.
3. Select one critical `partial` area (MCP contract expansion) and define closure acceptance tests.
4. Re-run checks plus targeted integration tests to prove closure readiness.

## Decision & Trade-offs

Use a **template-guided TypeScript convergence** strategy: adopt Overseer architectural patterns (contracts,
invariants, workflows, observability) while implementing only PRD-relevant capabilities in TypeScript.

Trade-offs:

- Gains execution speed and language consistency; avoids Rust adoption overhead.
- Requires deliberate translation of patterns instead of direct code reuse.
- Keeps scope controlled but may postpone non-PRD Overseer conveniences.

## Open Questions

| Question | Owner | Status |
|----------|-------|--------|
| Should UI parity include full graph/list/kanban in this cycle or telemetry-first operator console? | Product (lp) | Open |
| Should MCP v1 closure prioritize breadth (all endpoints) or depth (strict invariants on existing endpoints first)? | Product + Engineering | Open |

## Context

### Patterns to Follow

- Codemode-style MCP API ergonomics from Overseer docs, adapted to TS runtime.
- Strong invariant enforcement around lifecycle transitions, dependencies, and retries.
- Event/audit-first orchestration traceability.
- Validation loops with deterministic measurements and escalation policies.

### Key Files

- Local specs: `PRD.md`, `PHASES.md`, `BUILD_FROM_ZERO_PLAN.md`
- Local implementation: `src/` and `tests/`
- Template references: `references/overseer/docs/ARCHITECTURE.md`, `references/overseer/docs/MCP.md`, `references/overseer/docs/CLI.md`
