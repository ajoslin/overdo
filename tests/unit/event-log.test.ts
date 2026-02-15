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
});
