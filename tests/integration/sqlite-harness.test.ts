import { DatabaseSync } from "node:sqlite";
import { mkdirSync, writeFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

describe("sqlite integration harness", () => {
  it("creates and queries deterministic fixture data", () => {
    const db = new DatabaseSync(":memory:");
    db.exec("create table tasks (id text primary key, status text not null);");

    const insert = db.prepare("insert into tasks (id, status) values (?, ?)");
    insert.run("task-bootstrap", "done");
    insert.run("task-foundation", "pending");

    const rows = db.prepare("select id, status from tasks order by id asc").all() as Array<{
      id: string;
      status: string;
    }>;

    expect(rows).toEqual([
      { id: "task-bootstrap", status: "done" },
      { id: "task-foundation", status: "pending" }
    ]);
  });

  it("records a controlled failure artifact for invalid SQL", () => {
    mkdirSync("artifacts", { recursive: true });
    const db = new DatabaseSync(":memory:");

    try {
      db.exec("select definitely_missing_column from missing_table;");
      throw new Error("expected query to fail");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      writeFileSync("artifacts/failure-injection.log", message, "utf8");
      expect(message.toLowerCase()).toContain("no such table");
    }
  });
});
