#!/usr/bin/env node

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const rounds = Number.parseInt(process.env.E2E_PROCESS_CHAOS_ROUNDS ?? "2", 10);
const delayMs = Number.parseInt(process.env.E2E_PROCESS_CHAOS_DELAY_MS ?? "1500", 10);
const startedAt = Date.now();

const results = [];
let failures = 0;

for (let round = 1; round <= rounds; round += 1) {
  const roundStart = Date.now();
  const child = spawnSync("npm", ["run", "e2e:process"], {
    cwd: process.cwd(),
    env: process.env,
    encoding: "utf8",
    timeout: 30 * 60 * 1000
  });

  const durationMs = Date.now() - roundStart;
  const ok = child.status === 0;
  if (!ok) {
    failures += 1;
  }

  results.push({
    round,
    ok,
    durationMs,
    exitCode: child.status,
    signal: child.signal,
    stdoutTail: tail(child.stdout ?? "", 20),
    stderrTail: tail(child.stderr ?? "", 20)
  });

  if (round < rounds && delayMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
}

const artifactDir = join(process.cwd(), "artifacts", "e2e", "chaos-runs");
mkdirSync(artifactDir, { recursive: true });
const reportPath = join(artifactDir, `chaos-${Date.now()}.json`);

const report = {
  rounds,
  delayMs,
  totalDurationMs: Date.now() - startedAt,
  failures,
  passed: failures === 0,
  results
};

writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf8");
process.stdout.write(`Chaos report: ${reportPath}\n`);

if (failures > 0) {
  process.exit(1);
}

function tail(text, lines) {
  return text
    .split("\n")
    .filter((line) => line.length > 0)
    .slice(-lines);
}
