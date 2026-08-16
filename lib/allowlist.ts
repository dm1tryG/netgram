import fs from "node:fs";
import path from "node:path";
import { DATA_DIR } from "./paths";

const ALLOWLIST_PATH = path.join(DATA_DIR, "allowlist.json");

export type Permission = { read: boolean; write: boolean; full: boolean };
export type AllowlistMap = Record<string, Permission>;

function readAllowlist(): AllowlistMap {
  try {
    const raw = fs.readFileSync(ALLOWLIST_PATH, "utf-8");
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: AllowlistMap = {};
    for (const [id, perm] of Object.entries(parsed)) {
      const p = perm as Partial<Permission>;
      out[id] = {
        read: Boolean(p?.read),
        write: Boolean(p?.write),
        full: Boolean(p?.full),
      };
    }
    return out;
  } catch {
    return {};
  }
}

function writeAllowlist(map: AllowlistMap) {
  fs.mkdirSync(path.dirname(ALLOWLIST_PATH), { recursive: true });
  fs.writeFileSync(ALLOWLIST_PATH, JSON.stringify(map, null, 2));
}

export function getAllowlist(): AllowlistMap {
  return readAllowlist();
}

export function getPermission(chatId: string): Permission {
  return readAllowlist()[chatId] ?? { read: false, write: false, full: false };
}

export function isReadAllowed(chatId: string): boolean {
  return getPermission(chatId).read;
}

export function isWriteAllowed(chatId: string): boolean {
  return getPermission(chatId).write;
}

// "full" = AI may act autonomously (send/click execute immediately, with no
// manual Drafts approval). Always implies write, which implies read.
export function isFullAllowed(chatId: string): boolean {
  return getPermission(chatId).full;
}

export type Level = "off" | "read" | "write" | "full";

// Single escalating access level per chat: full ⊃ write ⊃ read. There is no
// write-without-read or full-without-write state.
export function setLevel(chatId: string, level: Level): AllowlistMap {
  const map = readAllowlist();
  if (level === "off") {
    delete map[chatId];
  } else {
    map[chatId] = {
      read: true,
      write: level === "write" || level === "full",
      full: level === "full",
    };
  }
  writeAllowlist(map);
  return map;
}
