import { DatabaseSync } from "node:sqlite";

export const SCHEMA_STATEMENTS = [
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
  "create table if not exists commit_transactions (id integer primary key autoincrement, task_id text not null, commit_sha text, created_at text not null);"
];

const INDEX_STATEMENTS = [
  "create index if not exists idx_tasks_status_priority on tasks(status, priority, created_at, id);",
  "create index if not exists idx_dependencies_task on task_dependencies(task_id);",
  "create index if not exists idx_events_task on events(task_id, id);",
  "create index if not exists idx_events_correlation on events(correlation_id, id);",
  "create index if not exists idx_leases_expiry on task_leases(expires_at);",
  "create index if not exists idx_path_leases_expiry on path_leases(expires_at);",
  "create index if not exists idx_commit_queue_status on commit_queue(status, id);",
  "create index if not exists idx_loop_iterations_run_attempt on loop_iterations(run_id, attempt);"
];

export function initializeSchema(db: DatabaseSync): void {
  for (const statement of SCHEMA_STATEMENTS) {
    db.exec(statement);
  }

  for (const statement of INDEX_STATEMENTS) {
    db.exec(statement);
  }

  ensureColumn(db, "tasks", "priority", "alter table tasks add column priority integer not null default 1");
  ensureColumn(db, "events", "correlation_id", "alter table events add column correlation_id text");
  ensureColumn(db, "events", "source", "alter table events add column source text not null default 'mcp'");
  ensureColumn(db, "loop_runs", "contract_snapshot", "alter table loop_runs add column contract_snapshot text not null default '{}' ");
  ensureColumn(db, "loop_definitions", "max_attempts", "alter table loop_definitions add column max_attempts integer not null default 5");
  ensureColumn(db, "commit_queue", "summary", "alter table commit_queue add column summary text not null default ''");
  ensureColumn(db, "commit_queue", "manifest_json", "alter table commit_queue add column manifest_json text not null default '{}' ");
  ensureColumn(db, "commit_queue", "base_revision", "alter table commit_queue add column base_revision text");
  ensureColumn(db, "commit_queue", "current_revision", "alter table commit_queue add column current_revision text");
}

function ensureColumn(db: DatabaseSync, tableName: string, columnName: string, statement: string): void {
  const columns = db.prepare(`pragma table_info(${tableName})`).all() as Array<{ name: string }>;
  if (columns.some((column) => column.name === columnName)) {
    return;
  }
  db.exec(statement);
}
