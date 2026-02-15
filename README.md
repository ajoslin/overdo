# overdo

`overdo` is a task orchestration system for OpenCode.

It is heavily inspired by Overseer by dmmulroy:
https://github.com/dmmulroy/overseer

## Main features

- Task orchestration and planning with built-in feedback loops
- Resume across restarts with SQLite-backed state
- Never-stop execution model with bounded escalation
- UI observability surfaces for task/runtime status
- Aggressive commit flow (commit-per-task/changes/time) via serialized commit queue
- Safe concurrent workers on one branch with lease + commit lock protection
- Crash-checkpoint matrix and process-level e2e harness coverage

## Install

```bash
git clone https://github.com/ajoslin/overdo.git
cd overdo
bun install
```

Optional (global CLI):

```bash
bun link
```

## Install into OpenCode (MCP + skills)

```bash
bun run overdo:install:opencode
```

This installs:

- MCP server entry under your `~/.config/opencode/opencode.json` as `mcp.overdo`
- Skills into `~/.config/opencode/skills/overdo-plan` and `~/.config/opencode/skills/overdo-orchestrate`

## Basic CLI usage

```bash
# CLI
overdo help
overdo --version
overdo --db .overdo/tasks.db init
OVERDO_DB_PATH=.overdo/tasks.db overdo --json task list
overdo test unit
overdo test process
overdo --json task create -d "Bootstrap milestone"
overdo --json task list --ready
overdo mcp
overdo ui --port 6969
overdo completions bash

# quality
bun run lint
bun run test

# focused suites
bun run unit
bun run integration
bun run e2e
bun run e2e:process
bun run e2e:process:chaos

# build
bun run build
```
