import { NextResponse } from "next/server";
import { getEnvCreds, hasSessionFile, isAuthorized } from "@/lib/telegram";

export async function GET() {
  const creds = getEnvCreds();
  if (!creds) {
    return NextResponse.json({ state: "missing_env" });
  }
  if (!hasSessionFile() || !(await isAuthorized())) {
    return NextResponse.json({ state: "needs_login" });
  }
  return NextResponse.json({ state: "authorized" });
}
