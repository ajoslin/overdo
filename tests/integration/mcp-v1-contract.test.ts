import { describe, expect, it } from "vitest";

import { listEvents } from "../../src/foundation/event-log.js";
import { OverdoMcpV1 } from "../../src/mcp/v1.js";
import { setupTestDb } from "../helpers/db.js";

describe("MCP v1 contract", () => {
  it("creates tasks, applies blockers, and resolves next ready", () => {
    const db = setupTestDb();
    const mcp = new OverdoMcpV1(db);

    mcp.tasksCreate({ id: "bootstrap", title: "Bootstrap" });
    mcp.tasksCreate({ id: "foundation", title: "Foundation" });
    mcp.tasksBlock("foundation", "bootstrap");

    expect(mcp.tasksNextReady()?.id).toBe("bootstrap");

    mcp.tasksTransition("bootstrap", "running");
    mcp.tasksTransition("bootstrap", "done");

    expect(mcp.tasksNextReady()?.id).toBe("foundation");
  });

  it("guarantees append-only idempotency keys", () => {
    const db = setupTestDb();
    db.prepare(
      "insert into events (task_id, event_type, payload, idempotency_key, created_at) values (?, ?, ?, ?, ?)"
    ).run("t1", "task.created", "{}", "same-key", new Date().toISOString());

    expect(() =>
      db
        .prepare(
          "insert into events (task_id, event_type, payload, idempotency_key, created_at) values (?, ?, ?, ?, ?)"
        )
        .run("t1", "task.created", "{}", "same-key", new Date().toISOString())
    ).toThrow();

    expect(listEvents(db, "t1")).toHaveLength(1);
  });
});
