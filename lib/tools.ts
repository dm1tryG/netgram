// The agent-facing tool surface, defined once and shared by every transport
// (the MCP route at /api/mcp; the stdio server in mcp/ proxies the HTTP API).
//
// Same contract as the web API it sits next to: READ and PROPOSE only. Nothing
// here can grant permissions or approve a draft — those stay human-only in the
// UI. The one exception is a chat the human marked "full", where a proposal
// executes immediately, exactly as the /api/drafts route does it.
import { z } from "zod";
import {
  clickCallbackButton,
  getChatMessages,
  getDialogList,
  getMessageById,
  isAuthorized,
  sendChatMessage,
  type DialogKind,
} from "./telegram";
import { ChatNotAllowedError, searchMessages } from "./search";
import {
  getAllowlist,
  isFullAllowed,
  isReadAllowed,
  isWriteAllowed,
} from "./allowlist";
import { createClickDraft, createMessageDraft, getDrafts } from "./drafts";

// Thrown for expected refusals (no access, bad button). The transport turns
// these into a tool error the model can read and act on, not a 500.
export class ToolError extends Error {}

export type Tool = {
  name: string;
  title: string;
  description: string;
  inputSchema: z.ZodRawShape;
  // Returns whatever should be handed to the model — objects are serialized.
  run: (args: Record<string, unknown>) => Promise<unknown>;
};

async function assertAuthorized() {
  if (!(await isAuthorized())) {
    throw new ToolError(
      "NetGram is not logged into Telegram. The human needs to sign in in the NetGram window first."
    );
  }
}

const levelOf = (p: { full: boolean; write: boolean; read: boolean }) =>
  p.full ? "full" : p.write ? "write" : p.read ? "read" : "off";

export const TOOLS: Tool[] = [
  {
    name: "list_chats",
    title: "List chats",
    description:
      "List Telegram dialogs with their granted access level (off/read/write/full) and kind (user/bot/group/channel). Optionally filter by kind or a title substring. Only chats above 'off' can be read or written.",
    inputSchema: {
      kind: z.enum(["user", "bot", "group", "channel"]).optional(),
      query: z
        .string()
        .optional()
        .describe("case-insensitive substring of the chat title"),
    },
    async run({ kind, query }) {
      await assertAuthorized();
      const [dialogs, allowlist] = [await getDialogList(2000), getAllowlist()];
      const q = typeof query === "string" ? query.toLowerCase() : null;
      return dialogs
        .filter((d) => (kind ? d.kind === kind : true))
        .filter((d) => (q ? d.title.toLowerCase().includes(q) : true))
        .map((d) => ({
          id: d.id,
          title: d.title,
          kind: d.kind,
          access: levelOf(
            allowlist[d.id] ?? { read: false, write: false, full: false }
          ),
        }));
    },
  },

  {
    name: "read_messages",
    title: "Read messages",
    description:
      "Read recent messages from a chat. Requires 'read' access, granted by the human on the Permissions page. Each message includes any inline buttons.",
    inputSchema: {
      chat_id: z.string().describe("chat id from list_chats"),
      limit: z
        .number()
        .int()
        .min(1)
        .max(200)
        .optional()
        .describe("recent messages to fetch (default 20)"),
    },
    async run({ chat_id, limit }) {
      await assertAuthorized();
      const id = String(chat_id);
      if (!isReadAllowed(id)) {
        throw new ToolError(
          `Chat ${id} is not read-allowed. Ask the human to enable Read on the Permissions page.`
        );
      }
      return getChatMessages(id, typeof limit === "number" ? limit : 20);
    },
  },

  {
    name: "search_messages",
    title: "Search messages",
    description:
      "Search messages by keyword across every chat the human granted 'read' access to — chats set to 'off' are never searched and never appear in the results. Returns the matching messages with the chat they came from; long texts are trimmed, so use read_messages on a hit to see full context. Pass chat_id to search inside a single chat instead.",
    inputSchema: {
      query: z.string().min(1).describe("keyword or phrase to look for"),
      limit: z
        .number()
        .int()
        .min(1)
        .max(50)
        .optional()
        .describe("how many matches to return (default 20)"),
      chat_id: z
        .string()
        .optional()
        .describe("restrict the search to one chat id from list_chats"),
      kind: z
        .enum(["user", "bot", "group", "channel"])
        .optional()
        .describe("only search chats of this kind"),
      since: z
        .string()
        .optional()
        .describe("ISO date, e.g. 2026-08-01 — only messages sent on or after it"),
      until: z
        .string()
        .optional()
        .describe("ISO date — only messages sent before it"),
    },
    async run({ query, limit, chat_id, kind, since, until }) {
      await assertAuthorized();
      const q = String(query ?? "").trim();
      if (!q) throw new ToolError("query is empty");

      const toEpoch = (value: unknown, label: string): number | undefined => {
        if (value == null) return undefined;
        const ms = Date.parse(String(value));
        if (Number.isNaN(ms)) {
          throw new ToolError(
            `${label} is not a date I can read: ${String(value)}. Use ISO, e.g. 2026-08-01.`
          );
        }
        return Math.floor(ms / 1000);
      };

      try {
        const result = await searchMessages({
          query: q,
          limit: typeof limit === "number" ? limit : 20,
          chatId: chat_id ? String(chat_id) : undefined,
          kind: kind as DialogKind | undefined,
          minDate: toEpoch(since, "since"),
          maxDate: toEpoch(until, "until"),
        });
        if (result.hits.length === 0) {
          return {
            ...result,
            note: "No matches in the allowed chats. Either nothing matches, or the chats that hold it are still set to 'off' — list_chats shows which are readable.",
          };
        }
        return result;
      } catch (e) {
        if (e instanceof ChatNotAllowedError) {
          throw new ToolError(
            `Chat ${e.message} is not read-allowed. Ask the human to enable Read on the Permissions page.`
          );
        }
        throw e;
      }
    },
  },

  {
    name: "propose_message",
    title: "Propose a message (draft)",
    description:
      "Propose sending a text message to a chat. Requires 'write' access. Creates a DRAFT the human approves in the NetGram UI — it is NOT sent immediately, unless the chat is set to 'full'.",
    inputSchema: { chat_id: z.string(), text: z.string() },
    async run({ chat_id, text }) {
      await assertAuthorized();
      const id = String(chat_id);
      const body = String(text ?? "");
      if (!body) throw new ToolError("text is empty");
      if (!isWriteAllowed(id)) {
        throw new ToolError(
          `Chat ${id} is not write-allowed. Ask the human to enable Write on the Permissions page.`
        );
      }
      if (isFullAllowed(id)) {
        const message = await sendChatMessage(id, body);
        return {
          executed: true,
          message,
          note: "Sent immediately — this chat has 'full' access.",
        };
      }
      const draft = createMessageDraft(id, body);
      return {
        executed: false,
        draft,
        note: "Draft created. Awaiting human approval in the NetGram UI (Drafts).",
      };
    },
  },

  {
    name: "propose_button_click",
    title: "Propose a button click (draft)",
    description:
      "Propose clicking an inline callback button on a message. Reference the button by 0-based index (counting across rows, as returned by read_messages) or by its exact text. Requires 'write' access. Creates a draft for human approval unless the chat is 'full'.",
    inputSchema: {
      chat_id: z.string(),
      message_id: z.number().int(),
      button: z
        .union([z.number().int(), z.string()])
        .describe("button index (0-based) or exact button text"),
    },
    async run({ chat_id, message_id, button }) {
      await assertAuthorized();
      const id = String(chat_id);
      const msgId = Number(message_id);
      if (!isWriteAllowed(id)) {
        throw new ToolError(
          `Chat ${id} is not write-allowed. Ask the human to enable Write on the Permissions page.`
        );
      }
      const message = await getMessageById(id, msgId);
      if (!message) throw new ToolError(`Message ${msgId} not found in ${id}.`);

      // Resolve the button here so callers never touch raw callback bytes.
      const flat = message.buttons.flat();
      const btn =
        typeof button === "number"
          ? flat[button]
          : flat.find((b) => b.text === button);
      if (!btn) {
        throw new ToolError(
          `Button ${JSON.stringify(button)} not found. Available: ${
            flat.map((b) => b.text).join(", ") || "(none)"
          }`
        );
      }
      if (btn.kind === "url") {
        throw new ToolError(
          `That is a URL button — no click needed, just open: ${btn.url}`
        );
      }
      if (btn.kind !== "callback" || !btn.data) {
        throw new ToolError(`Button "${btn.text}" is not clickable.`);
      }

      if (isFullAllowed(id)) {
        const answer = await clickCallbackButton(id, msgId, btn.data);
        return {
          executed: true,
          buttonText: btn.text,
          answer,
          note: "Clicked immediately — this chat has 'full' access.",
        };
      }
      const draft = createClickDraft(id, msgId, btn.text, btn.data);
      return {
        executed: false,
        draft,
        note: "Click draft created. Awaiting human approval in the NetGram UI (Drafts).",
      };
    },
  },

  {
    name: "list_drafts",
    title: "List drafts",
    description:
      "List pending and sent drafts (messages and button clicks). Read-only: an agent cannot approve a draft — the human does that in the NetGram UI.",
    inputSchema: {},
    async run() {
      await assertAuthorized();
      return getDrafts();
    },
  },
];
