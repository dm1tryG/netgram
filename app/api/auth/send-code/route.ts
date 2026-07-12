import { NextResponse } from "next/server";
import { getEnvCreds, sendLoginCode } from "@/lib/telegram";

export async function POST() {
  if (!getEnvCreds()) {
    return NextResponse.json({ error: "missing_env" }, { status: 400 });
  }
  try {
    await sendLoginCode();
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "send_code_failed" },
      { status: 500 }
    );
  }
}
