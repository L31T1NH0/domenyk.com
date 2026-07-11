import "server-only"

import { auth, currentUser } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"

const ADMIN_USER_ID = process.env.ADMIN_USER_ID!

function allowsDevelopmentAdminFallback(): boolean {
  return process.env.NODE_ENV === "development" && process.env.DEV_ADMIN_ALLOW_ANY_SIGNED_IN === "true"
}

export async function isAdmin(): Promise<boolean> {
  const { userId } = await auth()
  if (!userId) return false
  if (!ADMIN_USER_ID && allowsDevelopmentAdminFallback()) return true
  return userId === ADMIN_USER_ID
}

export async function getAuthUserId(): Promise<string | null> {
  const { userId } = await auth()
  return userId
}

export async function requireAdmin(): Promise<void> {
  const admin = await isAdmin()
  if (!admin) throw new Error("Unauthorized")
}

export async function adminOnly(): Promise<NextResponse<{ error: string }> | null> {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!ADMIN_USER_ID && allowsDevelopmentAdminFallback()) return null
  if (userId !== ADMIN_USER_ID) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  return null
}

export async function getAuthUser() {
  const user = await currentUser()
  if (!user) return null
  return {
    id: user.id,
    name: user.fullName ?? user.username ?? "Anônimo",
    imageUrl: user.imageUrl,
  }
}
