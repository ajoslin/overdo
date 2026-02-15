import { describe, expect, it } from "vitest";

import { runOpenCodeProcess } from "../helpers/opencode-process.js";

const processE2E = process.env.RUN_OPENCODE_PROCESS_E2E === "1" ? it : it.skip;

describe("process e2e: spawn single OpenCode", () => {
  processE2E("spawns OpenCode and returns deterministic response with cheap model", async () => {
    const result = await runOpenCodeProcess({
      label: "single-worker-ready",
      workdir: process.cwd(),
      model: "opencode/gpt-5-nano",
      prompt: "Reply with exactly: WORKER_ONE_READY",
      timeoutMs: 90_000
    });

    expect(result.exitCode).toBe(0);
    expect(result.sessionId).toBeTruthy();
    const normalized = result.textParts.map((part) => part.trim()).filter((part) => part.length > 0);
    expect(normalized).toContain("WORKER_ONE_READY");
    expect(result.durationMs).toBeLessThan(90_000);
  }, 120_000);
});
