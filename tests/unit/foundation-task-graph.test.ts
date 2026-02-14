import { describe, expect, it } from "vitest";

import { addDependency, createTask, nextReadyTask, transitionTask } from "../../src/foundation/task-graph.js";
import { setupTestDb } from "../helpers/db.js";

describe("task graph foundation", () => {
  it("returns dependency-ready tasks only", () => {
    const db = setupTestDb();
    createTask(db, { id: "bootstrap", title: "Bootstrap", status: "done" });
    createTask(db, { id: "foundation", title: "Foundation" });
    createTask(db, { id: "scheduler", title: "Scheduler" });

    addDependency(db, "foundation", "bootstrap");
    addDependency(db, "scheduler", "foundation");

    expect(nextReadyTask(db)?.id).toBe("foundation");
  });

  it("rejects dependency cycles", () => {
    const db = setupTestDb();
    createTask(db, { id: "a", title: "A" });
    createTask(db, { id: "b", title: "B" });

    addDependency(db, "b", "a");
    expect(() => addDependency(db, "a", "b")).toThrow("dependency cycle detected");
  });

  it("enforces lifecycle transition invariants", () => {
    const db = setupTestDb();
    createTask(db, { id: "t1", title: "Task" });

    transitionTask(db, "t1", "running");
    transitionTask(db, "t1", "done");

    expect(() => transitionTask(db, "t1", "running")).toThrow("invalid transition done -> running");
  });
});
