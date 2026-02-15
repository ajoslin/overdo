# overdo-orchestrate

Execute Overdo task graphs to completion with validation loops.

Use when:

- Running a task tree end-to-end
- Recovering from failed attempts or restarts

## Bug Harvest Mode (Linear-first)

When running hardening/polish loops, use this strict sequence:

1. Synthesize bugs and taste/polish feedback from current implementation.
2. Open Linear issues for all discovered bugs in project `test-loop`.
   - Apply label `bug` to every generated bug issue.
3. Run `linear-bug-plan` on each issue.
4. Run `linear-bug-fix` on each issue **one at a time**:
   - create/switch to a fresh branch per issue
   - implement + validate
   - open PR
   - **switch back to `main` before starting next issue (critical)**
5. After bug PRs are open, process feature-request findings similarly and open PR(s) to base branch.
6. Stop active loop execution after PR creation and wait for human review.

Guardrails:

- If `linear-bug-plan` or issue status is `unknown`, do not auto-fix; label/escalate for manual triage.
- Do not run parallel fixes on the same base branch checkout.
- Persist issue -> branch -> PR mapping in evidence artifacts.

Workflow:

1. Fetch next ready task(s).
2. Dispatch worker claims with lease safety.
3. Run required validation gates.
4. Persist loop iteration result.
5. Retry/escalate based on policy.
6. Queue commit and finalize transaction.

## Exit rule for PR-driven loops

Once all intended PRs are opened, do **not** continue looping automatically.
Wait for review feedback, then resume via a new loop pass.

Rules:

- Never mutate orchestration state outside MCP.
- Always persist evidence for retries/escalations.
- Resume from SQLite state after crash before starting new work.
