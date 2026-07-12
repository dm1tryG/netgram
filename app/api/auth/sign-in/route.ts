import { NextResponse } from "next/server";
import { submitLoginCode } from "@/lib/telegram";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const code = body?.code;
  if (!code || typeof code !== "string") {
    return NextResponse.json({ error: "missing_code" }, { status: 400 });
  }
  try {
    const result = await submitLoginCode(code);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "sign_in_failed" },
      { status: 400 }
    );
  }
}
