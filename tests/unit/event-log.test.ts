import { describe, expect, it } from "vitest";

import { appendEvent, listEvents, replayEvents } from "../../src/foundation/event-log.js";
import { setupTestDb } from "../helpers/db.js";

describe("event log", () => {
  it("filters by correlation and replays in sequence", () => {
    const db = setupTestDb();
    appendEvent(db, {
      taskId: "t1",
      eventType: "task.created",
      payload: "{}",
      idempotencyKey: "k1",
      correlationId: "corr-1",
      source: "test"
    });
    appendEvent(db, {
      taskId: "t2",
      eventType: "task.created",
      payload: "{}",
      idempotencyKey: "k2",
      correlationId: "corr-2",
      source: "test"
    });

    const corr = listEvents(db, { correlationId: "corr-1" });
    expect(corr).toHaveLength(1);
    expect(corr[0].source).toBe("test");

    const replay = replayEvents(db, 1, 10);
    expect(replay).toHaveLength(1);
    expect(replay[0].idempotencyKey).toBe("k2");
  });

  it("supports eventType filter and bounded replay windows", () => {
    const db = setupTestDb();
    for (let i = 1; i <= 5; i += 1) {
      appendEvent(db, {
        taskId: "t1",
        eventType: i % 2 === 0 ? "task.updated" : "task.created",
        payload: `{"index":${i}}`,
        idempotencyKey: `k${i}`,
        source: "test"
      });
    }

    const updatedOnly = listEvents(db, { taskId: "t1", eventType: "task.updated" });
    expect(updatedOnly.map((event) => event.idempotencyKey)).toEqual(["k2", "k4"]);

    const window = replayEvents(db, 2, 2);
    expect(window.map((event) => event.idempotencyKey)).toEqual(["k3", "k4"]);
  });
});
