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
npm install
```

## Basic CLI usage

```bash
# quality
npm run lint
npm test

# focused suites
npm run unit
npm run integration
npm run e2e
npm run e2e:process
npm run e2e:process:chaos

# build
npm run build
```
