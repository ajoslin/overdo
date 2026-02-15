import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { runOpenCodeProcess, startOpenCodeProcess } from "../helpers/opencode-process.js";

const processE2E = process.env.RUN_OPENCODE_PROCESS_E2E === "1" ? it : it.skip;

describe("process e2e: crash and resume", () => {
  processE2E("kills a running OpenCode process and resumes same session", async () => {
    const live = startOpenCodeProcess({
      label: "crash-resume-initial",
      workdir: process.cwd(),
      model: "opencode/gpt-5-nano",
      prompt:
        "Write 120 short numbered lines saying RESUME_TEST_<n> and then finish with FINAL_LONG_OUTPUT_DONE.",
    });

    const sawSession = await live.waitForOutput((line) => line.includes('"sessionID":"'), 45_000);
    expect(sawSession).toBe(true);

    const sessionId = live.getSessionId();
    expect(sessionId).toBeTruthy();

    live.kill("SIGKILL");
    const exited = await live.waitForExit();
    expect(exited.exitCode).not.toBe(0);

    const resumed = await runOpenCodeProcess({
      label: "crash-resume-continue",
      workdir: process.cwd(),
      model: "opencode/gpt-5-nano",
      sessionId: sessionId!,
      prompt: "Reply with exactly: RESUMED_OK",
      timeoutMs: 90_000,
      retries: 0
    });

    expect(resumed.exitCode).toBe(0);
    expect(resumed.sessionId).toBe(sessionId);
    expect(resumed.textParts.join("\n")).toContain("RESUMED_OK");

    writeFileSync(
      join(resumed.artifactDir, "timeline.json"),
      JSON.stringify(
        {
          scenario: "crash-resume",
          runId: resumed.runId,
          initialRunId: live.runId,
          sessionId,
          checkpoints: ["saw-start-event", "killed-process", "resumed-session"],
          timings: {
            resumedDurationMs: resumed.durationMs
          }
        },
        null,
        2
      ),
      "utf8"
    );
  }, 140_000);
});
