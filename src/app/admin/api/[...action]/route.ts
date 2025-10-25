"use server";
import { NextResponse } from "next/server"; // Para criar respostas JSON
import { resolveAdminStatus } from "../../../../lib/admin";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ action: string[] }> }
) {
  const resolvedParams = await params;
  const [action] = resolvedParams.action || [];

  if (action !== "check") {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  const { isAdmin } = await resolveAdminStatus();
  if (!isAdmin) {
    return NextResponse.json({ isAdmin: false }, { status: 200 });
  }

  return NextResponse.json({ isAdmin: true }, { status: 200 });
}