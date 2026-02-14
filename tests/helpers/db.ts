import { DatabaseSync } from "node:sqlite";

import { initializeSchema } from "../../src/foundation/schema.js";

export function setupTestDb(): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  initializeSchema(db);
  return db;
}
