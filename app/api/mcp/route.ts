// MCP over Streamable HTTP, served by NetGram itself.
//
// Stateless by design: one POST carries one JSON-RPC message, we spin up a
// fresh MCP server for it, answer, and tear it down. No sessions to expire, no
// second process to install — connecting an agent is a URL plus the same
// x-netgram-token the middleware already enforces on /api/*.
//
// The SDK's own StreamableHTTPServerTransport wants Node req/res objects,
// which route handlers don't have, so we drive the server through a minimal
// one-shot Transport instead. Tool definitions live in lib/tools.ts.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import type { JSONRPCMessage } from "@modelcontextprotocol/sdk/types.js";
import { TOOLS, ToolError } from "@/lib/tools";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Telegram round-trips are slow but bounded; fail loudly rather than leaving a
// client hanging forever on a wedged call.
const CALL_TIMEOUT_MS = 120_000;

class OneShotTransport implements Transport {
  onmessage?: (message: JSONRPCMessage) => void;
  onerror?: (error: Error) => void;
  onclose?: () => void;

  private pending: ((message: JSONRPCMessage) => void) | null = null;

  async start() {}

  async send(message: JSONRPCMessage) {
    // Only responses interest us — a stateless server emits nothing else.
    if (!("id" in message) || !this.pending) return;
    const resolve = this.pending;
    this.pending = null;
    resolve(message);
  }

  async close() {
    this.onclose?.();
  }

  deliver(message: JSONRPCMessage) {
    this.onmessage?.(message);
  }

  exchange(message: JSONRPCMessage): Promise<JSONRPCMessage> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error("MCP request timed out")),
        CALL_TIMEOUT_MS
      );
      this.pending = (reply) => {
        clearTimeout(timer);
        resolve(reply);
      };
      this.deliver(message);
    });
  }
}

function buildServer() {
  const server = new McpServer({ name: "netgram", version: "1.0.0" });
  for (const tool of TOOLS) {
    server.registerTool(
      tool.name,
      {
        title: tool.title,
        description: tool.description,
        inputSchema: tool.inputSchema,
      },
      async (args: Record<string, unknown>) => {
        try {
          const result = await tool.run(args ?? {});
          return {
            content: [
              {
                type: "text" as const,
                text:
                  typeof result === "string"
                    ? result
                    : JSON.stringify(result, null, 2),
              },
            ],
          };
        } catch (e) {
          // Expected refusals read as tool errors the model can recover from;
          // anything else is a real failure, but still not a dead connection.
          const message =
            e instanceof ToolError
              ? e.message
              : `NetGram error: ${e instanceof Error ? e.message : String(e)}`;
          return {
            content: [{ type: "text" as const, text: message }],
            isError: true,
          };
        }
      }
    );
  }
  return server;
}

function rpcError(id: unknown, code: number, message: string) {
  return Response.json(
    { jsonrpc: "2.0", id: id ?? null, error: { code, message } },
    { status: 200 }
  );
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return rpcError(null, -32700, "parse error");
  }
  if (Array.isArray(body)) {
    // Batching was dropped from the spec in the 2025-06-18 revision.
    return rpcError(null, -32600, "batched requests are not supported");
  }
  if (!body || typeof body !== "object") {
    return rpcError(null, -32600, "invalid request");
  }

  const message = body as JSONRPCMessage;
  const server = buildServer();
  const transport = new OneShotTransport();
  await server.connect(transport);

  try {
    // No id means a notification (e.g. notifications/initialized): the client
    // expects no body back, just an acknowledgement.
    if (!("id" in message)) {
      transport.deliver(message);
      return new Response(null, { status: 202 });
    }
    return Response.json(await transport.exchange(message));
  } catch (e) {
    return rpcError(
      "id" in message ? message.id : null,
      -32603,
      e instanceof Error ? e.message : String(e)
    );
  } finally {
    await server.close();
  }
}

// This endpoint answers on POST only — no server-initiated SSE stream to open,
// and nothing session-scoped to delete.
const methodNotAllowed = () =>
  new Response(null, { status: 405, headers: { Allow: "POST" } });

export const GET = methodNotAllowed;
export const DELETE = methodNotAllowed;
