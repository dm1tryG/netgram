import { NextResponse } from "next/server";
import { saveCreds } from "@/lib/telegram";

// Persist the Telegram app credentials entered in the setup wizard so a fresh
// user never has to edit .env by hand.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const apiId = Number(body?.apiId);
  const apiHash =
    typeof body?.apiHash === "string" ? body.apiHash.trim() : "";
  const phone = typeof body?.phone === "string" ? body.phone.trim() : "";

  if (!Number.isInteger(apiId) || apiId <= 0) {
    return NextResponse.json({ error: "bad_api_id" }, { status: 400 });
  }
  if (!/^[a-f0-9]{32}$/i.test(apiHash)) {
    return NextResponse.json({ error: "bad_api_hash" }, { status: 400 });
  }
  if (!/^\+\d{6,15}$/.test(phone)) {
    return NextResponse.json({ error: "bad_phone" }, { status: 400 });
  }

  saveCreds({ apiId, apiHash, phone });
  return NextResponse.json({ ok: true });
}
