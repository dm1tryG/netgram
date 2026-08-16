// Runs once on server boot (Next.js instrumentation hook). Publishes where the
// server actually listens — port + auth token — to endpoint.json in the data
// dir, so the stdio MCP server can discover a desktop-managed instance
// without hardcoding localhost:3000.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const fs = await import("node:fs");
  const path = await import("node:path");
  const { DATA_DIR } = await import("./lib/paths");

  const endpoint = {
    port: Number(process.env.PORT || 3000),
    token: process.env.NETGRAM_AUTH_TOKEN || null,
    pid: process.pid,
    startedAt: new Date().toISOString(),
  };
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const file = path.join(DATA_DIR, "endpoint.json");
  // Contains the auth token — owner-only perms.
  fs.writeFileSync(file, JSON.stringify(endpoint, null, 2) + "\n", { mode: 0o600 });
}
