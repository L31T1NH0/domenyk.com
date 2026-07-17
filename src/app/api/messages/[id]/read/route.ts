import { NextResponse } from "next/server"
import { getAuthUser, isAdmin } from "@/lib/auth"
import {
  getMessageThread,
  getMessageThreadForOwner,
  markMessageThreadRead,
  serializeMessageThread,
} from "@/lib/db/messages"

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const admin = await isAdmin()
  const thread = admin ? await getMessageThread(id) : await getMessageThreadForOwner(id, user.id)
  if (!thread) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const readThread = await markMessageThreadRead(id, user.id, admin ? undefined : user.id)
  return NextResponse.json(serializeMessageThread(readThread ?? thread, user.id))
}
