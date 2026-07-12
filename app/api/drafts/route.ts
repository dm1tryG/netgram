import { NextResponse } from "next/server";
import {
  clickCallbackButton,
  getMessageById,
  isAuthorized,
  sendChatMessage,
} from "@/lib/telegram";
import { isFullAllowed, isWriteAllowed } from "@/lib/allowlist";
import { createClickDraft, createMessageDraft, getDrafts } from "@/lib/drafts";

export async function GET() {
  if (!(await isAuthorized())) {
    return NextResponse.json({ error: "not_authorized" }, { status: 401 });
  }
  return NextResponse.json({ drafts: getDrafts() });
}

export async function POST(req: Request) {
  if (!(await isAuthorized())) {
    return NextResponse.json({ error: "not_authorized" }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  const chatId = body?.chatId;
  if (!chatId || typeof chatId !== "string") {
    return NextResponse.json({ error: "missing_chat_id" }, { status: 400 });
  }
  // Any pending action (message or click) may only target a write-allowed chat
  // — enforced server-side, same as a real send/click would have been.
  if (!isWriteAllowed(chatId)) {
    return NextResponse.json({ error: "chat_not_writable" }, { status: 403 });
  }

  const kind = body?.kind === "click" ? "click" : "message";

  // "full" chats let the AI act autonomously: execute immediately, no draft.
  const full = isFullAllowed(chatId);

  if (kind === "message") {
    const text = body?.text;
    if (!text || typeof text !== "string") {
      return NextResponse.json({ error: "missing_text" }, { status: 400 });
    }
    if (full) {
      const message = await sendChatMessage(chatId, text);
      return NextResponse.json({ executed: true, message });
    }
    const draft = createMessageDraft(chatId, text);
    return NextResponse.json({ draft }, { status: 201 });
  }

  // kind === "click": resolve the target button server-side so callers never
  // handle raw callback bytes — they pass a button index or its exact text.
  const messageId = Number(body?.messageId);
  if (!Number.isFinite(messageId)) {
    return NextResponse.json({ error: "missing_message_id" }, { status: 400 });
  }
  const message = await getMessageById(chatId, messageId);
  if (!message) {
    return NextResponse.json({ error: "message_not_found" }, { status: 404 });
  }
  const flat = message.buttons.flat();
  const selector = body?.button;
  const btn =
    typeof selector === "number"
      ? flat[selector]
      : flat.find((b) => b.text === selector);
  if (!btn) {
    return NextResponse.json({ error: "button_not_found" }, { status: 404 });
  }
  if (btn.kind === "url") {
    return NextResponse.json(
      { error: "url_button", url: btn.url },
      { status: 422 }
    );
  }
  if (btn.kind !== "callback" || !btn.data) {
    return NextResponse.json({ error: "button_not_clickable" }, { status: 422 });
  }
  if (full) {
    const answer = await clickCallbackButton(chatId, messageId, btn.data);
    return NextResponse.json({ executed: true, answer, buttonText: btn.text });
  }
  const draft = createClickDraft(chatId, messageId, btn.text, btn.data);
  return NextResponse.json({ draft }, { status: 201 });
}
