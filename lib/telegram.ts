import fs from "node:fs";
import path from "node:path";
import { TelegramClient, Api, utils } from "telegram";
import { StringSession } from "telegram/sessions";
import { computeCheck } from "telegram/Password";
import { DATA_DIR } from "./paths";

const SESSION_PATH = path.join(DATA_DIR, "session");
const CONFIG_PATH = path.join(DATA_DIR, "config.json");

export type EnvCreds = { apiId: number; apiHash: string; phone: string };

// Credentials come from either environment variables (power users / docker
// env_file) or the config file written by the in-app setup wizard, so a fresh
// user can just run the container and fill the form — no file editing.
export function getEnvCreds(): EnvCreds | null {
  const envId = process.env.TG_API_ID;
  const envHash = process.env.TG_API_HASH;
  const envPhone = process.env.TG_PHONE;
  if (envId && envHash && envPhone) {
    return { apiId: Number(envId), apiHash: envHash, phone: envPhone };
  }
  try {
    const c = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
    if (c?.apiId && c?.apiHash && c?.phone) {
      return {
        apiId: Number(c.apiId),
        apiHash: String(c.apiHash),
        phone: String(c.phone),
      };
    }
  } catch {
    // no stored config yet
  }
  return null;
}

export function saveCreds(creds: EnvCreds): void {
  fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(creds, null, 2));
  // Drop any client built before creds existed so it's recreated with them.
  globalThis.__netgramClient = undefined;
}

function readSessionString(): string {
  try {
    return fs.readFileSync(SESSION_PATH, "utf-8");
  } catch {
    return "";
  }
}

function writeSessionString(s: string) {
  fs.mkdirSync(path.dirname(SESSION_PATH), { recursive: true });
  fs.writeFileSync(SESSION_PATH, s);
}

export function hasSessionFile(): boolean {
  return fs.existsSync(SESSION_PATH);
}

// Singleton client + transient login state survive Next.js dev-server hot
// reloads only if stashed on globalThis (module instances get re-evaluated).
declare global {
  // eslint-disable-next-line no-var
  var __netgramClient: TelegramClient | undefined;
  // eslint-disable-next-line no-var
  var __netgramLoginState: { phone: string; phoneCodeHash: string } | undefined;
  // eslint-disable-next-line no-var
  var __netgramDialogs: { at: number; data: DialogSummary[] } | undefined;
}

function getClient(): TelegramClient {
  const creds = getEnvCreds();
  if (!creds) throw new Error("MISSING_ENV");
  if (!globalThis.__netgramClient) {
    globalThis.__netgramClient = new TelegramClient(
      new StringSession(readSessionString()),
      creds.apiId,
      creds.apiHash,
      { connectionRetries: 5 }
    );
  }
  return globalThis.__netgramClient;
}

async function ensureConnected(): Promise<TelegramClient> {
  const client = getClient();
  if (!client.connected) {
    await client.connect();
  }
  return client;
}

export async function isAuthorized(): Promise<boolean> {
  if (!getEnvCreds() || !hasSessionFile()) return false;
  try {
    const client = await ensureConnected();
    return await client.checkAuthorization();
  } catch {
    return false;
  }
}

export async function sendLoginCode(): Promise<void> {
  const creds = getEnvCreds();
  if (!creds) throw new Error("MISSING_ENV");
  const client = await ensureConnected();
  const result = await client.sendCode(
    { apiId: creds.apiId, apiHash: creds.apiHash },
    creds.phone
  );
  globalThis.__netgramLoginState = {
    phone: creds.phone,
    phoneCodeHash: result.phoneCodeHash,
  };
}

export async function submitLoginCode(
  code: string
): Promise<{ ok: true } | { need2FA: true }> {
  const state = globalThis.__netgramLoginState;
  if (!state) throw new Error("NO_PENDING_LOGIN");
  const client = await ensureConnected();
  try {
    await client.invoke(
      new Api.auth.SignIn({
        phoneNumber: state.phone,
        phoneCodeHash: state.phoneCodeHash,
        phoneCode: code,
      })
    );
    writeSessionString(client.session.save() as unknown as string);
    globalThis.__netgramLoginState = undefined;
    return { ok: true };
  } catch (err) {
    if (err instanceof Error && "errorMessage" in err && err.errorMessage === "SESSION_PASSWORD_NEEDED") {
      return { need2FA: true };
    }
    throw err;
  }
}

export async function submit2FAPassword(password: string): Promise<void> {
  const client = await ensureConnected();
  const passwordSrpResult = await client.invoke(new Api.account.GetPassword());
  const passwordSrpCheck = await computeCheck(passwordSrpResult, password);
  await client.invoke(new Api.auth.CheckPassword({ password: passwordSrpCheck }));
  writeSessionString(client.session.save() as unknown as string);
  globalThis.__netgramLoginState = undefined;
}

export type MeSummary = {
  id: string;
  firstName: string;
  lastName: string;
  username: string | null;
  phone: string | null;
};

export async function getMe(): Promise<MeSummary> {
  const client = await ensureConnected();
  const me = await client.getMe();
  return {
    id: me.id?.toString() ?? "",
    firstName: "firstName" in me ? me.firstName ?? "" : "",
    lastName: "lastName" in me ? me.lastName ?? "" : "",
    username: "username" in me ? me.username ?? null : null,
    phone: "phone" in me ? me.phone ?? null : null,
  };
}

export type DialogKind = "user" | "bot" | "group" | "channel";

export type DialogSummary = {
  id: string;
  title: string;
  kind: DialogKind;
};

// Dialogs rarely change and getDialogs() is a slow Telegram round-trip, so the
// list is cached in-memory and only refetched on TTL expiry or explicit refresh.
const DIALOGS_TTL_MS = 10 * 60 * 1000;

function dialogKind(d: {
  isChannel?: boolean;
  isGroup?: boolean;
  entity?: unknown;
}): DialogKind {
  if (d.isChannel) return "channel";
  if (d.isGroup) return "group";
  const entity = d.entity as { bot?: boolean } | undefined;
  if (entity && "bot" in entity && entity.bot) return "bot";
  return "user";
}

export function getDialogsCachedAt(): number | null {
  return globalThis.__netgramDialogs?.at ?? null;
}

export async function getDialogList(
  limit = 2000,
  opts?: { refresh?: boolean }
): Promise<DialogSummary[]> {
  const cache = globalThis.__netgramDialogs;
  if (!opts?.refresh && cache && Date.now() - cache.at < DIALOGS_TTL_MS) {
    return cache.data;
  }
  const client = await ensureConnected();
  // Telegram splits dialogs into the main list and the archived folder, and a
  // low limit silently truncates large accounts (hundreds of chats). Fetch both
  // with a generous limit and merge, so nothing is missing from the allowlist.
  // Sequentially, not in parallel — concurrent getDialogs on one client share
  // pagination state and clobber each other's results.
  const main = await client.getDialogs({ limit });
  const archived = await client.getDialogs({ limit, archived: true });
  const seen = new Set<string>();
  const data: DialogSummary[] = [];
  for (const d of [...main, ...archived]) {
    const id = d.id?.toString();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    data.push({
      id,
      title: d.title || d.name || "",
      kind: dialogKind(d),
    });
  }
  globalThis.__netgramDialogs = { at: Date.now(), data };
  return data;
}

export type MsgButton = {
  text: string;
  kind: "url" | "callback" | "other";
  url?: string;
  data?: string; // base64-encoded callback payload (for callback buttons)
};

export type ChatMessage = {
  id: number;
  date: number;
  text: string;
  fromId: string | null;
  buttons: MsgButton[][]; // inline keyboard rows (empty if none)
};

// m.fromId is a Peer (PeerUser/PeerChannel/PeerChat), not a scalar — pull the
// numeric id out of whichever field the peer carries.
function peerToId(peer: unknown): string | null {
  if (!peer || typeof peer !== "object") return null;
  const p = peer as {
    userId?: unknown;
    channelId?: unknown;
    chatId?: unknown;
  };
  if (p.userId != null) return String(p.userId);
  if (p.channelId != null) return String(p.channelId);
  if (p.chatId != null) return String(p.chatId);
  return null;
}

function parseButtons(replyMarkup: unknown): MsgButton[][] {
  const rows = (replyMarkup as { rows?: unknown })?.rows;
  if (!Array.isArray(rows)) return [];
  return rows.map((row: { buttons?: unknown[] }) =>
    (row.buttons ?? []).map((btn): MsgButton => {
      const b = btn as {
        className?: string;
        text?: string;
        url?: string;
        data?: Uint8Array;
      };
      const text = b.text ?? "";
      if (b.className === "KeyboardButtonUrl" || b.url) {
        return { text, kind: "url", url: b.url };
      }
      if (b.className === "KeyboardButtonCallback" || b.data) {
        return {
          text,
          kind: "callback",
          data: b.data ? Buffer.from(b.data).toString("base64") : undefined,
        };
      }
      return { text, kind: "other" };
    })
  );
}

export async function getChatMessages(
  chatId: string,
  limit = 20
): Promise<ChatMessage[]> {
  const client = await ensureConnected();
  const messages = await client.getMessages(chatId, { limit });
  return messages.map((m) => ({
    id: m.id,
    date: m.date,
    text: m.message ?? "",
    fromId: peerToId(m.fromId),
    buttons: parseButtons(m.replyMarkup),
  }));
}

// One message found by a search, tagged with the chat it came from. Buttons are
// deliberately omitted — a hit is a pointer; read_messages gives the full view.
export type MessageHit = {
  chatId: string;
  id: number;
  date: number;
  text: string;
  fromId: string | null;
};

export type SearchKind = "user" | "bot" | "group" | "channel";

export type GlobalSearchOffset = {
  rate: number;
  chatId: string;
  messageId: number;
};

export type GlobalSearchPage = {
  hits: MessageHit[];
  // Absent when Telegram has nothing more to give.
  next?: GlobalSearchOffset;
};

function toHit(m: Api.Message): MessageHit | null {
  // Service messages (joins, pins) carry no text and are noise in search.
  if (m.className !== "Message") return null;
  return {
    chatId: utils.getPeerId(m.peerId),
    id: m.id,
    date: m.date,
    text: m.message ?? "",
    fromId: peerToId(m.fromId),
  };
}

// One page of Telegram's cross-chat search. Note what this does NOT do: it has
// no idea which chats the human allowed, so its output must never reach an
// agent unfiltered — lib/search.ts is the only intended caller.
export async function searchGlobalPage(opts: {
  query: string;
  limit: number;
  kind?: SearchKind;
  minDate?: number; // unix seconds, 0 = unbounded
  maxDate?: number;
  offset?: GlobalSearchOffset;
}): Promise<GlobalSearchPage> {
  const client = await ensureConnected();

  // Narrowing at the API level beats filtering afterwards: fewer pages wasted
  // on hits we would throw away. Bots are users as far as Telegram is
  // concerned, so both map to usersOnly.
  const kind = opts.kind;
  const offsetPeer = opts.offset
    ? await client.getInputEntity(opts.offset.chatId)
    : new Api.InputPeerEmpty();

  const res = (await client.invoke(
    new Api.messages.SearchGlobal({
      q: opts.query,
      filter: new Api.InputMessagesFilterEmpty(),
      minDate: opts.minDate ?? 0,
      maxDate: opts.maxDate ?? 0,
      offsetRate: opts.offset?.rate ?? 0,
      offsetPeer,
      offsetId: opts.offset?.messageId ?? 0,
      limit: opts.limit,
      usersOnly: kind === "user" || kind === "bot" ? true : undefined,
      groupsOnly: kind === "group" ? true : undefined,
      broadcastsOnly: kind === "channel" ? true : undefined,
    })
  )) as unknown as { messages?: Api.Message[]; nextRate?: number };

  const raw = res.messages ?? [];
  const hits = raw.map(toHit).filter((h): h is MessageHit => h !== null);

  // Paging needs all three: Telegram's rate cursor plus the last message's
  // (peer, id). No nextRate means this was the final page.
  const last = raw[raw.length - 1];
  const next =
    res.nextRate != null && last
      ? {
          rate: res.nextRate,
          chatId: utils.getPeerId(last.peerId),
          messageId: last.id,
        }
      : undefined;

  return { hits, next };
}

// Search inside a single chat. Cheaper and exhaustive where global search is
// broad — used when the caller already knows which chat it wants.
export async function searchChatMessages(
  chatId: string,
  query: string,
  limit: number
): Promise<MessageHit[]> {
  const client = await ensureConnected();
  const messages = await client.getMessages(chatId, { search: query, limit });
  return messages
    .map((m) => toHit(m as unknown as Api.Message))
    .filter((h): h is MessageHit => h !== null);
}

export async function sendChatMessage(
  chatId: string,
  text: string
): Promise<{ id: number; date: number }> {
  const client = await ensureConnected();
  const sent = await client.sendMessage(chatId, { message: text });
  return { id: sent.id, date: sent.date };
}

export async function getMessageById(
  chatId: string,
  messageId: number
): Promise<ChatMessage | null> {
  const client = await ensureConnected();
  const messages = await client.getMessages(chatId, { ids: [messageId] });
  const m = messages[0];
  if (!m) return null;
  return {
    id: m.id,
    date: m.date,
    text: m.message ?? "",
    fromId: peerToId(m.fromId),
    buttons: parseButtons(m.replyMarkup),
  };
}

// Press an inline callback button. Returns the bot's answer text (the toast/
// alert it shows), if any. Callback data is the base64 payload captured from
// the button when the draft was created.
export async function clickCallbackButton(
  chatId: string,
  messageId: number,
  dataBase64: string
): Promise<string> {
  const client = await ensureConnected();
  const result = await client.invoke(
    new Api.messages.GetBotCallbackAnswer({
      peer: chatId,
      msgId: messageId,
      data: Buffer.from(dataBase64, "base64"),
    })
  );
  return result.message ?? "";
}
