import { health } from "../mcp/index.js";

export function validateMcpReachability(): string {
  const mcpStatus = health();
  return `${mcpStatus.service}:${mcpStatus.status}`;
}
