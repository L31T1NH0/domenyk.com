"use server";
import { auth } from "@clerk/nextjs/server";
import { clerkClient } from "@clerk/nextjs/server";
import { Roles } from "types/globals";
import { NextResponse } from "next/server"; // Para criar respostas JSON

export async function GET(
  req: Request,
  { params }: { params: Promise<{ action: string[] }> }
) {
  const resolvedParams = await params;
  const [action] = resolvedParams.action || [];

  if (action !== "check") {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  const { sessionClaims } = await auth();
  if (sessionClaims?.metadata?.role !== "admin") {
    return NextResponse.json({ isAdmin: false }, { status: 200 });
  }

  return NextResponse.json({ isAdmin: true }, { status: 200 });
}