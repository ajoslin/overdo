import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { runOpenCodeProcess } from "../helpers/opencode-process.js";

const processE2E = process.env.RUN_OPENCODE_PROCESS_E2E === "1" ? it : it.skip;

describe("process e2e: artifact contract", () => {
  processE2E("writes required artifact files with runId and result fields", async () => {
    const result = await runOpenCodeProcess({
      label: "artifact-contract",
      workdir: process.cwd(),
      model: "opencode/gpt-5-nano",
      prompt: "Reply with exactly: ARTIFACT_OK",
      timeoutMs: 90_000,
      retries: 1
    });

    const stdoutPath = join(result.artifactDir, "process-stdout.log");
    const stderrPath = join(result.artifactDir, "process-stderr.log");
    const assertionsPath = join(result.artifactDir, "assertions.json");

    expect(existsSync(stdoutPath)).toBe(true);
    expect(existsSync(stderrPath)).toBe(true);
    expect(existsSync(assertionsPath)).toBe(true);

    const assertions = JSON.parse(readFileSync(assertionsPath, "utf8")) as {
      runId: string;
      scenario: string;
      result: string;
      sessionId: string | null;
    };
    expect(assertions.scenario).toBe("artifact-contract");
    expect(assertions.runId).toBeTruthy();
    expect(assertions.result).toBe("pass");
    expect(assertions.sessionId).toBeTruthy();
  }, 180_000);
});
