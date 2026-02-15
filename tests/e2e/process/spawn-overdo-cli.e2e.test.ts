import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

type CliRunResult = {
  exitCode: number;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
};

describe("process e2e: spawn overdo cli", () => {
  it("prints help and exits successfully", async () => {
    const result = await runOverdoCli(["--help"]);

    expect(result.exitCode).toBe(0);
    expect(result.signal).toBeNull();
    expect(result.stdout).toContain("overdo CLI");
    expect(result.stdout).toContain("overdo test [unit|integration|e2e|process|chaos]");
    expect(result.stdout).toContain(
      "overdo task <create|get|list|update|block|unblock|start|complete|reopen|delete|next-ready|search|progress>"
    );
    expect(result.stdout).toContain("overdo init");
    expect(result.stdout).toContain("overdo ui [--port <number>]");
    expect(result.stdout).toContain("overdo completions <bash|zsh|fish|powershell|elvish>");
    expect(result.stderr).toBe("");
  });

  it("prints version from package metadata", async () => {
    const result = await runOverdoCli(["--version"]);

    expect(result.exitCode).toBe(0);
    expect(result.signal).toBeNull();
    expect(result.stdout.trim()).toBe("0.1.0");
    expect(result.stderr).toBe("");
  });

  it("initializes database at explicit --db path with --json output", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "overdo-cli-init-"));
    const dbPath = join(tempDir, "custom", "tasks.db");
    try {
      const result = await runOverdoCli(["--json", "--db", dbPath, "init"]);

      expect(result.exitCode).toBe(0);
      expect(result.signal).toBeNull();
      expect(existsSync(dbPath)).toBe(true);
      const payload = JSON.parse(result.stdout) as { initialized: boolean; path: string };
      expect(payload.initialized).toBe(true);
      expect(payload.path).toBe(dbPath);
      expect(result.stderr).toBe("");
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("uses OVERDO_DB_PATH when --db is not provided", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "overdo-cli-envdb-"));
    const dbPath = join(tempDir, "env", "tasks.db");
    try {
      const initResult = await runOverdoCli(["--json", "init"], { env: { OVERDO_DB_PATH: dbPath } });
      expect(initResult.exitCode).toBe(0);
      expect(existsSync(dbPath)).toBe(true);

      const createResult = await runOverdoCli(["--json", "task", "create", "--id", "task_env", "-d", "Env task"], {
        env: { OVERDO_DB_PATH: dbPath }
      });
      expect(createResult.exitCode).toBe(0);
      const task = JSON.parse(createResult.stdout) as { id: string; title: string; status: string; priority: number };
      expect(task.id).toBe("task_env");
      expect(task.title).toBe("Env task");
      expect(task.status).toBe("pending");
      expect(task.priority).toBe(1);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("prints bash completion script", async () => {
    const result = await runOverdoCli(["completions", "bash"]);

    expect(result.exitCode).toBe(0);
    expect(result.signal).toBeNull();
    expect(result.stdout).toContain("complete -F _overdo overdo");
    expect(result.stderr).toBe("");
  });

  it("fails fast for unsupported completion shell", async () => {
    const result = await runOverdoCli(["completions", "tcsh"]);

    expect(result.exitCode).toBe(1);
    expect(result.signal).toBeNull();
    expect(result.stderr).toContain("Unsupported shell: tcsh");
  });

  it("prints ui command help", async () => {
    const result = await runOverdoCli(["ui", "--help"]);

    expect(result.exitCode).toBe(0);
    expect(result.signal).toBeNull();
    expect(result.stdout).toContain("overdo ui [--port <number>]");
    expect(result.stderr).toBe("");
  });

  it("supports task parity subset commands with json output", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "overdo-cli-task-"));
    const dbPath = join(tempDir, "state", "tasks.db");
    try {
      const initResult = await runOverdoCli(["--json", "--db", dbPath, "init"]);
      expect(initResult.exitCode).toBe(0);

      const createA = await runOverdoCli([
        "--json",
        "--db",
        dbPath,
        "task",
        "create",
        "--id",
        "task_alpha",
        "-d",
        "Alpha",
        "--priority",
        "0"
      ]);
      expect(createA.exitCode).toBe(0);
      const taskA = JSON.parse(createA.stdout) as { id: string; title: string; blockedBy: string[] };
      expect(taskA.id).toBe("task_alpha");
      expect(taskA.title).toBe("Alpha");
      expect(taskA.blockedBy).toEqual([]);

      const createB = await runOverdoCli([
        "--json",
        "--db",
        dbPath,
        "task",
        "create",
        "--id",
        "task_beta",
        "-d",
        "Beta"
      ]);
      expect(createB.exitCode).toBe(0);

      const updateB = await runOverdoCli([
        "--json",
        "--db",
        dbPath,
        "task",
        "update",
        "task_beta",
        "-d",
        "Beta updated",
        "--priority",
        "2"
      ]);
      expect(updateB.exitCode).toBe(0);
      const updatedB = JSON.parse(updateB.stdout) as { title: string; priority: number };
      expect(updatedB.title).toBe("Beta updated");
      expect(updatedB.priority).toBe(2);

      const block = await runOverdoCli(["--json", "--db", dbPath, "task", "block", "task_beta", "--by", "task_alpha"]);
      expect(block.exitCode).toBe(0);

      const searchBefore = await runOverdoCli(["--json", "--db", dbPath, "task", "search", "updated"]);
      expect(searchBefore.exitCode).toBe(0);
      const searchResults = JSON.parse(searchBefore.stdout) as Array<{ id: string }>;
      expect(searchResults.map((item) => item.id)).toEqual(["task_beta"]);

      const nextReady = await runOverdoCli(["--json", "--db", dbPath, "task", "next-ready"]);
      expect(nextReady.exitCode).toBe(0);
      const readyTask = JSON.parse(nextReady.stdout) as { id: string };
      expect(readyTask.id).toBe("task_alpha");

      const startA = await runOverdoCli(["--json", "--db", dbPath, "task", "start", "task_alpha"]);
      expect(startA.exitCode).toBe(0);
      const startedTask = JSON.parse(startA.stdout) as { status: string };
      expect(startedTask.status).toBe("running");

      const completeA = await runOverdoCli(["--json", "--db", dbPath, "task", "complete", "task_alpha"]);
      expect(completeA.exitCode).toBe(0);
      const completedTask = JSON.parse(completeA.stdout) as { status: string };
      expect(completedTask.status).toBe("done");

      const reopenA = await runOverdoCli(["--json", "--db", dbPath, "task", "reopen", "task_alpha"]);
      expect(reopenA.exitCode).toBe(0);
      const reopenedTask = JSON.parse(reopenA.stdout) as { status: string };
      expect(reopenedTask.status).toBe("pending");

      const unblock = await runOverdoCli(["--json", "--db", dbPath, "task", "unblock", "task_beta", "--by", "task_alpha"]);
      expect(unblock.exitCode).toBe(0);
      const unblocked = JSON.parse(unblock.stdout) as { blockedBy: string[] };
      expect(unblocked.blockedBy).toEqual([]);

      const readyList = await runOverdoCli(["--json", "--db", dbPath, "task", "list", "--ready"]);
      expect(readyList.exitCode).toBe(0);
      const readyItems = JSON.parse(readyList.stdout) as Array<{ id: string }>;
      expect(readyItems.map((item) => item.id)).toEqual(["task_alpha", "task_beta"]);

      const progress = await runOverdoCli(["--json", "--db", dbPath, "task", "progress"]);
      expect(progress.exitCode).toBe(0);
      const stats = JSON.parse(progress.stdout) as { total: number; completed: number; ready: number; blocked: number };
      expect(stats).toEqual({ total: 2, completed: 0, ready: 2, blocked: 0 });

      const deleteB = await runOverdoCli(["--json", "--db", dbPath, "task", "delete", "task_beta"]);
      expect(deleteB.exitCode).toBe(0);
      const deleted = JSON.parse(deleteB.stdout) as { deleted: boolean; id: string };
      expect(deleted).toEqual({ deleted: true, id: "task_beta" });

      const listAfterDelete = await runOverdoCli(["--json", "--db", dbPath, "task", "list"]);
      expect(listAfterDelete.exitCode).toBe(0);
      const remaining = JSON.parse(listAfterDelete.stdout) as Array<{ id: string }>;
      expect(remaining.map((item) => item.id)).toEqual(["task_alpha"]);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("fails task complete when task is not running", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "overdo-cli-task-fail-"));
    const dbPath = join(tempDir, "state", "tasks.db");
    try {
      await runOverdoCli(["--json", "--db", dbPath, "init"]);
      await runOverdoCli(["--json", "--db", dbPath, "task", "create", "--id", "task_x", "-d", "Task X"]);
      const result = await runOverdoCli(["--json", "--db", dbPath, "task", "complete", "task_x"]);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("task must be running to complete: task_x");
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("fails fast when test target is missing", async () => {
    const result = await runOverdoCli(["test"]);

    expect(result.exitCode).toBe(1);
    expect(result.signal).toBeNull();
    expect(result.stderr).toContain("Missing test target. Use one of: unit|integration|e2e|process|chaos");
  });

  it("fails fast for unknown test target", async () => {
    const result = await runOverdoCli(["test", "not-a-target"]);

    expect(result.exitCode).toBe(1);
    expect(result.signal).toBeNull();
    expect(result.stderr).toContain("Unknown test target: not-a-target");
  });

  it("prints help for unknown command", async () => {
    const result = await runOverdoCli(["does-not-exist"]);

    expect(result.exitCode).toBe(1);
    expect(result.signal).toBeNull();
    expect(result.stderr).toContain("Unknown command: does-not-exist");
    expect(result.stdout).toContain("overdo CLI");
  });
});

function runOverdoCli(
  args: string[],
  options: { timeoutMs?: number; env?: Record<string, string> } = {}
): Promise<CliRunResult> {
  const timeoutMs = options.timeoutMs ?? 10_000;
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [join(process.cwd(), "scripts", "overdo.mjs"), ...args], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        ...options.env,
        NO_COLOR: "1"
      },
      stdio: ["ignore", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });

    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
    }, timeoutMs);

    child.once("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });

    child.once("close", (exitCode, signal) => {
      clearTimeout(timeout);
      resolve({
        exitCode: exitCode ?? -1,
        signal,
        stdout,
        stderr
      });
    });
  });
}
