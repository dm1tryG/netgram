import { NextResponse } from "next/server";
import {
  clickCallbackButton,
  isAuthorized,
  sendChatMessage,
} from "@/lib/telegram";
import { isWriteAllowed } from "@/lib/allowlist";
import { getDraft, markSent } from "@/lib/drafts";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAuthorized())) {
    return NextResponse.json({ error: "not_authorized" }, { status: 401 });
  }
  const { id } = await params;
  const draft = getDraft(id);
  if (!draft) {
    return NextResponse.json({ error: "draft_not_found" }, { status: 404 });
  }
  if (draft.status === "sent") {
    return NextResponse.json({ error: "already_sent" }, { status: 409 });
  }
  // Re-check write permission at approval time — it may have been revoked after
  // the draft was created.
  if (!isWriteAllowed(draft.chatId)) {
    return NextResponse.json({ error: "chat_not_writable" }, { status: 403 });
  }

  if (draft.kind === "click") {
    if (draft.messageId === undefined || !draft.data) {
      return NextResponse.json({ error: "invalid_click_draft" }, { status: 400 });
    }
    const answer = await clickCallbackButton(
      draft.chatId,
      draft.messageId,
      draft.data
    );
    const updated = markSent(id, { clickResult: answer });
    return NextResponse.json({ ok: true, draft: updated, answer });
  }

  if (!draft.text) {
    return NextResponse.json({ error: "invalid_message_draft" }, { status: 400 });
  }
  const sent = await sendChatMessage(draft.chatId, draft.text);
  const updated = markSent(id, { sentMessageId: sent.id });
  return NextResponse.json({ ok: true, draft: updated });
}
