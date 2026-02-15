import { describe, expect, it } from "vitest";

import { runOpenCodeProcess } from "../helpers/opencode-process.js";

const processE2E = process.env.RUN_OPENCODE_PROCESS_E2E === "1" ? it : it.skip;

describe("process e2e: session state preservation", () => {
  processE2E("continues same session and preserves prompt memory", async () => {
    const initial = await runOpenCodeProcess({
      label: "session-state-initial",
      workdir: process.cwd(),
      model: "opencode/gpt-5-nano",
      prompt: "Remember TOKEN_42ZX. Reply exactly: STORED_TOKEN",
      timeoutMs: 90_000
    });

    expect(initial.exitCode).toBe(0);
    expect(initial.sessionId).toBeTruthy();
    expect(initial.textParts.map((part) => part.trim())).toContain("STORED_TOKEN");

    const followup = await runOpenCodeProcess({
      label: "session-state-followup",
      workdir: process.cwd(),
      model: "opencode/gpt-5-nano",
      sessionId: initial.sessionId!,
      prompt: "What token did I ask you to remember? Reply exactly: TOKEN:TOKEN_42ZX",
      timeoutMs: 90_000
    });

    expect(followup.exitCode).toBe(0);
    expect(followup.sessionId).toBe(initial.sessionId);
    expect(followup.textParts.map((part) => part.trim())).toContain("TOKEN:TOKEN_42ZX");
  }, 120_000);
});
