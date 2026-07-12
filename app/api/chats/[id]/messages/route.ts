import { NextResponse } from "next/server";
import { getChatMessages, isAuthorized } from "@/lib/telegram";
import { isReadAllowed } from "@/lib/allowlist";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAuthorized())) {
    return NextResponse.json({ error: "not_authorized" }, { status: 401 });
  }
  const { id } = await params;
  if (!isReadAllowed(id)) {
    return NextResponse.json({ error: "chat_not_allowed" }, { status: 403 });
  }
  const limitParam = new URL(req.url).searchParams.get("limit");
  const limit = limitParam ? Math.min(Number(limitParam) || 20, 200) : 20;
  const messages = await getChatMessages(id, limit);
  return NextResponse.json({ messages });
}
