import { auth, currentUser } from "@clerk/nextjs/server"

const ADMIN_USER_ID = process.env.ADMIN_USER_ID!

export async function isAdmin(): Promise<boolean> {
  const { userId } = await auth()
  if (!userId) return false
  if (!ADMIN_USER_ID && process.env.NODE_ENV === "development") return true
  return userId === ADMIN_USER_ID
}

export async function requireAdmin(): Promise<void> {
  const admin = await isAdmin()
  if (!admin) throw new Error("Unauthorized")
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
