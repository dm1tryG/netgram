import { NextResponse } from "next/server";
import { isAuthorized } from "@/lib/telegram";
import { ChatNotAllowedError, searchMessages } from "@/lib/search";
import type { DialogKind } from "@/lib/telegram";

const KINDS = ["user", "bot", "group", "channel"] as const;

function epoch(value: string | null): number | undefined {
  if (!value) return undefined;
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? undefined : Math.floor(ms / 1000);
}

export async function GET(req: Request) {
  if (!(await isAuthorized())) {
    return NextResponse.json({ error: "not_authorized" }, { status: 401 });
  }
  const params = new URL(req.url).searchParams;
  const query = (params.get("q") ?? "").trim();
  if (!query) {
    return NextResponse.json({ error: "empty_query" }, { status: 422 });
  }
  const limitParam = Number(params.get("limit"));
  const kind = params.get("kind");

  try {
    const result = await searchMessages({
      query,
      limit: Math.min(limitParam > 0 ? limitParam : 20, 50),
      chatId: params.get("chat_id") ?? undefined,
      kind: KINDS.includes(kind as DialogKind)
        ? (kind as DialogKind)
        : undefined,
      minDate: epoch(params.get("since")),
      maxDate: epoch(params.get("until")),
    });
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof ChatNotAllowedError) {
      return NextResponse.json({ error: "chat_not_allowed" }, { status: 403 });
    }
    throw e;
  }
}
