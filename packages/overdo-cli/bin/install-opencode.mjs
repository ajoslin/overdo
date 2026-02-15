#!/usr/bin/env node

import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = dirname(dirname(dirname(__dirname)));

const opencodeConfigDir = join(process.env.HOME ?? "", ".config", "opencode");
const configPath = join(opencodeConfigDir, "opencode.json");
const targetSkillsDir = join(opencodeConfigDir, "skills");
const sourceSkillsDir = join(repoRoot, "opencode", "skills");

mkdirSync(opencodeConfigDir, { recursive: true });
mkdirSync(targetSkillsDir, { recursive: true });

cpSync(sourceSkillsDir, targetSkillsDir, { recursive: true });

const commandPath = join(repoRoot, "packages", "overdo-mcp", "bin", "overdo-mcp-server.mjs");

let config = {
  $schema: "https://opencode.ai/config.json",
  mcp: {}
};

if (existsSync(configPath)) {
  config = JSON.parse(readFileSync(configPath, "utf8"));
  if (!config.mcp || typeof config.mcp !== "object") {
    config.mcp = {};
  }
}

config.mcp.overdo = {
  type: "local",
  enabled: true,
  command: ["node", commandPath]
};

writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");

console.log("Installed Overdo MCP + skills into OpenCode config.");
console.log(`Config: ${configPath}`);
console.log("Skills installed: overdo-plan, overdo-orchestrate");
