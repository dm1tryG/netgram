import { NextResponse } from "next/server";
import { getDialogList, getDialogsCachedAt, isAuthorized } from "@/lib/telegram";
import { getAllowlist } from "@/lib/allowlist";

export async function GET(req: Request) {
  if (!(await isAuthorized())) {
    return NextResponse.json({ error: "not_authorized" }, { status: 401 });
  }
  const refresh = new URL(req.url).searchParams.get("refresh") === "1";
  const [dialogs, allowlist] = await Promise.all([
    getDialogList(2000, { refresh }),
    Promise.resolve(getAllowlist()),
  ]);
  return NextResponse.json({
    cachedAt: getDialogsCachedAt(),
    chats: dialogs.map((d) => {
      const perm = allowlist[d.id] ?? {
        read: false,
        write: false,
        full: false,
      };
      return { ...d, read: perm.read, write: perm.write, full: perm.full };
    }),
  });
}
