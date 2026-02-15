import { describe, expect, it } from "vitest";

import { runOpenCodeProcess } from "../helpers/opencode-process.js";
import { resolveRepoRoot } from "../helpers/repo-root.js";

const processE2E = process.env.RUN_OPENCODE_PROCESS_E2E === "1" ? it : it.skip;

describe("process e2e: spawn three OpenCode workers", () => {
  processE2E("runs three workers concurrently without session collision", async () => {
    const repoRoot = resolveRepoRoot();
    const results = await Promise.all([
      runOpenCodeProcess({
        label: "triple-worker-a",
        workdir: repoRoot,
        model: "opencode/gpt-5-nano",
        prompt: "Reply with exactly: TRIPLE_A_READY",
        timeoutMs: 90_000,
        retries: 1
      }),
      runOpenCodeProcess({
        label: "triple-worker-b",
        workdir: repoRoot,
        model: "opencode/gpt-5-nano",
        prompt: "Reply with exactly: TRIPLE_B_READY",
        timeoutMs: 90_000,
        retries: 1
      }),
      runOpenCodeProcess({
        label: "triple-worker-c",
        workdir: repoRoot,
        model: "opencode/gpt-5-nano",
        prompt: "Reply with exactly: TRIPLE_C_READY",
        timeoutMs: 90_000,
        retries: 1
      })
    ]);

    for (const result of results) {
      expect(result.exitCode).toBe(0);
      expect(result.sessionId).toBeTruthy();
    }

    const sessionIds = new Set(results.map((result) => result.sessionId));
    expect(sessionIds.size).toBe(3);

    const flattened = results.flatMap((result) => result.textParts.map((part) => part.trim()));
    expect(flattened).toContain("TRIPLE_A_READY");
    expect(flattened).toContain("TRIPLE_B_READY");
    expect(flattened).toContain("TRIPLE_C_READY");
  }, 300_000);
});
