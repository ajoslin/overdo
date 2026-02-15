import { describe, expect, it } from "vitest";

import { runOpenCodeProcess } from "../helpers/opencode-process.js";
import { resolveRepoRoot } from "../helpers/repo-root.js";

const processE2E = process.env.RUN_OPENCODE_PROCESS_E2E === "1" ? it : it.skip;

describe("process e2e: spawn single OpenCode", () => {
  processE2E("spawns OpenCode and returns deterministic response with cheap model", async () => {
    const repoRoot = resolveRepoRoot();
    const result = await runOpenCodeProcess({
      label: "single-worker-ready",
      workdir: repoRoot,
      model: "opencode/gpt-5-nano",
      prompt: "Reply with exactly: WORKER_ONE_READY",
      timeoutMs: 90_000,
      retries: 1
    });

    expect(result.exitCode).toBe(0);
    expect(result.sessionId).toBeTruthy();
    const normalized = result.textParts.map((part) => part.trim()).filter((part) => part.length > 0);
    expect(normalized).toContain("WORKER_ONE_READY");
    expect(result.durationMs).toBeLessThan(90_000);
  }, 220_000);
});
