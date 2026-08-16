#!/usr/bin/env bun
// netgram — thin CLI over the local NetGram HTTP API.
//
// Mirrors the MCP server's surface: read + propose only. Granting permissions
// and approving drafts stay human-only in the web UI. Compiled to a single
// self-contained binary with `bun build --compile` for the Mac app installer.

import fs from "node:fs";
import path from "node:path";
import os from "node:os";

type Endpoint = { base: string; token: string | null; source: string };

// --- server discovery ------------------------------------------------------

function readEndpointFile(dir: string): Endpoint | null {
  try {
    const raw = fs.readFileSync(path.join(dir, "endpoint.json"), "utf-8");
    const e = JSON.parse(raw);
    if (!e?.port) return null;
    return {
      base: `http://127.0.0.1:${e.port}`,
      token: e.token ?? null,
      source: path.join(dir, "endpoint.json"),
    };
  } catch {
    return null;
  }
}

function discover(): Endpoint {
  if (process.env.NETGRAM_BASE_URL) {
    return {
      base: process.env.NETGRAM_BASE_URL,
      token: process.env.NETGRAM_AUTH_TOKEN ?? null,
      source: "NETGRAM_BASE_URL env",
    };
  }
  const candidates = [
    process.env.NETGRAM_DATA_DIR,
    path.join(os.homedir(), "Library", "Application Support", "NetGram"),
    path.join(process.cwd(), "data"),
  ].filter(Boolean) as string[];
  for (const dir of candidates) {
    const e = readEndpointFile(dir);
    if (e) return e;
  }
  return { base: "http://localhost:3000", token: null, source: "default (localhost:3000)" };
}

// --- http ------------------------------------------------------------------

const ep = discover();

async function api(p: string, init?: RequestInit): Promise<any> {
  const headers: Record<string, string> = {
    ...(init?.headers as Record<string, string>),
  };
  if (ep.token) headers["x-netgram-token"] = ep.token;
  let res: Response;
  try {
    res = await fetch(`${ep.base}${p}`, { ...init, headers });
  } catch (e: any) {
    die(
      `cannot reach NetGram at ${ep.base} (${e.message})\n` +
        `  discovered via: ${ep.source}\n` +
        `  is the NetGram app (or docker container) running?`
    );
  }
  const raw = await res.text();
  let data: any;
  try {
    data = JSON.parse(raw);
  } catch {
    data = { error: raw };
  }
  if (res.status === 401) die("unauthorized — token mismatch. Is the app restarted? (token lives in endpoint.json)");
  if (res.status === 403) die(`forbidden: ${data?.error ?? "chat not allowed"} — enable access on /permissions in the web UI.`);
  if (!res.ok) die(`error ${res.status}: ${typeof data?.error === "string" ? data.error : raw}`);
  return data;
}

function die(msg: string): never {
  console.error(`netgram: ${msg}`);
  process.exit(1);
}

// --- arg parsing (tiny) ----------------------------------------------------

const argv = process.argv.slice(2);
const flags: Record<string, string | boolean> = {};
const pos: string[] = [];
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === "--json") flags.json = true;
  else if (a.startsWith("--")) flags[a.slice(2)] = argv[++i] ?? "";
  else pos.push(a);
}
const [cmd, ...rest] = pos;
const asJson = (o: unknown) => console.log(JSON.stringify(o, null, 2));
const levelOf = (c: any) => (c.full ? "full" : c.write ? "write" : c.read ? "read" : "off");

// --- commands --------------------------------------------------------------

const HELP = `netgram — scoped Telegram access via your local NetGram server

usage:
  netgram status                          auth/session state of the server
  netgram chats [query] [--kind k]        list dialogs (+access level); k: user|bot|group|channel
  netgram read <chatId> [--limit N]       recent messages of a read-allowed chat
  netgram propose <chatId> <text...>      queue a message draft (write access; 'full' sends now)
  netgram click <chatId> <msgId> <button> queue an inline-button click (index or exact text)
  netgram drafts                          list pending/sent drafts
  netgram endpoint                        show which server/token source is used
  --json                                  raw JSON output

Permissions and draft approval are human-only, in the web UI.`;

async function main() {
  switch (cmd) {
    case "status": {
      const d = await api("/api/auth/status");
      if (flags.json) return asJson(d);
      console.log(`server: ${ep.base} (via ${ep.source})`);
      console.log(`state:  ${d.state}`);
      return;
    }
    case "chats": {
      const d = await api("/api/chats");
      let chats: any[] = d.chats ?? [];
      const q = rest[0]?.toLowerCase();
      if (flags.kind) chats = chats.filter((c) => c.kind === flags.kind);
      if (q) chats = chats.filter((c) => (c.title || "").toLowerCase().includes(q));
      if (flags.json) return asJson(chats.map((c) => ({ id: c.id, title: c.title, kind: c.kind, access: levelOf(c) })));
      for (const c of chats) {
        console.log(`${String(c.id).padEnd(15)} ${levelOf(c).padEnd(6)} ${c.kind.padEnd(8)} ${c.title}`);
      }
      if (!chats.length) console.log("(no chats matched)");
      return;
    }
    case "read": {
      const id = rest[0] || die("usage: netgram read <chatId> [--limit N]");
      const limit = flags.limit ? `?limit=${flags.limit}` : "";
      const d = await api(`/api/chats/${id}/messages${limit}`);
      if (flags.json) return asJson(d.messages);
      for (const m of d.messages ?? []) {
        const when = m.date ? new Date(m.date * 1000 || m.date).toISOString().slice(0, 16) : "";
        console.log(`[${m.id}] ${when} ${m.from ?? ""}: ${m.text ?? ""}`);
        if (m.buttons?.length) {
          m.buttons.flat().forEach((b: any, i: number) => console.log(`    (${i}) [${b.text}]${b.url ? ` → ${b.url}` : ""}`));
        }
      }
      return;
    }
    case "propose":
    case "send": {
      const id = rest[0];
      const text = rest.slice(1).join(" ");
      if (!id || !text) die("usage: netgram propose <chatId> <text...>");
      const d = await api("/api/drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatId: id, text }),
      });
      if (flags.json) return asJson(d);
      console.log(d.executed
        ? `sent immediately (chat has 'full' access), message id ${d.message?.id}`
        : `draft ${d.draft?.id} created — approve it in the web UI (/drafts)`);
      return;
    }
    case "click": {
      const [id, msgId, ...btn] = rest;
      const button = btn.join(" ");
      if (!id || !msgId || !button) die("usage: netgram click <chatId> <messageId> <buttonIndexOrText>");
      const d = await api("/api/drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "click",
          chatId: id,
          messageId: Number(msgId),
          button: /^\d+$/.test(button) ? Number(button) : button,
        }),
      });
      if (flags.json) return asJson(d);
      console.log(d.executed
        ? `clicked immediately (full access). Bot answer: ${d.answer || "(none)"}`
        : `click draft created ("${d.draft?.buttonText}") — approve it in the web UI (/drafts)`);
      return;
    }
    case "drafts": {
      const d = await api("/api/drafts");
      if (flags.json) return asJson(d.drafts);
      for (const dr of d.drafts ?? []) {
        console.log(`${String(dr.id).padEnd(8)} ${String(dr.status).padEnd(8)} → ${dr.chatTitle ?? dr.chatId}: ${dr.text ?? `[click: ${dr.buttonText}]`}`);
      }
      if (!(d.drafts ?? []).length) console.log("(no drafts)");
      return;
    }
    case "endpoint": {
      return asJson({ ...ep, token: ep.token ? "(set)" : null });
    }
    default:
      console.log(HELP);
      process.exit(cmd ? 1 : 0);
  }
}

await main();
