type SessionEvent = {
  type: string;
  properties?: Record<string, unknown>;
};

type SessionMessage = {
  info?: {
    id?: string;
    role?: string;
    error?: { name?: string };
    agent?: string;
  };
  parts?: Array<{ type?: string; text?: string }>;
};

type SessionTodo = {
  content: string;
  status: string;
  id: string;
};

type PluginInput = {
  client: {
    session: {
      todo: (args: { path: { id: string } }) => Promise<{ data?: SessionTodo[] } | SessionTodo[]>;
      messages: (args: { path: { id: string }; query?: { directory?: string } }) => Promise<{ data?: SessionMessage[] } | SessionMessage[]>;
      promptAsync: (args: {
        path: { id: string };
        body: { parts: Array<{ type: string; text: string }> };
        query?: { directory?: string };
      }) => Promise<unknown>;
    };
    tui?: {
      showToast?: (args: { body: { title: string; message: string; variant?: "warning" | "info"; duration?: number } }) => Promise<unknown>;
    };
  };
  directory?: string;
};

type AutocontinueConfig = {
  enabled?: boolean;
  idleThresholdMs?: number;
  cooldownMs?: number;
  maxAttempts?: number;
  abortWindowMs?: number;
  blockedOnHumanMarkers?: string[];
  stopOnQuestion?: boolean;
};

type AutocontinueState = {
  lastActivityAt?: number;
  lastInjectedAt?: number;
  attempts: number;
  stopped: boolean;
  abortDetectedAt?: number;
};

export type OverdoAutocontinue = {
  handler: (input: { event: SessionEvent }) => Promise<void>;
  stop: (sessionID: string) => void;
  resume: (sessionID: string) => void;
  isStopped: (sessionID: string) => boolean;
  shutdown: () => void;
};

const DEFAULTS: Required<Omit<AutocontinueConfig, "blockedOnHumanMarkers">> & {
  blockedOnHumanMarkers: string[];
} = {
  enabled: true,
  idleThresholdMs: 10_000,
  cooldownMs: 30_000,
  maxAttempts: 3,
  abortWindowMs: 3_000,
  stopOnQuestion: true,
  blockedOnHumanMarkers: [
    "waiting for",
    "please confirm",
    "review",
    "choose",
    "which option",
    "what do you want",
    "let me know",
    "do you want",
    "should i"
  ]
};

const CONTINUATION_PROMPT = [
  "[SYSTEM DIRECTIVE: OVERDO AUTOCONTINUE]",
  "Continue where you left off and finish remaining tasks.",
  "- Do not ask for permission",
  "- Mark tasks complete as you finish",
  "- Stop only when all tasks are done"
].join("\n");

export function createOverdoAutocontinue(ctx: PluginInput, config: AutocontinueConfig = {}): OverdoAutocontinue {
  const options = { ...DEFAULTS, ...config, blockedOnHumanMarkers: config.blockedOnHumanMarkers ?? DEFAULTS.blockedOnHumanMarkers };
  const sessions = new Map<string, AutocontinueState>();

  const getState = (sessionID: string): AutocontinueState => {
    const existing = sessions.get(sessionID);
    if (existing) return existing;
    const state: AutocontinueState = { attempts: 0, stopped: false };
    sessions.set(sessionID, state);
    return state;
  };

  const stop = (sessionID: string): void => {
    const state = getState(sessionID);
    state.stopped = true;
  };

  const resume = (sessionID: string): void => {
    const state = getState(sessionID);
    state.stopped = false;
  };

  const isStopped = (sessionID: string): boolean => getState(sessionID).stopped;

  const handler = async ({ event }: { event: SessionEvent }): Promise<void> => {
    const props = event.properties ?? {};
    const sessionID = (props.sessionID as string | undefined) ?? (props.info as { id?: string } | undefined)?.id;

    if (!sessionID) return;

    if (event.type === "session.deleted") {
      sessions.delete(sessionID);
      return;
    }

    if (event.type === "session.error") {
      const error = (props.error as { name?: string } | undefined)?.name;
      if (error === "AbortError" || error === "MessageAbortedError") {
        const state = getState(sessionID);
        state.abortDetectedAt = Date.now();
      }
      return;
    }

    if (event.type !== "session.idle") {
      const state = getState(sessionID);
      state.lastActivityAt = Date.now();
      return;
    }

    await handleIdle(sessionID, ctx, options, getState);
  };

  const shutdown = (): void => {
    sessions.clear();
  };

  return { handler, stop, resume, isStopped, shutdown };
}

async function handleIdle(
  sessionID: string,
  ctx: PluginInput,
  options: typeof DEFAULTS,
  getState: (sessionID: string) => AutocontinueState
): Promise<void> {
  if (!options.enabled) return;

  const state = getState(sessionID);
  if (state.stopped) return;

  const now = Date.now();
  if (state.abortDetectedAt && now - state.abortDetectedAt < options.abortWindowMs) return;
  if (state.lastActivityAt && now - state.lastActivityAt < options.idleThresholdMs) return;
  if (state.lastInjectedAt && now - state.lastInjectedAt < options.cooldownMs) return;
  if (state.attempts >= options.maxAttempts) {
    state.stopped = true;
    await safeToast(ctx, "Auto-continue stopped", `Max attempts (${options.maxAttempts}) reached.`);
    return;
  }

  const todos = await safeTodos(ctx, sessionID);
  if (!todos || todos.length === 0) return;
  const incomplete = todos.filter((todo) => todo.status !== "completed" && todo.status !== "cancelled");
  if (incomplete.length === 0) return;

  const lastAssistantText = await safeLastAssistantText(ctx, sessionID);
  if (options.stopOnQuestion && lastAssistantText) {
    const trimmed = lastAssistantText.trim();
    if (trimmed.endsWith("?")) return;
    const lowered = trimmed.toLowerCase();
    if (options.blockedOnHumanMarkers.some((marker) => lowered.includes(marker))) return;
  }

  const todoList = incomplete.map((todo) => `- [${todo.status}] ${todo.content}`).join("\n");
  const prompt = `${CONTINUATION_PROMPT}\n\nRemaining tasks:\n${todoList}`;

  await ctx.client.session.promptAsync({
    path: { id: sessionID },
    body: { parts: [{ type: "text", text: prompt }] },
    query: ctx.directory ? { directory: ctx.directory } : undefined
  });

  state.attempts += 1;
  state.lastInjectedAt = now;
}

async function safeTodos(ctx: PluginInput, sessionID: string): Promise<SessionTodo[] | null> {
  try {
    const resp = await ctx.client.session.todo({ path: { id: sessionID } });
    return (resp as { data?: SessionTodo[] }).data ?? (resp as SessionTodo[]);
  } catch {
    return null;
  }
}

async function safeLastAssistantText(ctx: PluginInput, sessionID: string): Promise<string | null> {
  try {
    const resp = await ctx.client.session.messages({
      path: { id: sessionID },
      query: ctx.directory ? { directory: ctx.directory } : undefined
    });
    const messages = (resp as { data?: SessionMessage[] }).data ?? (resp as SessionMessage[]);
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      const message = messages[i];
      if (message.info?.role !== "assistant") continue;
      const text = message.parts?.map((part) => part.text ?? "").join("") ?? "";
      return text;
    }
    return null;
  } catch {
    return null;
  }
}

async function safeToast(ctx: PluginInput, title: string, message: string): Promise<void> {
  if (!ctx.client.tui?.showToast) return;
  try {
    await ctx.client.tui.showToast({
      body: {
        title,
        message,
        variant: "warning",
        duration: 1_500
      }
    });
  } catch {
    return;
  }
}
