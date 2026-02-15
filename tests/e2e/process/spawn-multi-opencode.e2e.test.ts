import { describe, expect, it } from "vitest";

import { runOpenCodeProcess } from "../helpers/opencode-process.js";

const processE2E = process.env.RUN_OPENCODE_PROCESS_E2E === "1" ? it : it.skip;

describe("process e2e: spawn multiple OpenCode workers", () => {
  processE2E("runs two workers in parallel with independent outputs", async () => {
    const [workerA, workerB] = await Promise.all([
      runOpenCodeProcess({
        label: "multi-worker-a",
        workdir: process.cwd(),
        model: "opencode/gpt-5-nano",
        prompt: "Reply with exactly: WORKER_A_READY",
        timeoutMs: 90_000,
        retries: 1
      }),
      runOpenCodeProcess({
        label: "multi-worker-b",
        workdir: process.cwd(),
        model: "opencode/gpt-5-nano",
        prompt: "Reply with exactly: WORKER_B_READY",
        timeoutMs: 90_000,
        retries: 1
      })
    ]);

    expect(workerA.exitCode).toBe(0);
    expect(workerB.exitCode).toBe(0);
    expect(workerA.sessionId).toBeTruthy();
    expect(workerB.sessionId).toBeTruthy();
    expect(workerA.sessionId).not.toBe(workerB.sessionId);
    const normalizedA = workerA.textParts.map((part) => part.trim()).filter((part) => part.length > 0);
    const normalizedB = workerB.textParts.map((part) => part.trim()).filter((part) => part.length > 0);
    expect(normalizedA).toContain("WORKER_A_READY");
    expect(normalizedB).toContain("WORKER_B_READY");
  }, 240_000);
});
