import { clerkClient } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { adminOnly } from "@/lib/auth"

export const runtime = "nodejs"

export async function GET() {
  const unauthorized = await adminOnly()
  if (unauthorized) return unauthorized

  const client = await clerkClient()
  const usersResponse = await client.users.getUserList({ limit: 100, orderBy: "-created_at" })
  const users = usersResponse.data.map((user) => {
    const email = user.emailAddresses.find((item) => item.id === user.primaryEmailAddressId)?.emailAddress
      ?? user.emailAddresses[0]?.emailAddress
      ?? user.id

    return {
      id: user.id,
      name: user.fullName ?? user.username ?? email,
      imageUrl: user.imageUrl ?? null,
    }
  })

  return NextResponse.json({ users })
}
