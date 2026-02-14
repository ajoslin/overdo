export type HealthStatus = {
  service: "mcp";
  status: "ok";
};

export function health(): HealthStatus {
  return { service: "mcp", status: "ok" };
}
