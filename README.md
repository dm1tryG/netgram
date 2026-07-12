# NetGram

**The Telegram MCP that doesn't YOLO your account.**

A self-hosted bridge that gives an AI agent *scoped, permissioned* access to your
Telegram — you decide, per chat, what it may read and write, and **every outgoing
message or button click needs your approval** before it hits Telegram. Runs
locally in Docker with a small web UI to manage access.

> Most Telegram MCP servers log in as a userbot and hand the AI **full access to
> everything** — all your DMs, groups and channels, with send rights. NetGram is
> the opposite bet: least-privilege by default, human-in-the-loop for anything
> that leaves your account.

<!-- TODO: demo GIF — permissions screen + approving a draft -->

---

## Why NetGram

|                                   | Typical Telegram MCP | **NetGram** |
| --------------------------------- | :------------------: | :---------: |
| Reads your chats                  |    all, always       | only chats you allow |
| Sends messages                    |  immediately, silently | queued as a **draft** you approve |
| Per-chat permissions              |         ✗            | ✅ off / read / write / full |
| Web UI to manage access           |         ✗            | ✅ |
| Your own Telegram API credentials |     usually shared   | ✅ your own, never shared |
| Autonomous mode when you want it  |     all-or-nothing   | ✅ opt-in per chat (`full`) |

The whole idea: an agent can read the chats you picked and *propose* actions, but
you stay the one who presses send.

---

## Quick start (Docker)

```bash
git clone https://github.com/<you>/netgram.git
cd netgram
docker compose up -d --build
```

Open **http://localhost:3000** and follow the setup screen:

1. Paste your own `api_id` / `api_hash` from
   [my.telegram.org/apps](https://my.telegram.org/apps) and your phone — nothing
   to edit in files, it's stored locally in `./data`.
2. Enter the Telegram login code (and 2FA password if you have one).

Then open **/permissions** and switch on the chats the AI may touch.

All state (credentials, session, allowlist, drafts) lives in the `./data`
volume, so it survives restarts and rebuilds.

## Use it from your AI (MCP)

NetGram ships a Model Context Protocol server (`mcp/server.mjs`) so any MCP client
— Claude Desktop, Claude Code, Cursor, Cline — can drive it. Install deps once,
then point your client at the server:

```bash
npm install   # once, for the MCP server's dependencies
```

```jsonc
{
  "mcpServers": {
    "netgram": {
      "command": "node",
      "args": ["/absolute/path/to/netgram/mcp/server.mjs"],
      "env": { "NETGRAM_BASE_URL": "http://localhost:3000" }
    }
  }
}
```

**Tools exposed** (deliberately read + propose only):

| Tool | What it does |
| --- | --- |
| `list_chats` | list dialogs with access level + kind; filter by kind/title |
| `read_messages` | recent messages of a **read**-allowed chat (incl. inline buttons) |
| `propose_message` | queue a text message as a draft (needs **write**) |
| `propose_button_click` | queue an inline-button click as a draft (needs **write**) |
| `list_drafts` | list pending/sent drafts |

Notably **absent by design**: there is no tool to grant permissions or to
approve/send a draft. Those are human-only, in the web UI. So the worst an AI can
do is read chats you allowed and pile up drafts you can ignore.

> Prefer curl or a Claude Code skill? The same actions are available over the raw
> [HTTP API](#api).

## Permission model

One escalating level per chat (`full ⊃ write ⊃ read`), set by **you** on
`/permissions`:

| Level | The AI can… |
| --- | --- |
| **off** | nothing (server rejects reads/writes) |
| **read** | read that chat's messages |
| **write** | *propose* messages & clicks — you approve each one in `/drafts` |
| **full** | act autonomously — proposals execute immediately, no approval |

`full` is your explicit opt-in to autonomy for a specific chat. Everything is
enforced **server-side** — a request outside the allowlist never reaches Telegram.

## How it works

```
AI (MCP client) ──stdio──▶ mcp/server.mjs ──HTTP──▶ NetGram (Next.js)
                                                    │  allowlist gate (per chat)
you (browser) ──────────────────────────────────▶  │  drafts + approval
                                                    └─ GramJS / MTProto ─▶ Telegram
```

- **Next.js** app: web UI (`/permissions`, `/drafts`) + HTTP API.
- **GramJS (MTProto)**: logs in with *your* account and session.
- **MCP server**: thin, safe bridge over the HTTP API for AI clients.
- State in `./data`: `config.json` (creds), `session`, `allowlist.json`, `drafts.json` — all git-ignored.

## Safety & caveats

- **Self-hosted, single-user.** You run it on your own machine with your own
  Telegram app credentials. Nothing is shared with a third party.
- **MTProto userbot = ToS gray area.** Like every "userbot" tool, this logs into
  your account via MTProto, which Telegram's ToS doesn't officially bless — there
  is a non-zero account-ban risk. Use a burner/secondary account if that worries
  you. This is true of all Telegram MCPs; NetGram just doesn't hide it.
- **Approval is the safety net.** Drafts require a deliberate click, and the
  confirm dialog's prominent button is *Cancel* — an accidental (or automated)
  single click cancels rather than fires.
- **Don't grant `full` unless you mean it.** It removes the approval step for
  that chat.

## Run without Docker (dev)

```bash
npm install
npm run dev          # http://localhost:3000, state in ./data
```

Power users can skip the setup screen by providing creds via env instead
(`.env` with `TG_API_ID` / `TG_API_HASH` / `TG_PHONE`); env takes precedence
over the wizard.

## API

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/me` | logged-in user |
| GET | `/api/chats` | all dialogs + `read`/`write`/`full` + `kind`; `?refresh=1` |
| PATCH | `/api/chats/:id/allow` | `{ level: 'off'\|'read'\|'write'\|'full' }` |
| GET | `/api/chats/:id/messages` | `?limit=`, 403 without read; includes `buttons` |
| GET · POST | `/api/drafts` | list / create (message or `{kind:'click'}`) |
| POST | `/api/drafts/:id/send` | approve + execute a draft |
| DELETE | `/api/drafts/:id` | discard a draft |

## License

MIT — see [LICENSE](./LICENSE).
