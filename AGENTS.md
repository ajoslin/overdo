# Overdo Knowledge Base

Generated for local execution context. This file defines the project map, invariants, and implementation
guardrails for agent work in this repository.

## Project Summary

Overdo is a TypeScript-first orchestration platform that evolves Overseer-inspired patterns into a
SQLite-native system with first-class feedback loops, resumability, and safe local multi-worker execution.

Overseer in `references/overseer` is a template/reference source for architecture and workflow patterns.
It is not a direct fork target.

## Language and Runtime Policy

- Core implementation language: **TypeScript**.
- Database: SQLite (Node `DatabaseSync` in current implementation).
- Testing: Vitest.
- Linting: ESLint.
- CI: GitHub Actions.
- Do not introduce Rust deliverables in this repository.

## Repository Map

```
.
├── src/
│   ├── foundation/         # schema, task graph, event log
│   ├── mcp/                # MCP surface and health
│   ├── runtime/            # scheduler and lease runtime
│   ├── commits/            # commit coordinator and lock logic
│   ├── validation/         # feedback-loop engine
│   ├── planning/           # markdown plan import
│   ├── ui/                 # observability snapshot logic
│   ├── scheduler/          # lightweight selection helper
│   ├── workers/            # worker dispatch helper
│   └── skills/             # skill-facing entry points
├── tests/
│   ├── unit/
│   ├── integration/
│   ├── fixtures/
│   └── helpers/
├── evidence/               # milestone validation artifacts
├── docs/specs/             # specs (gap audit + full implementation)
├── references/overseer/    # upstream template repository (read-only reference)
├── PRD.md
├── PHASES.md
└── BUILD_FROM_ZERO_PLAN.md
```

## Core Invariants

1. MCP is the mutation boundary for orchestrated state transitions.
2. Dependency graph must reject cycles.
3. Task transitions must be finite and validated.
4. Leases must prevent concurrent ownership of same task/path.
5. Commit operations must be serialized under global commit lock.
6. Required feedback gates must pass before completion.
7. Every phase/feature must include deterministic validation evidence.

## Commands

```bash
# Quality and tests
npm run lint
npm run unit
npm run integration
npm run e2e
npm test

# Build
npm run build
```

## Where to Look First

| Task | File |
|------|------|
| Schema and storage | `src/foundation/schema.ts` |
| Task lifecycle and dependencies | `src/foundation/task-graph.ts` |
| Event append/query behavior | `src/foundation/event-log.ts` |
| MCP contract surface | `src/mcp/v1.ts` |
| Scheduler dispatch/reclaim | `src/runtime/scheduler.ts` |
| Lease behavior | `src/runtime/leases.ts` |
| Commit queue/lock logic | `src/commits/coordinator.ts` |
| Feedback loop policy | `src/validation/loop-engine.ts` |
| Plan import behavior | `src/planning/markdown-import.ts` |
| UI observability snapshot | `src/ui/observability.ts` |

## Spec and Planning Sources

- Product requirements: `PRD.md`
- Phase requirements: `PHASES.md`
- Build-from-zero plan: `BUILD_FROM_ZERO_PLAN.md`
- Gap audit spec: `docs/specs/overdo-gap-audit/SPEC.md`
- Full implementation spec: `docs/specs/overdo-v1-complete-implementation/SPEC.md`

## Validation Requirements

For each meaningful change, include:

- unit/integration tests as appropriate
- one intentional failure path (where relevant)
- restart/recovery proof for stateful flows
- evidence update in `evidence/` when milestone behavior changes

## Anti-Patterns

- Direct state mutation from skills bypassing MCP.
- Silent transition shortcuts that skip invariants.
- Non-deterministic tests without controlled seeds/inputs.
- Marking milestones complete without artifact-backed validation.
