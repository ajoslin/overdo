# Overdo Monorepo Packages Migration

## Problem

The repository is currently single-package with mixed concerns (CLI scripts, MCP server script, and plugin-facing
logic). This makes ownership boundaries, release targeting, and package-level testing harder than necessary.

### Why Now?

- The continuation plugin is planned as a first-class package and needs a clean home.
- CLI and MCP surfaces are growing and should be versioned/tested with explicit boundaries.
- User direction is to move to a monorepo under `packages/` with hard cutover.

## Summary

Migrate to a Bun workspace monorepo with `packages/overdo-cli`, `packages/overdo-mcp`,
`packages/overdo-plugin`, and `packages/overdo-core`, preserving current behavior while hard-cutting
paths/scripts to package-based entrypoints.

## Goals & Success Metrics

| Metric | Current | Target | How Measured |
|--------|---------|--------|--------------|
| Workspace layout | single package | 3 package directories under `packages/` | repo tree + workspace config |
| Build/test command parity | root-only scripts | root orchestrates package scripts, all green | `bun run lint`, `bun run test`, `bun run build` |
| CLI contract behavior | implemented in root scripts | unchanged behavior from package entrypoint | spawned CLI e2e (`packages/overdo-cli/tests/e2e/process/spawn-overdo-cli.e2e.test.ts`) |
| MCP server startup contract | root script direct | package-managed executable path | MCP contract/integration tests |

## Non-Goals

- Introducing a custom process supervisor runtime (`overdo run`).
- Rewriting domain internals in Rust or non-TypeScript stacks.
- Adding tmux orchestration features.

## Scope & Phasing

### Phase 1

- Add Bun workspace root config and workspace package manifests.
- Create packages:
  - `packages/overdo-cli`
  - `packages/overdo-mcp`
  - `packages/overdo-plugin`
  - `packages/overdo-core` (runtime primitives only)
- Move entrypoints and scripts into package-owned sources.
- Update root scripts to call workspace tasks.
- Move tests to co-located package test folders; update imports accordingly.
- Keep behavior equivalent (hard cutover, no legacy compatibility shim paths required).

### Later

- Add shared internal package for common runtime primitives if duplication appears.
- Add per-package release/version strategy and changelog generation.

## Constraints

- Tooling choice fixed to Bun workspaces (Bun-only commands).
- Hard cutover accepted (breaking internal paths allowed within this repo).
- Existing acceptance suites must remain green.
- MCP mutation boundary invariants remain unchanged.
- Shared `overdo-core` is runtime primitives only (no CLI/MCP helpers).
- MCP server starts via its own package binary.
- Versioning is unified across all packages.

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Path breakage in tests/scripts after relocation | High | High | staged moves with immediate suite runs and path mapping checklist |
| Circular package dependencies | Medium | High | dependency direction rules (cli/mcp/plugin depend on shared core only) |
| Hidden runtime assumptions in script locations | Medium | Medium | spawned-process e2e and explicit bin path assertions |
| Workspace command drift between local/CI | Medium | Medium | lock to Bun workspace scripts and document canonical commands |

## Dependencies

- Bun workspace configuration at repository root.
- Existing CLI and process e2e tests for behavior lock.
- Existing MCP contract tests.

## Integration Touchpoints

- `package.json` (workspace root scripts)
- `packages/overdo-cli/package.json` + CLI entry files
- `packages/overdo-mcp/package.json` + MCP server entry files
- `packages/overdo-plugin/package.json` + plugin/hook entry files
- `packages/overdo-core/package.json` + runtime primitives
- `packages/overdo-cli/tests/e2e/process/spawn-overdo-cli.e2e.test.ts`
- `packages/overdo-core/tests/integration/mcp-v1-contract.test.ts`

## Demo Path

1. Install dependencies via Bun workspace.
2. Run workspace lint/test/build successfully.
3. Run spawned CLI process e2e and verify command contracts unchanged.
4. Start MCP server via package entrypoint and pass MCP contract tests.
5. Verify plugin package loads and exports expected hook entry (placeholder acceptable in phase 1).

## Decision & Trade-offs

Adopt Bun workspaces monorepo with hard cutover into `packages/`.

Trade-offs:

- **Pros:** clearer package ownership, easier future plugin evolution, cleaner release boundaries.
- **Cons:** immediate churn and path updates; short-term breakage risk during migration.
- **Decision:** proceed now to avoid layering plugin work on top of legacy single-package layout.

## Open Questions

| Question | Owner | Status |
|----------|-------|--------|
| None | - | - |

## Context

### Patterns to Follow

- Preserve existing command contracts and process e2e expectations.
- Keep TypeScript-first architecture and current invariants.

### Key Files

- `package.json`
- `packages/overdo-cli/bin/overdo.mjs`
- `packages/overdo-mcp/bin/overdo-mcp-server.mjs`
- `packages/overdo-cli/tests/e2e/process/spawn-overdo-cli.e2e.test.ts`
- `packages/overdo-core/tests/integration/mcp-v1-contract.test.ts`
