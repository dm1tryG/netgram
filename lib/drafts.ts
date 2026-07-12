import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { DATA_DIR } from "./paths";

const DRAFTS_PATH = path.join(DATA_DIR, "drafts.json");

export type DraftStatus = "pending" | "sent";
export type DraftKind = "message" | "click";

// A Draft is a pending action awaiting manual approval in the UI. Two kinds:
//  - "message": send `text` to `chatId`.
//  - "click":   press the callback button `buttonText` (payload `data`) on
//               message `messageId` in `chatId`.
export type Draft = {
  id: string;
  kind: DraftKind;
  chatId: string;
  createdAt: number; // epoch seconds
  status: DraftStatus;
  sentAt?: number;
  // message
  text?: string;
  // click
  messageId?: number;
  buttonText?: string;
  data?: string; // base64 callback payload
  // results (filled on approval)
  sentMessageId?: number; // message send
  clickResult?: string; // bot's callback answer text
};

function readDrafts(): Draft[] {
  try {
    const raw = fs.readFileSync(DRAFTS_PATH, "utf-8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (d): d is Draft =>
          d && typeof d.id === "string" && typeof d.chatId === "string"
      )
      // Drafts written before "click" support lack `kind` — default to message.
      .map((d) => ({ ...d, kind: d.kind ?? "message" }));
  } catch {
    return [];
  }
}

function writeDrafts(drafts: Draft[]) {
  fs.mkdirSync(path.dirname(DRAFTS_PATH), { recursive: true });
  fs.writeFileSync(DRAFTS_PATH, JSON.stringify(drafts, null, 2));
}

export function getDrafts(): Draft[] {
  // Newest first.
  return readDrafts().sort((a, b) => b.createdAt - a.createdAt);
}

export function getDraft(id: string): Draft | undefined {
  return readDrafts().find((d) => d.id === id);
}

function addDraft(draft: Draft): Draft {
  const drafts = readDrafts();
  drafts.push(draft);
  writeDrafts(drafts);
  return draft;
}

export function createMessageDraft(chatId: string, text: string): Draft {
  return addDraft({
    id: crypto.randomUUID(),
    kind: "message",
    chatId,
    text,
    createdAt: Math.floor(Date.now() / 1000),
    status: "pending",
  });
}

export function createClickDraft(
  chatId: string,
  messageId: number,
  buttonText: string,
  data: string
): Draft {
  return addDraft({
    id: crypto.randomUUID(),
    kind: "click",
    chatId,
    messageId,
    buttonText,
    data,
    createdAt: Math.floor(Date.now() / 1000),
    status: "pending",
  });
}

export function markSent(
  id: string,
  result: { sentMessageId?: number; clickResult?: string }
): Draft | undefined {
  const drafts = readDrafts();
  const draft = drafts.find((d) => d.id === id);
  if (!draft) return undefined;
  draft.status = "sent";
  draft.sentAt = Math.floor(Date.now() / 1000);
  if (result.sentMessageId !== undefined)
    draft.sentMessageId = result.sentMessageId;
  if (result.clickResult !== undefined) draft.clickResult = result.clickResult;
  writeDrafts(drafts);
  return draft;
}

export function deleteDraft(id: string): boolean {
  const drafts = readDrafts();
  const next = drafts.filter((d) => d.id !== id);
  if (next.length === drafts.length) return false;
  writeDrafts(next);
  return true;
}
