#!/usr/bin/env node

import { spawnSync } from "node:child_process";

const tools = [
  {
    name: "overdo_health",
    description: "Returns basic Overdo health information",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false
    }
  },
  {
    name: "overdo_run_checks",
    description: "Runs lint/test/build checks",
    inputSchema: {
      type: "object",
      properties: {
        scope: {
          type: "string",
          enum: ["lint", "test", "build", "all"],
          default: "all"
        }
      },
      additionalProperties: false
    }
  }
];

let buffer = "";

process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  buffer += chunk;
  consume();
});

function consume() {
  while (true) {
    const headerEnd = buffer.indexOf("\r\n\r\n");
    if (headerEnd === -1) {
      return;
    }
    const header = buffer.slice(0, headerEnd);
    const match = header.match(/Content-Length:\s*(\d+)/i);
    if (!match) {
      buffer = "";
      return;
    }
    const len = Number(match[1]);
    const bodyStart = headerEnd + 4;
    if (buffer.length < bodyStart + len) {
      return;
    }
    const body = buffer.slice(bodyStart, bodyStart + len);
    buffer = buffer.slice(bodyStart + len);
    const msg = JSON.parse(body);
    handle(msg);
  }
}

function handle(msg) {
  if (msg.method === "initialize") {
    respond(msg.id, {
      protocolVersion: "2024-11-05",
      serverInfo: { name: "overdo-mcp", version: "0.1.0" },
      capabilities: { tools: {} }
    });
    return;
  }

  if (msg.method === "tools/list") {
    respond(msg.id, { tools });
    return;
  }

  if (msg.method === "tools/call") {
    const name = msg.params?.name;
    if (name === "overdo_health") {
      respond(msg.id, {
        content: [{ type: "text", text: JSON.stringify({ service: "overdo", status: "ok" }) }]
      });
      return;
    }
    if (name === "overdo_run_checks") {
      const scope = msg.params?.arguments?.scope ?? "all";
      const results = runChecks(scope);
      respond(msg.id, {
        content: [{ type: "text", text: JSON.stringify(results) }]
      });
      return;
    }

    respondError(msg.id, -32602, `unknown tool: ${name}`);
    return;
  }

  if (msg.method === "notifications/initialized") {
    return;
  }

  if (msg.id) {
    respondError(msg.id, -32601, `unknown method: ${msg.method}`);
  }
}

function runChecks(scope) {
  const steps =
    scope === "lint"
      ? [["npm", ["run", "lint"]]]
      : scope === "test"
        ? [["npm", ["test"]]]
        : scope === "build"
          ? [["npm", ["run", "build"]]]
          : [
              ["npm", ["run", "lint"]],
              ["npm", ["test"]],
              ["npm", ["run", "build"]]
            ];

  const outputs = [];
  for (const [bin, argv] of steps) {
    const out = spawnSync(bin, argv, {
      cwd: process.cwd(),
      env: process.env,
      encoding: "utf8"
    });
    outputs.push({ command: `${bin} ${argv.join(" ")}`, status: out.status, stdout: out.stdout, stderr: out.stderr });
    if (out.status !== 0) {
      break;
    }
  }
  return { ok: outputs.every((o) => o.status === 0), outputs };
}

function respond(id, result) {
  write({ jsonrpc: "2.0", id, result });
}

function respondError(id, code, message) {
  write({ jsonrpc: "2.0", id, error: { code, message } });
}

function write(obj) {
  const text = JSON.stringify(obj);
  process.stdout.write(`Content-Length: ${Buffer.byteLength(text, "utf8")}\r\n\r\n${text}`);
}
