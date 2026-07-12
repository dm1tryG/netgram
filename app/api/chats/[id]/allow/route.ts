import { NextResponse } from "next/server";
import { isAuthorized } from "@/lib/telegram";
import { setLevel } from "@/lib/allowlist";

const LEVELS = new Set(["off", "read", "write", "full"]);

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAuthorized())) {
    return NextResponse.json({ error: "not_authorized" }, { status: 401 });
  }
  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (typeof body?.level !== "string" || !LEVELS.has(body.level)) {
    return NextResponse.json(
      { error: "expected { level: 'off'|'read'|'write'|'full' }" },
      { status: 400 }
    );
  }
  const allowlist = setLevel(id, body.level);
  return NextResponse.json({ allowlist });
}
