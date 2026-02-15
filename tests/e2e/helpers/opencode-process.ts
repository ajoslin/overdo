import { spawn, type ChildProcess } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export type OpenCodeRunResult = {
  runId: string;
  sessionId: string | null;
  exitCode: number;
  signal: NodeJS.Signals | null;
  durationMs: number;
  textParts: string[];
  stdoutLines: string[];
  stderrLines: string[];
  artifactDir: string;
};

export type OpenCodeLiveProcess = {
  child: ChildProcess;
  runId: string;
  stdoutLines: string[];
  stderrLines: string[];
  textParts: string[];
  getSessionId: () => string | null;
  waitForOutput: (predicate: (line: string) => boolean, timeoutMs?: number) => Promise<boolean>;
  kill: (signal?: NodeJS.Signals) => void;
  waitForExit: () => Promise<{ exitCode: number; signal: NodeJS.Signals | null }>;
  artifactDir: string;
};

export async function runOpenCodeProcess(input: {
  prompt: string;
  sessionId?: string;
  model?: string;
  timeoutMs?: number;
  workdir: string;
  label: string;
}): Promise<OpenCodeRunResult> {
  const runId = `${input.label}-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
  const artifactDir = join(input.workdir, "artifacts", "e2e", input.label, runId);
  mkdirSync(artifactDir, { recursive: true });

  const args = buildRunArgs(input.prompt, input.model, input.sessionId);

  const startedAt = Date.now();
  const child = spawn("opencode", args, {
    cwd: input.workdir,
    env: {
      ...process.env,
      NO_COLOR: "1"
    },
    stdio: ["ignore", "pipe", "pipe"]
  });

  const stdoutLines: string[] = [];
  const stderrLines: string[] = [];
  const textParts: string[] = [];
  let sessionId: string | null = null;
  let stdoutBuffer = "";
  let stderrBuffer = "";

  child.stdout.setEncoding("utf8");
  child.stdout.on("data", (chunk: string) => {
    stdoutBuffer += chunk;
    const lines = stdoutBuffer.split("\n");
    stdoutBuffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line) {
        continue;
      }
      stdoutLines.push(line);
      try {
        const event = JSON.parse(line) as {
          sessionID?: string;
          type?: string;
          part?: { text?: string };
        };
        if (event.sessionID) {
          sessionId = event.sessionID;
        }
        if (event.type === "text" && event.part?.text) {
          textParts.push(event.part.text);
        }
      } catch {
        // keep raw line for debugging
      }
    }
  });

  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk: string) => {
    stderrBuffer += chunk;
    const lines = stderrBuffer.split("\n");
    stderrBuffer = lines.pop() ?? "";
    stderrLines.push(...lines.filter(Boolean));
  });

  const timeoutMs = input.timeoutMs ?? 60_000;
  const timeout = setTimeout(() => {
    child.kill("SIGKILL");
  }, timeoutMs);

  const finished = await new Promise<{ exitCode: number; signal: NodeJS.Signals | null }>((resolve) => {
    child.on("close", (exitCode, signal) => {
      resolve({ exitCode: exitCode ?? -1, signal });
    });
  });
  clearTimeout(timeout);

  const durationMs = Date.now() - startedAt;
  if (stdoutBuffer.length > 0) {
    stdoutLines.push(stdoutBuffer);
  }
  if (stderrBuffer.length > 0) {
    stderrLines.push(stderrBuffer);
  }
  writeFileSync(join(artifactDir, "process-stdout.log"), `${stdoutLines.join("\n")}\n`, "utf8");
  writeFileSync(join(artifactDir, "process-stderr.log"), `${stderrLines.join("\n")}\n`, "utf8");
  writeFileSync(
    join(artifactDir, "assertions.json"),
    JSON.stringify(
      {
        scenario: input.label,
        runId,
        sessionId,
        timings: { durationMs },
        result: finished.exitCode === 0 ? "pass" : "fail",
        textParts
      },
      null,
      2
    ),
    "utf8"
  );

  return {
    runId,
    sessionId,
    exitCode: finished.exitCode,
    signal: finished.signal,
    durationMs,
    textParts,
    stdoutLines,
    stderrLines,
    artifactDir
  };
}

export function startOpenCodeProcess(input: {
  prompt: string;
  sessionId?: string;
  model?: string;
  workdir: string;
  label: string;
}): OpenCodeLiveProcess {
  const runId = `${input.label}-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
  const artifactDir = join(input.workdir, "artifacts", "e2e", input.label, runId);
  mkdirSync(artifactDir, { recursive: true });

  const args = buildRunArgs(input.prompt, input.model, input.sessionId);
  const child = spawn("opencode", args, {
    cwd: input.workdir,
    env: {
      ...process.env,
      NO_COLOR: "1"
    },
    stdio: ["ignore", "pipe", "pipe"]
  });

  const stdoutLines: string[] = [];
  const stderrLines: string[] = [];
  const textParts: string[] = [];
  let sessionId: string | null = input.sessionId ?? null;
  let stdoutBuffer = "";
  let stderrBuffer = "";

  child.stdout.setEncoding("utf8");
  child.stdout.on("data", (chunk: string) => {
    stdoutBuffer += chunk;
    const lines = stdoutBuffer.split("\n");
    stdoutBuffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line) {
        continue;
      }
      stdoutLines.push(line);
      try {
        const event = JSON.parse(line) as {
          sessionID?: string;
          type?: string;
          part?: { text?: string };
        };
        if (event.sessionID) {
          sessionId = event.sessionID;
        }
        if (event.type === "text" && event.part?.text) {
          textParts.push(event.part.text);
        }
      } catch {
        // ignore non-json lines
      }
    }
  });

  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk: string) => {
    stderrBuffer += chunk;
    const lines = stderrBuffer.split("\n");
    stderrBuffer = lines.pop() ?? "";
    stderrLines.push(...lines.filter(Boolean));
  });

  const exitPromise = new Promise<{ exitCode: number; signal: NodeJS.Signals | null }>((resolve, reject) => {
    child.once("error", reject);
    child.once("close", (exitCode, signal) => {
      if (stdoutBuffer.length > 0) {
        stdoutLines.push(stdoutBuffer);
      }
      if (stderrBuffer.length > 0) {
        stderrLines.push(stderrBuffer);
      }
      writeFileSync(join(artifactDir, "process-stdout.log"), `${stdoutLines.join("\n")}\n`, "utf8");
      writeFileSync(join(artifactDir, "process-stderr.log"), `${stderrLines.join("\n")}\n`, "utf8");
      resolve({ exitCode: exitCode ?? -1, signal });
    });
  });

  return {
    child,
    runId,
    stdoutLines,
    stderrLines,
    textParts,
    getSessionId: () => sessionId,
    waitForOutput: async (predicate, timeoutMs = 10_000) => {
      const startedAt = Date.now();
      while (Date.now() - startedAt < timeoutMs) {
        if (stdoutLines.some(predicate) || stderrLines.some(predicate)) {
          return true;
        }
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      return false;
    },
    kill: (signal = "SIGKILL") => {
      child.kill(signal);
    },
    waitForExit: () => exitPromise,
    artifactDir
  };
}

function buildRunArgs(prompt: string, model?: string, sessionId?: string): string[] {
  const args = ["run", "--format", "json", "--model", model ?? "opencode/gpt-5-nano"];
  if (sessionId) {
    args.push("--session", sessionId);
  }
  args.push(prompt);
  return args;
}
