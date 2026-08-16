---
type: project
status: active
date: 2026-08-07
themes: [netgram, mac-app, distribution]
---
# NetGram Mac App — research + plan

Goal: user installs **one Mac app** → gets the NetGram server (menubar app with
web UI) **and** a `netgram` CLI in PATH. No Docker, no npm.

## Chosen architecture

```
NetGram.app (Electron, menubar)
 ├─ spawns .next/standalone/server.js  (bundled Node server, free port)
 ├─ data dir → ~/Library/Application Support/NetGram/
 ├─ writes endpoint.json {port, token} → same dir
 └─ Resources/netgram  (self-contained CLI binary, bun --compile)

netgram CLI / MCP server
 └─ read endpoint.json → talk HTTP to 127.0.0.1:<port> with x-netgram-token
```

### Decisions

| Question | Decision | Why |
|---|---|---|
| Shell | **Electron** | Electron = Node → runs the existing Next standalone server as child process; proven path (`electron-builder` → signed/notarized pkg). Tauri would need a Node sidecar anyway. |
| App style | **Menubar (tray)** app | NetGram is a background bridge; window only for setup/permissions. |
| CLI runtime | **bun build --compile** | Single self-contained binary, no Node requirement on user machine. Thin HTTP client (~200 lines). |
| CLI into PATH | **.pkg postinstall** symlinks `/usr/local/bin/netgram` → binary inside app bundle | One install, one admin prompt (the installer's own). Same pattern as Docker/VS Code `code`. Fallback menu item "Install CLI" for .dmg users. |
| Port | Dynamic free port, not 3000 | No clash with dev servers; discovered via endpoint.json. |
| Local security | **Loopback token** (`x-netgram-token` header), enforced by Next middleware when `NETGRAM_AUTH_TOKEN` is set | Without it any local process can read TG chats via the open port. Docker mode unchanged (env not set). Electron injects the header for its own window; CLI/MCP read token from endpoint.json. |
| Signing | Developer ID Application: Dmitrii Galkin (4JDY5A5L46) | Already in keychain. Notarize via `notarytool` (needs app-specific password or App Store Connect API key — one-time setup). |

## Install UX (target)

1. Download `NetGram.pkg` → double-click → install.
2. Menubar icon appears, setup wizard opens (api_id/api_hash/phone → code → 2FA).
3. Terminal: `netgram chats` just works (CLI finds the app via endpoint.json).

## Task list

- [ ] **M1. Server: token middleware + endpoint.json** — `middleware.ts` checks
      `x-netgram-token` when `NETGRAM_AUTH_TOKEN` env set; server writes
      `endpoint.json` (port, token) to data dir on boot.
- [ ] **M2. CLI** (`cli/`) — `netgram chats | read <id> [--limit] | send <id> <text> | drafts | status`;
      thin client over HTTP API; `bun build --compile` → single binary.
- [ ] **M3. Electron shell** (`desktop/`) — tray + BrowserWindow; picks free
      port, spawns bundled standalone server with `NETGRAM_DATA_DIR`,
      `NETGRAM_AUTH_TOKEN`; injects token header for its own requests;
      login item optional.
- [ ] **M4. Packaging** — electron-builder: bundle standalone build +
      CLI binary as extraResources; target `pkg`; postinstall script symlinks
      CLI; hardened runtime + entitlements.
- [ ] **M5. Sign + notarize** — Developer ID sign, `notarytool submit`,
      staple. Needs Apple app-specific password (one-time, ask Dmitrii).
- [ ] **M6. MCP server update** — read endpoint.json (fallback to
      `NETGRAM_BASE_URL`), send token header.

## Non-goals (v1)

- App Store distribution (sandbox would break spawning server + /usr/local/bin).
- Auto-update (add electron-updater later if needed).
- Windows/Linux builds.
