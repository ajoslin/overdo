import { DatabaseSync } from "node:sqlite";

export type EventRecord = {
  id: number;
  taskId: string;
  eventType: string;
  payload: string;
  idempotencyKey: string;
  createdAt: string;
};

export function appendEvent(
  db: DatabaseSync,
  input: { taskId: string; eventType: string; payload: string; idempotencyKey: string }
): EventRecord {
  const createdAt = new Date().toISOString();
  const insert = db.prepare(
    "insert into events (task_id, event_type, payload, idempotency_key, created_at) values (?, ?, ?, ?, ?)"
  );
  insert.run(input.taskId, input.eventType, input.payload, input.idempotencyKey, createdAt);

  const row = db
    .prepare(
      "select id, task_id, event_type, payload, idempotency_key, created_at from events where idempotency_key = ?"
    )
    .get(input.idempotencyKey) as
    | {
        id: number;
        task_id: string;
        event_type: string;
        payload: string;
        idempotency_key: string;
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
    createdAt: row.created_at
  };
}

export function listEvents(db: DatabaseSync, taskId: string): EventRecord[] {
  const rows = db
    .prepare(
      "select id, task_id, event_type, payload, idempotency_key, created_at from events where task_id = ? order by id asc"
    )
    .all(taskId) as Array<{
    id: number;
    task_id: string;
    event_type: string;
    payload: string;
    idempotency_key: string;
    created_at: string;
  }>;

  return rows.map((row) => ({
    id: row.id,
    taskId: row.task_id,
    eventType: row.event_type,
    payload: row.payload,
    idempotencyKey: row.idempotency_key,
    createdAt: row.created_at
  }));
}
