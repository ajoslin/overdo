#!/usr/bin/env node

import { mkdirSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const parsed = parseGlobalFlags(process.argv.slice(2));
const args = parsed.positionals;
const cmd = args[0] ?? "help";

if (parsed.version) {
  printVersion();
  process.exit(0);
}

if (cmd === "help" || cmd === "--help" || cmd === "-h") {
  printHelp();
  process.exit(0);
}

if (cmd === "init") {
  const dbPath = parsed.db ?? defaultDbPath();
  initDatabase(dbPath);
  if (parsed.json) {
    console.log(JSON.stringify({ initialized: true, path: dbPath }));
  } else {
    console.log(`Initialized Overdo database at ${dbPath}`);
  }
  process.exit(0);
}

if (cmd === "test") {
  const target = args[1];
  const mapping = {
    unit: ["npm", ["run", "unit"]],
    integration: ["npm", ["run", "integration"]],
    e2e: ["npm", ["run", "e2e"]],
    process: ["npm", ["run", "e2e:process"]],
    chaos: ["npm", ["run", "e2e:process:chaos"]]
  };
  if (!target) {
    console.error("Missing test target. Use one of: unit|integration|e2e|process|chaos");
    process.exit(1);
  }
  if (!(target in mapping)) {
    console.error(`Unknown test target: ${target}`);
    process.exit(1);
  }
  runCommand(...mapping[target]);
  process.exit(0);
}

if (cmd === "task") {
  const taskArgs = args.slice(1);
  const dbPath = parsed.db ?? defaultDbPath();
  try {
    const result = runTaskCommand(taskArgs, dbPath);
    if (parsed.json) {
      console.log(JSON.stringify(result));
    } else {
      printTaskResult(result);
    }
    process.exit(0);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

if (cmd === "mcp") {
  runCommand(process.execPath, [join(__dirname, "overdo-mcp-server.mjs")]);
  process.exit(0);
}

if (cmd === "ui") {
  const uiArgs = args.slice(1);
  if (uiArgs.includes("--help") || uiArgs.includes("-h")) {
    printUiHelp();
    process.exit(0);
  }
  const port = parseUiPort(uiArgs);
  const forwarded = [join(__dirname, "overdo-ui-server.mjs"), "--port", String(port), "--db", parsed.db ?? defaultDbPath()];
  runCommand(process.execPath, forwarded);
  process.exit(0);
}

if (cmd === "completions") {
  const shell = args[1];
  if (!shell) {
    console.error("Missing shell. Use one of: bash|zsh|fish|powershell|elvish");
    process.exit(1);
  }
  const script = getCompletionScript(shell);
  if (!script) {
    console.error(`Unsupported shell: ${shell}`);
    process.exit(1);
  }
  process.stdout.write(script);
  if (!script.endsWith("\n")) {
    process.stdout.write("\n");
  }
  process.exit(0);
}

if (cmd === "install" && args[1] === "opencode") {
  runCommand(process.execPath, [join(__dirname, "install-opencode.mjs")]);
  process.exit(0);
}

console.error(`Unknown command: ${cmd}`);
printHelp();
process.exit(1);

function runCommand(bin, argv) {
  const result = spawnSync(bin, argv, {
    cwd: process.cwd(),
    stdio: "inherit",
    env: process.env
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function printHelp() {
  console.log(`overdo CLI\n\nGlobal options:\n  --help\n  --version\n  --json\n  --db <path>\n\nEnvironment:\n  OVERDO_DB_PATH (used when --db is not provided)\n\nCommands:\n  overdo init\n  overdo test [unit|integration|e2e|process|chaos]\n  overdo task <create|get|list|update|block|unblock|start|complete|reopen|delete|next-ready|search|progress>\n  overdo mcp\n  overdo ui [--port <number>]\n  overdo completions <bash|zsh|fish|powershell|elvish>\n  overdo install opencode`);
}

function printUiHelp() {
  console.log("overdo ui [--port <number>]");
}

function printVersion() {
  const packageJsonPath = join(__dirname, "..", "package.json");
  const pkg = JSON.parse(readFileSync(packageJsonPath, "utf8"));
  console.log(pkg.version ?? "0.0.0");
}

function parseGlobalFlags(argv) {
  const out = {
    json: false,
    db: null,
    version: false,
    positionals: []
  };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--json") {
      out.json = true;
      continue;
    }
    if (token === "--version" || token === "-V") {
      out.version = true;
      continue;
    }
    if (token === "--db") {
      const next = argv[i + 1];
      if (!next) {
        console.error("Missing value for --db");
        process.exit(1);
      }
      out.db = next;
      i += 1;
      continue;
    }
    out.positionals.push(token);
  }
  return out;
}

function defaultDbPath() {
  if (process.env.OVERDO_DB_PATH) {
    return process.env.OVERDO_DB_PATH;
  }
  return join(process.cwd(), ".overdo", "tasks.db");
}

function initDatabase(dbPath) {
  mkdirSync(dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  try {
    for (const statement of schemaStatements()) {
      db.exec(statement);
    }
  } finally {
    db.close();
  }
}

function schemaStatements() {
  return [
    "create table if not exists tasks (id text primary key, title text not null, status text not null default 'pending' check (status in ('pending','running','done')), priority integer not null default 1 check (priority between 0 and 2), created_at text not null, updated_at text not null);",
    "create table if not exists task_dependencies (task_id text not null, depends_on text not null, primary key (task_id, depends_on));",
    "create table if not exists events (id integer primary key autoincrement, task_id text not null, event_type text not null, payload text not null, idempotency_key text not null unique, correlation_id text, source text not null default 'mcp', created_at text not null);",
    "create table if not exists task_attempts (id integer primary key autoincrement, task_id text not null, status text not null, created_at text not null);",
    "create table if not exists loop_definitions (task_id text primary key, required_gates text not null, never_give_up integer not null default 1, max_attempts integer not null default 5 check (max_attempts > 0));",
    "create table if not exists loop_runs (id integer primary key autoincrement, task_id text not null, run_status text not null, contract_snapshot text not null default '{}', created_at text not null);",
    "create table if not exists loop_iterations (id integer primary key autoincrement, run_id integer not null, task_id text not null, attempt integer not null, gate_results text not null, failure_class text, decision text not null, artifact text not null default '{}', created_at text not null, foreign key(run_id) references loop_runs(id));",
    "create table if not exists task_leases (task_id text primary key, owner text not null, expires_at text not null);",
    "create table if not exists path_leases (path text primary key, owner text not null, expires_at text not null);",
    "create table if not exists env_locks (name text primary key, owner text not null, expires_at text not null);",
    "create table if not exists commit_queue (id integer primary key autoincrement, task_id text not null, status text not null, summary text not null default '', manifest_json text not null default '{}', base_revision text, current_revision text, created_at text not null);",
    "create table if not exists commit_transactions (id integer primary key autoincrement, task_id text not null, commit_sha text, created_at text not null);",
    "create index if not exists idx_tasks_status_priority on tasks(status, priority, created_at, id);",
    "create index if not exists idx_dependencies_task on task_dependencies(task_id);",
    "create index if not exists idx_events_task on events(task_id, id);",
    "create index if not exists idx_events_correlation on events(correlation_id, id);",
    "create index if not exists idx_leases_expiry on task_leases(expires_at);",
    "create index if not exists idx_path_leases_expiry on path_leases(expires_at);",
    "create index if not exists idx_commit_queue_status on commit_queue(status, id);",
    "create index if not exists idx_loop_iterations_run_attempt on loop_iterations(run_id, attempt);"
  ];
}

function parseUiPort(args) {
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === "--port" || args[i] === "-p") {
      const raw = args[i + 1];
      if (!raw) {
        console.error("Missing value for --port");
        process.exit(1);
      }
      const parsed = Number(raw);
      if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 65535) {
        console.error(`Invalid port: ${raw}`);
        process.exit(1);
      }
      return parsed;
    }
  }
  return 6969;
}

function getCompletionScript(shell) {
  const scripts = {
    bash: "_overdo() {\n  local cur\n  cur=\"${COMP_WORDS[COMP_CWORD]}\"\n  COMPREPLY=( $(compgen -W \"help init test task mcp ui completions install\" -- \"$cur\") )\n}\ncomplete -F _overdo overdo",
    zsh: "#compdef overdo\n_arguments '1:command:(help init test task mcp ui completions install)'",
    fish: "complete -c overdo -f -a 'help init test task mcp ui completions install'",
    powershell:
      "Register-ArgumentCompleter -Native -CommandName overdo -ScriptBlock { param($wordToComplete) 'help','init','test','task','mcp','ui','completions','install' | Where-Object { $_ -like \"$wordToComplete*\" } | ForEach-Object { [System.Management.Automation.CompletionResult]::new($_, $_, 'ParameterValue', $_) } }",
    elvish: "set edit:completion:arg-completer[overdo] = {|@words| put help init test task mcp ui completions install }"
  };
  return scripts[shell] ?? null;
}

function runTaskCommand(taskArgs, dbPath) {
  const action = taskArgs[0];
  if (!action) {
    throw new Error(
      "Missing task action. Use one of: create|get|list|update|block|unblock|start|complete|reopen|delete|next-ready|search|progress"
    );
  }

  initDatabase(dbPath);
  const db = new DatabaseSync(dbPath);
  try {
    if (action === "create") {
      const description = readFlag(taskArgs, ["--description", "-d"]);
      if (!description) {
        throw new Error("Missing required flag: --description");
      }
      const id = readFlag(taskArgs, ["--id"]) ?? createTaskId();
      const priorityRaw = readFlag(taskArgs, ["--priority"]);
      const priority = priorityRaw ? Number(priorityRaw) : 1;
      if (!Number.isInteger(priority) || priority < 0 || priority > 2) {
        throw new Error(`Invalid priority: ${priorityRaw}`);
      }
      const now = new Date().toISOString();
      db.prepare("insert into tasks (id, title, status, priority, created_at, updated_at) values (?, ?, 'pending', ?, ?, ?)").run(
        id,
        description,
        priority,
        now,
        now
      );
      return readTask(db, id);
    }

    if (action === "get") {
      const id = taskArgs[1];
      if (!id) {
        throw new Error("Missing task id");
      }
      return readTask(db, id);
    }

    if (action === "update") {
      const id = taskArgs[1];
      if (!id) {
        throw new Error("Missing task id");
      }
      assertTaskExists(db, id);
      const description = readFlag(taskArgs, ["--description", "-d"]);
      const priorityRaw = readFlag(taskArgs, ["--priority"]);
      const updates = [];
      const values = [];
      if (description) {
        updates.push("title = ?");
        values.push(description);
      }
      if (priorityRaw !== null) {
        const priority = Number(priorityRaw);
        if (!Number.isInteger(priority) || priority < 0 || priority > 2) {
          throw new Error(`Invalid priority: ${priorityRaw}`);
        }
        updates.push("priority = ?");
        values.push(priority);
      }
      if (updates.length === 0) {
        throw new Error("No update fields provided. Use --description and/or --priority");
      }
      updates.push("updated_at = ?");
      values.push(new Date().toISOString());
      values.push(id);
      db.prepare(`update tasks set ${updates.join(", ")} where id = ?`).run(...values);
      return readTask(db, id);
    }

    if (action === "list") {
      const ready = hasFlag(taskArgs, "--ready");
      const completed = hasFlag(taskArgs, "--completed");
      if (ready && completed) {
        throw new Error("--ready and --completed cannot be used together");
      }
      let rows;
      if (completed) {
        rows = db.prepare("select id from tasks where status = 'done' order by priority asc, created_at asc, id asc").all();
      } else if (ready) {
        rows = db
          .prepare(
            "select t.id as id from tasks t where t.status != 'done' and not exists (select 1 from task_dependencies td join tasks dep on dep.id = td.depends_on where td.task_id = t.id and dep.status != 'done') order by t.priority asc, t.created_at asc, t.id asc"
          )
          .all();
      } else {
        rows = db.prepare("select id from tasks order by priority asc, created_at asc, id asc").all();
      }
      return rows.map((row) => readTask(db, row.id));
    }

    if (action === "block") {
      const id = taskArgs[1];
      const by = readFlag(taskArgs, ["--by"]);
      if (!id) {
        throw new Error("Missing task id");
      }
      if (!by) {
        throw new Error("Missing required flag: --by");
      }
      if (id === by) {
        throw new Error("task cannot depend on itself");
      }
      assertTaskExists(db, id);
      assertTaskExists(db, by);
      db.prepare("insert or ignore into task_dependencies (task_id, depends_on) values (?, ?)").run(id, by);
      if (wouldCreateCycle(db, id)) {
        db.prepare("delete from task_dependencies where task_id = ? and depends_on = ?").run(id, by);
        throw new Error("dependency cycle detected");
      }
      return readTask(db, id);
    }

    if (action === "unblock") {
      const id = taskArgs[1];
      const by = readFlag(taskArgs, ["--by"]);
      if (!id) {
        throw new Error("Missing task id");
      }
      if (!by) {
        throw new Error("Missing required flag: --by");
      }
      assertTaskExists(db, id);
      db.prepare("delete from task_dependencies where task_id = ? and depends_on = ?").run(id, by);
      return readTask(db, id);
    }

    if (action === "start") {
      const id = taskArgs[1];
      if (!id) {
        throw new Error("Missing task id");
      }
      const task = readTask(db, id);
      if (task.status !== "pending") {
        throw new Error(`task must be pending to start: ${id}`);
      }
      if (!isReady(db, id)) {
        throw new Error(`task is blocked and cannot transition to running: ${id}`);
      }
      db.prepare("update tasks set status = 'running', updated_at = ? where id = ?").run(new Date().toISOString(), id);
      return readTask(db, id);
    }

    if (action === "complete") {
      const id = taskArgs[1];
      if (!id) {
        throw new Error("Missing task id");
      }
      const task = readTask(db, id);
      if (task.status !== "running") {
        throw new Error(`task must be running to complete: ${id}`);
      }
      db.prepare("update tasks set status = 'done', updated_at = ? where id = ?").run(new Date().toISOString(), id);
      return readTask(db, id);
    }

    if (action === "reopen") {
      const id = taskArgs[1];
      if (!id) {
        throw new Error("Missing task id");
      }
      const task = readTask(db, id);
      if (task.status !== "done") {
        throw new Error(`task must be done to reopen: ${id}`);
      }
      db.prepare("update tasks set status = 'pending', updated_at = ? where id = ?").run(new Date().toISOString(), id);
      return readTask(db, id);
    }

    if (action === "delete") {
      const id = taskArgs[1];
      if (!id) {
        throw new Error("Missing task id");
      }
      assertTaskExists(db, id);
      db.prepare("delete from task_dependencies where task_id = ? or depends_on = ?").run(id, id);
      db.prepare("delete from tasks where id = ?").run(id);
      return { deleted: true, id };
    }

    if (action === "next-ready") {
      const row = db
        .prepare(
          "select t.id as id from tasks t where t.status = 'pending' and not exists (select 1 from task_dependencies td join tasks dep on dep.id = td.depends_on where td.task_id = t.id and dep.status != 'done') order by t.priority asc, t.created_at asc, t.id asc limit 1"
        )
        .get();
      if (!row) {
        return null;
      }
      return readTask(db, row.id);
    }

    if (action === "search") {
      const query = taskArgs.slice(1).join(" ").trim();
      if (!query) {
        throw new Error("Missing search query");
      }
      const rows = db
        .prepare("select id from tasks where lower(title) like lower(?) order by priority asc, created_at asc, id asc")
        .all(`%${query}%`);
      return rows.map((row) => readTask(db, row.id));
    }

    if (action === "progress") {
      const totals = db
        .prepare(
          "select count(*) as total, sum(case when status = 'done' then 1 else 0 end) as completed from tasks"
        )
        .get();
      const ready = Number(
        db
          .prepare(
            "select count(*) as count from tasks t where t.status != 'done' and not exists (select 1 from task_dependencies td join tasks dep on dep.id = td.depends_on where td.task_id = t.id and dep.status != 'done')"
          )
          .get().count
      );
      const total = Number(totals.total ?? 0);
      const completed = Number(totals.completed ?? 0);
      const blocked = Math.max(total - completed - ready, 0);
      return { total, completed, ready, blocked };
    }

    throw new Error(`Unknown task action: ${action}`);
  } finally {
    db.close();
  }
}

function readTask(db, id) {
  const row = db.prepare("select id, title, status, priority from tasks where id = ?").get(id);
  if (!row) {
    throw new Error(`task not found: ${id}`);
  }
  const blockedBy = db.prepare("select depends_on from task_dependencies where task_id = ? order by depends_on asc").all(id);
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    priority: row.priority,
    blockedBy: blockedBy.map((item) => item.depends_on)
  };
}

function assertTaskExists(db, id) {
  const found = db.prepare("select id from tasks where id = ?").get(id);
  if (!found) {
    throw new Error(`task not found: ${id}`);
  }
}

function wouldCreateCycle(db, taskId) {
  return dependsOnTask(db, taskId, taskId, new Set());
}

function dependsOnTask(db, sourceTask, targetTask, seen) {
  if (seen.has(sourceTask)) {
    return false;
  }
  seen.add(sourceTask);
  const direct = db.prepare("select depends_on from task_dependencies where task_id = ?").all(sourceTask);
  for (const item of direct) {
    if (item.depends_on === targetTask) {
      return true;
    }
    if (dependsOnTask(db, item.depends_on, targetTask, seen)) {
      return true;
    }
  }
  return false;
}

function createTaskId() {
  return `task_${Date.now().toString(36)}${Math.floor(Math.random() * 1_000_000).toString(36)}`;
}

function readFlag(args, names) {
  for (let i = 0; i < args.length; i += 1) {
    if (names.includes(args[i])) {
      return args[i + 1] ?? null;
    }
  }
  return null;
}

function hasFlag(args, name) {
  return args.includes(name);
}

function printTaskResult(result) {
  if (Array.isArray(result)) {
    for (const task of result) {
      console.log(`${task.id} ${task.status} p${task.priority} ${task.title}`);
    }
    return;
  }
  if (result === null) {
    console.log("null");
    return;
  }
  if (result && typeof result === "object" && "total" in result) {
    console.log(`total=${result.total} completed=${result.completed} ready=${result.ready} blocked=${result.blocked}`);
    return;
  }
  if (result && typeof result === "object" && "deleted" in result) {
    console.log(`deleted=${result.deleted} id=${result.id}`);
    return;
  }
  console.log(`${result.id} ${result.status} p${result.priority} ${result.title}`);
}

function isReady(db, taskId) {
  const deps = db
    .prepare(
      "select td.depends_on as depends_on, t.status as status from task_dependencies td join tasks t on t.id = td.depends_on where td.task_id = ?"
    )
    .all(taskId);
  return deps.every((dep) => dep.status === "done");
}
