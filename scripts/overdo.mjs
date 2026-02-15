#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const args = process.argv.slice(2);
const cmd = args[0] ?? "help";

if (cmd === "help" || cmd === "--help" || cmd === "-h") {
  printHelp();
  process.exit(0);
}

if (cmd === "doctor") {
  runAll(["npm", ["run", "lint"], "lint"]);
  runAll(["npm", ["test"], "test"]);
  runAll(["npm", ["run", "build"], "build"]);
  process.exit(0);
}

if (cmd === "test") {
  const target = args[1] ?? "all";
  const mapping = {
    unit: ["npm", ["run", "unit"]],
    integration: ["npm", ["run", "integration"]],
    e2e: ["npm", ["run", "e2e"]],
    process: ["npm", ["run", "e2e:process"]],
    chaos: ["npm", ["run", "e2e:process:chaos"]],
    all: ["npm", ["test"]]
  };
  if (!(target in mapping)) {
    console.error(`Unknown test target: ${target}`);
    process.exit(1);
  }
  runCommand(...mapping[target]);
  process.exit(0);
}

if (cmd === "mcp") {
  runCommand(process.execPath, [join(__dirname, "overdo-mcp-server.mjs")]);
  process.exit(0);
}

if (cmd === "install" && args[1] === "opencode") {
  runCommand(process.execPath, [join(__dirname, "install-opencode.mjs")]);
  process.exit(0);
}

console.error(`Unknown command: ${cmd}`);
printHelp();
process.exit(1);

function runAll(...steps) {
  for (const [bin, argv, label] of steps) {
    console.log(`\n== ${label} ==`);
    runCommand(bin, argv);
  }
}

function runCommand(bin, argv) {
  const result = spawnSync(bin, argv, {
    cwd: process.cwd(),
    stdio: "inherit",
    env: process.env
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function printHelp() {
  console.log(`overdo CLI\n\nCommands:\n  overdo doctor\n  overdo test [unit|integration|e2e|process|chaos|all]\n  overdo mcp\n  overdo install opencode`);
}
