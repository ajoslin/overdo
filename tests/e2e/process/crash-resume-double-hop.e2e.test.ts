import { describe, expect, it } from "vitest";

import { exportOpenCodeSession, runOpenCodeProcess, startOpenCodeProcess } from "../helpers/opencode-process.js";

const processE2E = process.env.RUN_OPENCODE_PROCESS_E2E === "1" ? it : it.skip;

describe("process e2e: double crash resume", () => {
  processE2E("survives two crash/restart cycles on the same session", async () => {
    const seed = await runOpenCodeProcess({
      label: "double-hop-seed",
      workdir: process.cwd(),
      model: "opencode/gpt-5-nano",
      prompt: "Reply with exactly: DOUBLE_HOP_SEED_READY",
      timeoutMs: 90_000,
      retries: 0
    });
    expect(seed.exitCode).toBe(0);
    const sessionId = seed.sessionId;
    expect(sessionId).toBeTruthy();

    const first = startOpenCodeProcess({
      label: "double-hop-initial",
      workdir: process.cwd(),
      model: "opencode/gpt-5-nano",
      sessionId: sessionId!,
      prompt: "Write 300 short numbered lines prefixed DOUBLE_HOP_START_ and finish with DONE."
    });

    await new Promise((resolve) => setTimeout(resolve, 1500));

    first.kill("SIGKILL");
    const firstExit = await first.waitForExit();
    expect(firstExit.exitCode).not.toBe(0);

    const second = startOpenCodeProcess({
      label: "double-hop-second",
      workdir: process.cwd(),
      model: "opencode/gpt-5-nano",
      sessionId: sessionId!,
      prompt: "Write 300 short numbered lines prefixed DOUBLE_HOP_MIDDLE_ and finish with DONE."
    });

    await new Promise((resolve) => setTimeout(resolve, 1500));
    second.kill("SIGKILL");
    const secondExit = await second.waitForExit();
    expect(secondExit.exitCode).not.toBe(0);

    const final = await runOpenCodeProcess({
      label: "double-hop-final",
      workdir: process.cwd(),
      model: "opencode/gpt-5-nano",
      sessionId: sessionId!,
      prompt: "Reply with exactly: DOUBLE_HOP_RESUMED_OK",
      timeoutMs: 90_000,
      retries: 0
    });

    expect(final.exitCode).toBe(0);
    expect(final.sessionId).toBe(sessionId);
    const exported = exportOpenCodeSession(process.cwd(), sessionId!);
    const userPrompts = exported.messages
      .filter((message) => message.info.role === "user")
      .flatMap((message) => message.parts)
      .filter((part) => part.type === "text")
      .map((part) => part.text ?? "")
      .join("\n");

    expect(exported.messages.filter((message) => message.info.role === "user").length).toBeGreaterThanOrEqual(2);
    expect(userPrompts).toContain("DOUBLE_HOP_SEED_READY");
    expect(userPrompts).toContain("DOUBLE_HOP_RESUMED_OK");
  }, 260_000);
});
