import { NextResponse } from "next/server";
import { getMe, isAuthorized } from "@/lib/telegram";

export async function GET() {
  if (!(await isAuthorized())) {
    return NextResponse.json({ error: "not_authorized" }, { status: 401 });
  }
  const me = await getMe();
  return NextResponse.json({ me });
}
