import { describe, expect, it } from "vitest";

import { runOpenCodeProcess, startOpenCodeProcess } from "../helpers/opencode-process.js";

const processE2E = process.env.RUN_OPENCODE_PROCESS_E2E === "1" ? it : it.skip;

describe("process e2e: crash isolation in parallel sessions", () => {
  processE2E("killing one session does not break another concurrent session", async () => {
    const toCrash = startOpenCodeProcess({
      label: "parallel-crash-a",
      workdir: process.cwd(),
      model: "opencode/gpt-5-nano",
      prompt: "Write 300 short numbered lines prefixed PARALLEL_A_ and finish with DONE."
    });

    const healthyPromise = runOpenCodeProcess({
      label: "parallel-healthy-b",
      workdir: process.cwd(),
      model: "opencode/gpt-5-nano",
      prompt: "Reply with exactly: PARALLEL_B_OK",
      timeoutMs: 90_000
    });

    await new Promise((resolve) => setTimeout(resolve, 1500));

    toCrash.kill("SIGKILL");
    const crashed = await toCrash.waitForExit();

    const healthy = await healthyPromise;

    expect(crashed.exitCode).not.toBe(0);
    expect(healthy.exitCode).toBe(0);
    expect(healthy.textParts.map((part) => part.trim())).toContain("PARALLEL_B_OK");
  }, 160_000);
});
