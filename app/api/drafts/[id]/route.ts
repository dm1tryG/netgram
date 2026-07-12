import { NextResponse } from "next/server";
import { isAuthorized } from "@/lib/telegram";
import { deleteDraft } from "@/lib/drafts";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAuthorized())) {
    return NextResponse.json({ error: "not_authorized" }, { status: 401 });
  }
  const { id } = await params;
  if (!deleteDraft(id)) {
    return NextResponse.json({ error: "draft_not_found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
