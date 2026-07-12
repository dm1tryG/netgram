import { NextResponse } from "next/server";
import { getDialogList, isAuthorized } from "@/lib/telegram";
import { getAllowlist } from "@/lib/allowlist";

export async function GET() {
  if (!(await isAuthorized())) {
    return NextResponse.json({ error: "not_authorized" }, { status: 401 });
  }
  const allowlist = getAllowlist();
  const dialogs = await getDialogList();
  return NextResponse.json({
    chats: dialogs
      .filter((d) => allowlist[d.id]?.read)
      .map((d) => ({
        ...d,
        write: Boolean(allowlist[d.id]?.write),
        full: Boolean(allowlist[d.id]?.full),
      })),
  });
}
