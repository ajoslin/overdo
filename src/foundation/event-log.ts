import { DatabaseSync } from "node:sqlite";

export type EventRecord = {
  id: number;
  taskId: string;
  eventType: string;
  payload: string;
  idempotencyKey: string;
  correlationId: string | null;
  source: string;
  createdAt: string;
};

export type EventFilter = {
  taskId?: string;
  eventType?: string;
  correlationId?: string;
  limit?: number;
};

export function appendEvent(
  db: DatabaseSync,
  input: {
    taskId: string;
    eventType: string;
    payload: string;
    idempotencyKey: string;
    correlationId?: string;
    source?: string;
  }
): EventRecord {
  const createdAt = new Date().toISOString();
  const insert = db.prepare(
    "insert into events (task_id, event_type, payload, idempotency_key, correlation_id, source, created_at) values (?, ?, ?, ?, ?, ?, ?)"
  );
  insert.run(
    input.taskId,
    input.eventType,
    input.payload,
    input.idempotencyKey,
    input.correlationId ?? null,
    input.source ?? "mcp",
    createdAt
  );

  const row = db
    .prepare(
      "select id, task_id, event_type, payload, idempotency_key, correlation_id, source, created_at from events where idempotency_key = ?"
    )
    .get(input.idempotencyKey) as
    | {
        id: number;
        task_id: string;
        event_type: string;
        payload: string;
        idempotency_key: string;
        correlation_id: string | null;
        source: string;
        created_at: string;
      }
    | undefined;

  if (!row) {
    throw new Error("event insert failed");
  }

  return {
    id: row.id,
    taskId: row.task_id,
    eventType: row.event_type,
    payload: row.payload,
    idempotencyKey: row.idempotency_key,
    correlationId: row.correlation_id,
    source: row.source,
    createdAt: row.created_at
  };
}

export function listEvents(db: DatabaseSync, filterOrTaskId?: EventFilter | string): EventRecord[] {
  const filter: EventFilter =
    typeof filterOrTaskId === "string" ? { taskId: filterOrTaskId } : filterOrTaskId ?? {};

  const clauses: string[] = [];
  const params: Array<string | number> = [];

  if (filter.taskId) {
    clauses.push("task_id = ?");
    params.push(filter.taskId);
  }
  if (filter.eventType) {
    clauses.push("event_type = ?");
    params.push(filter.eventType);
  }
  if (filter.correlationId) {
    clauses.push("correlation_id = ?");
    params.push(filter.correlationId);
  }

  const where = clauses.length > 0 ? `where ${clauses.join(" and ")}` : "";
  const limit = filter.limit ? `limit ${Math.max(1, filter.limit)}` : "";

  const rows = db.prepare(
    `select id, task_id, event_type, payload, idempotency_key, correlation_id, source, created_at from events ${where} order by id asc ${limit}`
  ).all(...params) as Array<{
    id: number;
    task_id: string;
    event_type: string;
    payload: string;
    idempotency_key: string;
    correlation_id: string | null;
    source: string;
    created_at: string;
  }>;

  return rows.map((row) => ({
    id: row.id,
    taskId: row.task_id,
    eventType: row.event_type,
    payload: row.payload,
    idempotencyKey: row.idempotency_key,
    correlationId: row.correlation_id,
    source: row.source,
    createdAt: row.created_at
  }));
}

export function replayEvents(db: DatabaseSync, afterEventId = 0, limit = 100): EventRecord[] {
  const safeLimit = Math.max(1, Math.min(limit, 10_000));
  const rows = db
    .prepare(
      "select id, task_id, event_type, payload, idempotency_key, correlation_id, source, created_at from events where id > ? order by id asc limit ?"
    )
    .all(afterEventId, safeLimit) as Array<{
    id: number;
    task_id: string;
    event_type: string;
    payload: string;
    idempotency_key: string;
    correlation_id: string | null;
    source: string;
    created_at: string;
  }>;

  return rows.map((row) => ({
    id: row.id,
    taskId: row.task_id,
    eventType: row.event_type,
    payload: row.payload,
    idempotencyKey: row.idempotency_key,
    correlationId: row.correlation_id,
    source: row.source,
    createdAt: row.created_at
  }));
}
