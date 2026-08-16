#!/usr/bin/env node
// NetGram MCP server — a thin, safe bridge over the local NetGram HTTP API.
//
// Design: it exposes only READ and PROPOSE tools. It deliberately CANNOT grant
// itself permissions or approve/send drafts — those stay human-only in the web
// UI. So an AI using this server can read allowed chats and queue drafts, but
// every outward action still needs a human click (unless a chat is set to the
// explicit "full" level).
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// Server discovery: explicit env wins; otherwise look for endpoint.json
// written by a running NetGram instance (desktop app → Application Support,
// docker/dev → ./data). Falls back to localhost:3000.
function discover() {
  if (process.env.NETGRAM_BASE_URL) {
    return { base: process.env.NETGRAM_BASE_URL, token: process.env.NETGRAM_AUTH_TOKEN || null };
  }
  const dirs = [
    process.env.NETGRAM_DATA_DIR,
    path.join(os.homedir(), "Library", "Application Support", "NetGram"),
    path.join(process.cwd(), "data"),
  ].filter(Boolean);
  for (const dir of dirs) {
    try {
      const e = JSON.parse(fs.readFileSync(path.join(dir, "endpoint.json"), "utf-8"));
      if (e?.port) return { base: `http://127.0.0.1:${e.port}`, token: e.token ?? null };
    } catch {}
  }
  return { base: "http://localhost:3000", token: null };
}
const { base: BASE, token: TOKEN } = discover();

async function api(path, init) {
  let res;
  try {
    const headers = { ...(init?.headers || {}) };
    if (TOKEN) headers["x-netgram-token"] = TOKEN;
    res = await fetch(`${BASE}${path}`, { ...init, headers });
  } catch (e) {
    return { ok: false, status: 0, data: { error: `cannot reach NetGram at ${BASE} (${e.message})` } };
  }
  const raw = await res.text();
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    data = raw;
  }
  return { ok: res.ok, status: res.status, data };
}

const ok = (obj) => ({
  content: [{ type: "text", text: typeof obj === "string" ? obj : JSON.stringify(obj, null, 2) }],
});
const fail = (msg) => ({ content: [{ type: "text", text: msg }], isError: true });
const levelOf = (c) => (c.full ? "full" : c.write ? "write" : c.read ? "read" : "off");

const server = new McpServer({ name: "netgram", version: "1.0.0" });

server.registerTool(
  "list_chats",
  {
    title: "List chats",
    description:
      "List Telegram dialogs with their granted access level (off/read/write/full) and kind (user/bot/group/channel). Optionally filter by kind or a title substring.",
    inputSchema: {
      kind: z.enum(["user", "bot", "group", "channel"]).optional(),
      query: z.string().optional().describe("case-insensitive substring of the chat title"),
    },
  },
  async ({ kind, query }) => {
    const r = await api("/api/chats");
    if (!r.ok) return fail(`error ${r.status}: ${r.data?.error ?? r.data}`);
    let chats = r.data.chats ?? [];
    if (kind) chats = chats.filter((c) => c.kind === kind);
    if (query) {
      const q = query.toLowerCase();
      chats = chats.filter((c) => (c.title || "").toLowerCase().includes(q));
    }
    return ok(chats.map((c) => ({ id: c.id, title: c.title, kind: c.kind, access: levelOf(c) })));
  }
);

server.registerTool(
  "read_messages",
  {
    title: "Read messages",
    description:
      "Read recent messages from a chat (requires 'read' access, set by the human on the /permissions page). Each message includes any inline buttons.",
    inputSchema: {
      chat_id: z.string().describe("chat id from list_chats"),
      limit: z.number().int().min(1).max(200).optional().describe("recent messages to fetch (default 20)"),
    },
  },
  async ({ chat_id, limit }) => {
    const r = await api(`/api/chats/${chat_id}/messages${limit ? `?limit=${limit}` : ""}`);
    if (r.status === 403)
      return fail(`Chat ${chat_id} is not read-allowed. Ask the human to enable Read on /permissions.`);
    if (!r.ok) return fail(`error ${r.status}: ${r.data?.error ?? r.data}`);
    return ok(r.data.messages);
  }
);

server.registerTool(
  "search_messages",
  {
    title: "Search messages",
    description:
      "Search messages by keyword across every chat the human granted 'read' access to — chats set to 'off' are never searched and never appear in the results. Returns matches with the chat they came from; long texts are trimmed, so use read_messages on a hit for full context. Pass chat_id to search inside a single chat.",
    inputSchema: {
      query: z.string().min(1).describe("keyword or phrase to look for"),
      limit: z.number().int().min(1).max(50).optional().describe("how many matches to return (default 20)"),
      chat_id: z.string().optional().describe("restrict the search to one chat id from list_chats"),
      kind: z.enum(["user", "bot", "group", "channel"]).optional(),
      since: z.string().optional().describe("ISO date, e.g. 2026-08-01 — only messages sent on or after it"),
      until: z.string().optional().describe("ISO date — only messages sent before it"),
    },
  },
  async ({ query, limit, chat_id, kind, since, until }) => {
    const qs = new URLSearchParams({ q: query });
    if (limit) qs.set("limit", String(limit));
    if (chat_id) qs.set("chat_id", chat_id);
    if (kind) qs.set("kind", kind);
    if (since) qs.set("since", since);
    if (until) qs.set("until", until);

    const r = await api(`/api/search?${qs}`);
    if (r.status === 403)
      return fail(`Chat ${chat_id} is not read-allowed. Ask the human to enable Read on /permissions.`);
    if (!r.ok) return fail(`error ${r.status}: ${r.data?.error ?? r.data}`);
    if (!r.data.hits?.length)
      return ok(
        "No matches in the allowed chats. Either nothing matches, or the chats that hold it are still set to 'off' — list_chats shows which are readable."
      );
    return ok(r.data);
  }
);

server.registerTool(
  "propose_message",
  {
    title: "Propose a message (draft)",
    description:
      "Propose sending a text message to a chat. Requires 'write' access. Creates a DRAFT the human approves in the web UI — NOT sent immediately, unless the chat is set to 'full' (then it sends now).",
    inputSchema: { chat_id: z.string(), text: z.string() },
  },
  async ({ chat_id, text }) => {
    const r = await api("/api/drafts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chatId: chat_id, text }),
    });
    if (r.status === 403)
      return fail(`Chat ${chat_id} is not write-allowed. Ask the human to enable Write on /permissions.`);
    if (!r.ok) return fail(`error ${r.status}: ${r.data?.error ?? r.data}`);
    if (r.data.executed) return ok(`Sent immediately (chat has 'full' access). message id ${r.data.message?.id}.`);
    return ok(`Draft created (id ${r.data.draft?.id}). Awaiting human approval in the web UI (/drafts).`);
  }
);

server.registerTool(
  "propose_button_click",
  {
    title: "Propose a button click (draft)",
    description:
      "Propose clicking an inline callback button on a message. Reference the button by 0-based index (from read_messages) or exact text. Requires 'write' access. Creates a draft for human approval unless the chat is 'full'.",
    inputSchema: {
      chat_id: z.string(),
      message_id: z.number().int(),
      button: z.union([z.number().int(), z.string()]).describe("button index (0-based) or exact text"),
    },
  },
  async ({ chat_id, message_id, button }) => {
    const r = await api("/api/drafts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "click", chatId: chat_id, messageId: message_id, button }),
    });
    if (r.status === 403) return fail(`Chat ${chat_id} is not write-allowed.`);
    if (r.status === 422 && r.data?.error === "url_button")
      return fail(`That is a URL button — no click needed, just open: ${r.data.url}`);
    if (!r.ok) return fail(`error ${r.status}: ${r.data?.error ?? r.data}`);
    if (r.data.executed) return ok(`Clicked immediately (full access). Bot answer: ${r.data.answer || "(none)"}`);
    return ok(`Click draft created (button "${r.data.draft?.buttonText}"). Awaiting human approval in the web UI (/drafts).`);
  }
);

server.registerTool(
  "list_drafts",
  {
    title: "List drafts",
    description:
      "List pending and sent drafts (messages and button clicks). Read-only: the AI cannot approve drafts — the human does that in the web UI.",
    inputSchema: {},
  },
  async () => {
    const r = await api("/api/drafts");
    if (!r.ok) return fail(`error ${r.status}: ${r.data?.error ?? r.data}`);
    return ok(r.data.drafts);
  }
);

await server.connect(new StdioServerTransport());
