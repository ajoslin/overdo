# Process E2E Harness Evidence - 2026-02-14

## Scope

Validated OpenCode process-level harness behavior with deterministic/gated tests and dedicated process suite.

## Implemented Harness

- Helper: `tests/e2e/helpers/opencode-process.ts`
  - chunk-safe JSONL parsing
  - race-safe process exit handling
  - artifact output (`process-stdout.log`, `process-stderr.log`, `assertions.json`)
- Dedicated script: `npm run e2e:process`
  - `RUN_OPENCODE_PROCESS_E2E=1`
  - single worker execution for stability (`--maxWorkers=1`)

## Process Scenarios Covered

- `tests/e2e/process/spawn-single-opencode.e2e.test.ts`
  - single worker spawn + deterministic reply
- `tests/e2e/process/spawn-multi-opencode.e2e.test.ts`
  - two-worker parallel spawn + session isolation
- `tests/e2e/process/spawn-three-opencode.e2e.test.ts`
  - three-worker concurrent spawn + no session collision
- `tests/e2e/process/crash-resume-opencode.e2e.test.ts`
  - forced kill + resume same session
- `tests/e2e/process/session-state-preserved.e2e.test.ts`
  - same-session continuation and memory check
- `tests/e2e/process/crash-resume-double-hop.e2e.test.ts`
  - two crash cycles on same session + resumed continuation validated via session export
- `tests/e2e/process/crash-isolation-parallel.e2e.test.ts`
  - one killed process does not block a concurrent healthy process
- `tests/e2e/process/artifact-contract.e2e.test.ts`
  - verifies required artifact files and assertion fields exist per run

## Validation Results

- `npm run e2e:process` passed: 8/8 process tests.
- `npm run e2e` passed with process tests gated by env var.
- `npm test`, `npm run lint`, and `npm run build` pass.

## Notes

- Process tests are env-gated to keep default CI deterministic and independent of OpenCode model/runtime availability.
- Process suite artifacts are emitted under `artifacts/e2e/<scenario>/<runId>/`.
