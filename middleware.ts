import { NextRequest, NextResponse } from "next/server";

// Loopback auth for managed (desktop) mode. When NETGRAM_AUTH_TOKEN is set,
// every /api request must carry the matching x-netgram-token header — without
// it, any local process could read Telegram through the open port. When the
// env is absent (docker / plain dev), behavior is unchanged.
export function middleware(req: NextRequest) {
  const token = process.env.NETGRAM_AUTH_TOKEN;
  if (!token) return NextResponse.next();
  if (req.headers.get("x-netgram-token") === token) return NextResponse.next();
  return NextResponse.json({ error: "unauthorized: missing or bad x-netgram-token" }, { status: 401 });
}

export const config = { matcher: "/api/:path*" };
