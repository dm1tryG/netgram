"use client";

import { createContext, useContext } from "react";

// UI copy lives here as a flat string table — one language (English), looked
// up through the `t()` helper so wording stays in one file.
const DICT: Record<string, string> = {
  "nav.permissions": "Permissions",
  "nav.drafts": "Drafts",
  "nav.connect": "Connect MCP",
  "user.loading": "Loading...",

  "connect.title": "Connect MCP",
  "connect.desc":
    "NetGram serves its own MCP server over HTTP. Add it to Claude Code, Claude Desktop or Cursor — there is nothing to install.",
  "connect.cli": "Claude Code (terminal)",
  "connect.json": "Claude Desktop / Cursor — config file",
  "connect.copy": "Copy",
  "connect.copied": "Copied",
  "connect.noToken":
    "No token is set — the port is open without auth. That happens in dev or Docker; the Mac app always sets one.",
  "connect.tools": "What the agent gets",
  "connect.safety":
    "Over MCP nothing can grant itself access or approve a draft — that stays manual, here. Sending happens immediately only in chats set to “Full”.",

  "permissions.title": "Permissions",
  "permissions.desc":
    "Read — AI sees messages. Write — AI proposes drafts (you approve manually). Full — AI acts on its own, with no approval.",
  "permissions.search": "Search chats and channels by name...",
  "permissions.refresh": "↻ Refresh",
  "permissions.refreshing": "Refreshing…",
  "filter.all": "All types",
  "filter.user": "People",
  "filter.bot": "Bots",
  "filter.group": "Groups",
  "filter.channel": "Channels",
  "sidebar.collapse": "Collapse panel",
  "sidebar.expand": "Expand panel",
  "permissions.empty": "Nothing found.",
  "permissions.loading": "Loading chats...",
  "permissions.error": "Failed to load chats",

  "level.read": "Read",
  "level.write": "Write",
  "level.full": "Full",
  "level.read.tip": "AI can read this chat's messages.",
  "level.write.tip":
    "AI proposes messages and button clicks — you approve them manually in Drafts.",
  "level.full.tip":
    "Full access: AI acts on its own, with no approval — sends and clicks instantly. Use with care.",

  "drafts.title": "Drafts",
  "drafts.desc":
    "Actions proposed by the AI: messages and button clicks. They run in Telegram only from here — manually.",
  "drafts.empty.pre": "No drafts. The AI creates them with",
  "drafts.empty.or": "or",
  "drafts.loading": "Loading drafts...",
  "drafts.error": "Failed to load drafts",

  "draft.kind.message": "message",
  "draft.kind.click": "click · msg #",
  "draft.badge.done": "Done",
  "draft.badge.click": "Click",
  "draft.badge.draft": "Draft",
  "draft.pressButton": "Press button",
  "draft.botAnswer": "Bot answer:",
  "draft.confirm.send": "Send to Telegram?",
  "draft.confirm.click": "Press this button in Telegram?",
  "draft.confirm.irreversible": "This can't be undone.",

  "btn.send": "Send",
  "btn.press": "Press",
  "btn.delete": "Delete",
  "btn.cancel": "Cancel",
  "btn.confirm": "Yes, do it",
  "btn.sending": "Sending...",
  "btn.clicking": "Clicking...",

  "err.chat_not_writable": "Chat is no longer writable — action blocked.",
  "err.already_sent": "Already done.",
  "err.draft_not_found": "Draft not found.",
  "err.invalid_click_draft": "Click draft is corrupted.",
  "err.default": "Action failed.",

  "setup.title": "NetGram — setup",
  "setup.desc":
    "NetGram uses your own Telegram application. This is a one-time step — everything is stored locally.",
  "setup.step1.pre": "1. Open",
  "setup.step1.post": "and sign in.",
  "setup.step2": "2. Create application (any name/platform).",
  "setup.step3.pre": "3. Copy the",
  "setup.step3.post": "→ paste them below.",
  "setup.phone": "Phone (with country code)",
  "setup.saving": "Saving...",
  "setup.continue": "Continue → sign in",
  "setup.localNote.pre": "Your data stays on this machine (",
  "setup.localNote.post": "), nothing goes to any cloud.",
  "setup.err.bad_api_id": "api_id is the number from my.telegram.org.",
  "setup.err.bad_api_hash":
    "api_hash is 32 hex characters. Make sure you copied all of it.",
  "setup.err.bad_phone": "Phone must look like +99955... (with country code).",
  "setup.err.default": "Could not save. Check the fields.",

  "login.title": "NetGram — sign in",
  "login.sending": "Sending the code to Telegram...",
  "login.retry": "Resend code",
  "login.codeSent": "Code sent to Telegram.",
  "login.codePlaceholder": "Code from Telegram",
  "login.signin": "Sign in",
  "login.checking": "Checking...",
  "login.twofaHint": "2FA is on — enter your password.",
  "login.twofaPlaceholder": "2FA password",
  "login.confirm": "Confirm",
  "login.done": "Done, redirecting...",
  "login.err.sendCode": "Could not send the code",
  "login.err.badCode": "Wrong code",
  "login.err.badPassword": "Wrong password",
};

type Ctx = { t: (key: string) => string };

const LocaleContext = createContext<Ctx>({ t: (k) => k });

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const t = (key: string) => DICT[key] ?? key;

  return (
    <LocaleContext.Provider value={{ t }}>{children}</LocaleContext.Provider>
  );
}

export function useI18n(): Ctx {
  return useContext(LocaleContext);
}
