import "server-only"

import { clerkClient } from "@clerk/nextjs/server"
import { unstable_cache } from "next/cache"

export const getCachedClerkUserImage = unstable_cache(
  async (userId: string): Promise<string | null> => {
    try {
      const client = await clerkClient()
      const user = await client.users.getUser(userId)
      return user.imageUrl || null
    } catch {
      return null
    }
  },
  ["clerk-user-image-v1"],
  { revalidate: 60 * 60 }
)
