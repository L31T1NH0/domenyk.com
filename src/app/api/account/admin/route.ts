import { NextResponse } from "next/server"
import { getAuthUserId, isAdmin } from "@/lib/auth"

export async function GET() {
  const userId = await getAuthUserId()
  if (!userId) return NextResponse.json({ admin: false })
  return NextResponse.json({ admin: await isAdmin() })
}
