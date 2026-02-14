import { DatabaseSync } from "node:sqlite";

export const SCHEMA_STATEMENTS = [
  "create table if not exists tasks (id text primary key, title text not null, status text not null default 'pending', created_at text not null, updated_at text not null);",
  "create table if not exists task_dependencies (task_id text not null, depends_on text not null, primary key (task_id, depends_on));",
  "create table if not exists events (id integer primary key autoincrement, task_id text not null, event_type text not null, payload text not null, idempotency_key text not null unique, created_at text not null);",
  "create table if not exists task_attempts (id integer primary key autoincrement, task_id text not null, status text not null, created_at text not null);",
  "create table if not exists loop_definitions (task_id text primary key, required_gates text not null, never_give_up integer not null default 1);",
  "create table if not exists loop_runs (id integer primary key autoincrement, task_id text not null, run_status text not null, created_at text not null);",
  "create table if not exists task_leases (task_id text primary key, owner text not null, expires_at text not null);",
  "create table if not exists path_leases (path text primary key, owner text not null, expires_at text not null);",
  "create table if not exists env_locks (name text primary key, owner text not null, expires_at text not null);",
  "create table if not exists commit_queue (id integer primary key autoincrement, task_id text not null, status text not null, created_at text not null);",
  "create table if not exists commit_transactions (id integer primary key autoincrement, task_id text not null, commit_sha text, created_at text not null);"
];

export function initializeSchema(db: DatabaseSync): void {
  for (const statement of SCHEMA_STATEMENTS) {
    db.exec(statement);
  }
}
