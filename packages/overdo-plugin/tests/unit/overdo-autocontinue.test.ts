import { describe, expect, it } from "vitest";

import { createOverdoAutocontinue } from "../../src/overdo-autocontinue.js";

type PromptCall = { sessionID: string; text: string };

type MockCtx = {
  client: {
    session: {
      todo: () => Promise<{ data: Array<{ id: string; content: string; status: string }> }>;
      messages: () => Promise<{ data: Array<{ info?: { role?: string }; parts?: Array<{ text?: string }> }> }>;
      promptAsync: (args: { path: { id: string }; body: { parts: Array<{ type: string; text: string }> } }) => Promise<unknown>;
    };
  };
};

function createMockCtx(overrides?: {
  todos?: Array<{ id: string; content: string; status: string }>;
  messages?: Array<{ info?: { role?: string }; parts?: Array<{ text?: string }> }>;
}): {
  ctx: MockCtx;
  prompts: PromptCall[];
} {
  const prompts: PromptCall[] = [];
  const todos = overrides?.todos ?? [
    { id: "1", content: "Task A", status: "pending" },
    { id: "2", content: "Task B", status: "completed" }
  ];
  const messages = overrides?.messages ?? [
    { info: { role: "assistant" }, parts: [{ text: "Working on tasks" }] }
  ];
  const ctx: MockCtx = {
    client: {
      session: {
        todo: async () => ({ data: todos }),
        messages: async () => ({ data: messages }),
        promptAsync: async (args: { path: { id: string }; body: { parts: Array<{ type: string; text: string }> } }) => {
          prompts.push({ sessionID: args.path.id, text: args.body.parts[0].text });
          return {};
        }
      }
    }
  };
  return { ctx, prompts };
}

describe("overdo-autocontinue", () => {
  it("injects continuation on eligible idle", async () => {
    const { ctx, prompts } = createMockCtx();
    const hook = createOverdoAutocontinue(ctx, { idleThresholdMs: 0, cooldownMs: 0 });

    await hook.handler({ event: { type: "session.idle", properties: { sessionID: "s1" } } });

    expect(prompts).toHaveLength(1);
    expect(prompts[0].sessionID).toBe("s1");
    expect(prompts[0].text).toContain("Remaining tasks");
  });

  it("skips continuation when last assistant message asks a question", async () => {
    const { ctx, prompts } = createMockCtx({
      messages: [{ info: { role: "assistant" }, parts: [{ text: "Do you want me to proceed?" }] }]
    });
    const hook = createOverdoAutocontinue(ctx, { idleThresholdMs: 0, cooldownMs: 0 });

    await hook.handler({ event: { type: "session.idle", properties: { sessionID: "s2" } } });

    expect(prompts).toHaveLength(0);
  });

  it("stops after max attempts", async () => {
    const { ctx, prompts } = createMockCtx();
    const hook = createOverdoAutocontinue(ctx, { idleThresholdMs: 0, cooldownMs: 0, maxAttempts: 1 });

    await hook.handler({ event: { type: "session.idle", properties: { sessionID: "s3" } } });
    await hook.handler({ event: { type: "session.idle", properties: { sessionID: "s3" } } });

    expect(prompts).toHaveLength(1);
    expect(hook.isStopped("s3")).toBe(true);
  });
});
