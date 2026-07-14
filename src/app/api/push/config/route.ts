import { NextResponse } from "next/server"
import { publicVapidKey } from "@/lib/push"

export function GET() {
  const publicKey = publicVapidKey()
  return NextResponse.json({ configured: Boolean(publicKey), publicKey })
}
