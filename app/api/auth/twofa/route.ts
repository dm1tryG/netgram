import { NextResponse } from "next/server";
import { submit2FAPassword } from "@/lib/telegram";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const password = body?.password;
  if (!password || typeof password !== "string") {
    return NextResponse.json({ error: "missing_password" }, { status: 400 });
  }
  try {
    await submit2FAPassword(password);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "2fa_failed" },
      { status: 400 }
    );
  }
}
