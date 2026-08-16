// NetGram menubar app. Wraps the Next.js standalone server:
//   - picks a free port, generates a per-launch auth token
//   - spawns the bundled server using Electron's own binary as Node
//     (ELECTRON_RUN_AS_NODE) — no system Node required
//   - injects x-netgram-token into all requests from the app window
//   - tray menu: open UI / permissions / drafts / quit
// State lives in ~/Library/Application Support/NetGram (userData); the server
// writes endpoint.json there so the CLI and MCP server can find us.
const { app, BrowserWindow, Tray, Menu, session, shell } = require("electron");
const { spawn } = require("node:child_process");
const crypto = require("node:crypto");
const net = require("node:net");
const path = require("node:path");
const fs = require("node:fs");

app.setName("NetGram");

let tray = null;
let win = null;
let child = null;
let base = null;
let token = null;

function freePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, "127.0.0.1", () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
    srv.on("error", reject);
  });
}

function portFree(port) {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.once("error", () => resolve(false));
    srv.listen(port, "127.0.0.1", () => srv.close(() => resolve(true)));
  });
}

// Port and token are reused across launches, unlike endpoint.json which is
// deleted on quit. An agent's MCP config points at a fixed URL and header, so
// a fresh random pair every restart would silently break every connection the
// user set up on the Connect MCP page.
function connectionPath() {
  return path.join(app.getPath("userData"), "connection.json");
}

async function loadConnection() {
  let saved = null;
  try {
    saved = JSON.parse(fs.readFileSync(connectionPath(), "utf-8"));
  } catch {}
  const conn = {
    token: saved?.token || crypto.randomBytes(32).toString("hex"),
    // Someone else may have taken the port while we were closed.
    port: saved?.port && (await portFree(saved.port)) ? saved.port : await freePort(),
  };
  try {
    fs.mkdirSync(path.dirname(connectionPath()), { recursive: true });
    fs.writeFileSync(connectionPath(), JSON.stringify(conn, null, 2));
  } catch (e) {
    console.error(`[netgram] could not persist connection: ${e.message}`);
  }
  return conn;
}

function serverDir() {
  // Packaged: extraResources puts the assembled standalone build in
  // Resources/server. Dev: use the repo's .next/standalone directly.
  return app.isPackaged
    ? path.join(process.resourcesPath, "server")
    : path.join(__dirname, "..", ".next", "standalone");
}

function nodeBinary() {
  // On macOS, spawning the main app binary (even with ELECTRON_RUN_AS_NODE)
  // registers a second Foreground app — a stray "exec"/"next-server" dock
  // icon. The bundled Helper apps are marked LSUIElement, so they stay
  // invisible; use one of them as our Node runtime.
  if (process.platform !== "darwin") return process.execPath;
  try {
    const frameworks = path.join(path.dirname(process.execPath), "..", "Frameworks");
    const helper = fs
      .readdirSync(frameworks)
      .find((n) => n.endsWith(" Helper.app"));
    if (helper) {
      const bin = path.join(frameworks, helper, "Contents", "MacOS", helper.replace(/\.app$/, ""));
      if (fs.existsSync(bin)) return bin;
    }
  } catch {}
  return process.execPath;
}

async function startServer(port) {
  const dir = serverDir();
  const entry = path.join(dir, "server.js");
  if (!fs.existsSync(entry)) {
    throw new Error(`server bundle not found at ${entry} — run \`npm run build\` in the repo root first`);
  }
  child = spawn(nodeBinary(), [entry], {
    cwd: dir,
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: "1",
      NODE_ENV: "production",
      PORT: String(port),
      HOSTNAME: "127.0.0.1",
      NETGRAM_DATA_DIR: app.getPath("userData"),
      NETGRAM_AUTH_TOKEN: token,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.on("data", (d) => console.log(`[server] ${d}`.trimEnd()));
  child.stderr.on("data", (d) => console.error(`[server] ${d}`.trimEnd()));
  child.on("exit", (code) => {
    console.error(`[server] exited with code ${code}`);
    child = null;
    if (!app.isQuitting) app.quit();
  });
}

async function waitForServer(timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${base}/api/auth/status`, {
        headers: { "x-netgram-token": token },
      });
      if (res.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error("server did not come up in time");
}

function openWindow(route = "/") {
  if (win && !win.isDestroyed()) {
    win.show();
    win.focus();
    win.loadURL(`${base}${route}`);
    return;
  }
  win = new BrowserWindow({
    width: 1000,
    height: 720,
    title: "NetGram",
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  });
  // External links (e.g. my.telegram.org) go to the real browser.
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
  win.on("closed", () => (win = null));
  win.loadURL(`${base}${route}`);
}

function buildTray() {
  const { nativeImage } = require("electron");
  const iconPath = path.join(__dirname, "build", "trayTemplate.png");
  let icon = nativeImage.createEmpty();
  if (fs.existsSync(iconPath)) {
    icon = nativeImage.createFromPath(iconPath);
    icon.setTemplateImage(true); // auto light/dark menubar
  }
  tray = new Tray(icon);
  if (icon.isEmpty()) tray.setTitle("NG");
  tray.setToolTip("NetGram — scoped Telegram access");
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "Open NetGram", click: () => openWindow("/") },
      { label: "Permissions", click: () => openWindow("/permissions") },
      { label: "Drafts", click: () => openWindow("/drafts") },
      { label: "Connect MCP", click: () => openWindow("/connect") },
      { type: "separator" },
      {
        label: "Start at Login",
        type: "checkbox",
        checked: app.getLoginItemSettings().openAtLogin,
        click: (item) => app.setLoginItemSettings({ openAtLogin: item.checked }),
      },
      { type: "separator" },
      { label: "Quit NetGram", click: () => app.quit() },
    ])
  );
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => openWindow("/"));

  app.whenReady().then(async () => {
    try {
      const conn = await loadConnection();
      const port = conn.port;
      token = conn.token;
      base = `http://127.0.0.1:${port}`;

      // Every request the app window makes carries the auth token, so the
      // middleware lets it through while other local processes get 401.
      session.defaultSession.webRequest.onBeforeSendHeaders(
        { urls: [`${base}/*`] },
        (details, cb) => {
          details.requestHeaders["x-netgram-token"] = token;
          cb({ requestHeaders: details.requestHeaders });
        }
      );

      await startServer(port);
      await waitForServer();
      buildTray();
      openWindow("/");
      // Menubar app: keep running with all windows closed, no dock focus steal.
      if (app.dock) app.dock.show(); // visible while a window is open
    } catch (e) {
      console.error(e);
      const { dialog } = require("electron");
      dialog.showErrorBox("NetGram failed to start", String(e.message || e));
      app.quit();
    }
  });

  app.on("window-all-closed", () => {
    // Stay alive in the menubar.
  });

  app.on("before-quit", () => {
    app.isQuitting = true;
    if (child) child.kill();
    // Remove discovery file so the CLI reports "not running" instead of
    // hitting a dead port.
    try {
      fs.unlinkSync(path.join(app.getPath("userData"), "endpoint.json"));
    } catch {}
  });
}
