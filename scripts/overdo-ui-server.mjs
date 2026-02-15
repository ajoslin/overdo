#!/usr/bin/env node

import { createServer } from "node:http";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";

const args = process.argv.slice(2);
const port = parsePort(args);
const dbPath = parseDbPath(args) ?? join(process.cwd(), ".overdo", "tasks.db");

ensureSchema(dbPath);

const server = createServer((req, res) => {
  if (!req.url) {
    res.writeHead(400, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "invalid request" }));
    return;
  }

  if (req.url === "/health") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ service: "overdo-ui", status: "ok" }));
    return;
  }

  if (req.url === "/api/snapshot") {
    const payload = snapshot(dbPath);
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify(payload));
    return;
  }

  if (req.url === "/") {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(renderHtml());
    return;
  }

  res.writeHead(404, { "content-type": "application/json" });
  res.end(JSON.stringify({ error: "not found" }));
});

server.listen(port, () => {
  process.stdout.write(`Overdo UI running at http://127.0.0.1:${port}\n`);
});

function parsePort(argv) {
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--port") {
      const raw = argv[i + 1];
      if (!raw) {
        throw new Error("missing value for --port");
      }
      const parsed = Number(raw);
      if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 65535) {
        throw new Error(`invalid port: ${raw}`);
      }
      return parsed;
    }
  }
  return 6969;
}

function parseDbPath(argv) {
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--db") {
      const raw = argv[i + 1];
      if (!raw) {
        throw new Error("missing value for --db");
      }
      return raw;
    }
  }
  return null;
}

function ensureSchema(dbPath) {
  mkdirSync(dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  try {
    db.exec("create table if not exists tasks (id text primary key, title text not null, status text not null default 'pending', priority integer not null default 1, created_at text not null default '', updated_at text not null default '')");
    db.exec("create table if not exists task_dependencies (task_id text not null, depends_on text not null, primary key (task_id, depends_on))");
    db.exec("create table if not exists task_leases (task_id text primary key, owner text not null, expires_at text not null)");
    db.exec("create table if not exists path_leases (path text primary key, owner text not null, expires_at text not null)");
    db.exec("create table if not exists env_locks (name text primary key, owner text not null, expires_at text not null)");
    db.exec("create table if not exists commit_queue (id integer primary key autoincrement, task_id text not null, status text not null, summary text not null default '', manifest_json text not null default '{}', base_revision text, current_revision text, created_at text not null)");
    db.exec("create table if not exists loop_runs (id integer primary key autoincrement, task_id text not null, run_status text not null, contract_snapshot text not null default '{}', created_at text not null)");
  } finally {
    db.close();
  }
}

function snapshot(dbPath) {
  const db = new DatabaseSync(dbPath);
  try {
    const tasks = db.prepare("select id, title, status, priority from tasks order by priority asc, created_at asc, id asc").all();
    const runningTasks = Number((db.prepare("select count(*) as count from tasks where status = 'running'").get()).count ?? 0);
    const pendingTasks = Number((db.prepare("select count(*) as count from tasks where status = 'pending'").get()).count ?? 0);
    const doneTasks = Number((db.prepare("select count(*) as count from tasks where status = 'done'").get()).count ?? 0);
    const activeLocks = Number((db.prepare("select count(*) as count from env_locks").get()).count ?? 0);
    return {
      stats: {
        totalTasks: tasks.length,
        runningTasks,
        pendingTasks,
        doneTasks,
        activeLocks
      },
      tasks
    };
  } finally {
    db.close();
  }
}

function renderHtml() {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Overdo UI</title>
    <style>
      body { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; margin: 24px; }
      .grid { display: grid; grid-template-columns: repeat(4, minmax(120px, 1fr)); gap: 10px; }
      .card { border: 1px solid #ccc; border-radius: 8px; padding: 12px; }
      table { border-collapse: collapse; width: 100%; margin-top: 16px; }
      th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    </style>
  </head>
  <body>
    <h1>Overdo UI (scaffold)</h1>
    <div class="grid" id="stats"></div>
    <table>
      <thead><tr><th>ID</th><th>Title</th><th>Status</th><th>Priority</th></tr></thead>
      <tbody id="rows"></tbody>
    </table>
    <script>
      async function refresh() {
        const res = await fetch('/api/snapshot');
        const data = await res.json();
        const stats = document.getElementById('stats');
        stats.innerHTML = Object.entries(data.stats).map(([k, v]) => '<div class="card"><strong>' + k + '</strong><div>' + v + '</div></div>').join('');
        const rows = document.getElementById('rows');
        rows.innerHTML = data.tasks.map((t) => '<tr><td>' + t.id + '</td><td>' + t.title + '</td><td>' + t.status + '</td><td>' + t.priority + '</td></tr>').join('');
      }
      refresh();
      setInterval(refresh, 3000);
    </script>
  </body>
</html>`;
}
