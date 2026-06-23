import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"

const isAdminRoute = createRouteMatcher(["/admin(.*)", "/api/admin(.*)"])

function allowsDevelopmentAdminFallback(): boolean {
  return process.env.NODE_ENV === "development" && process.env.DEV_ADMIN_ALLOW_ANY_SIGNED_IN === "true"
}

export default clerkMiddleware(async (auth, req) => {
  if (!isAdminRoute(req)) return

  const adminUserId = process.env.ADMIN_USER_ID
  const isAdminApiRoute = req.nextUrl.pathname.startsWith("/api/admin")
  const { userId } = await auth()
  if (!userId) {
    if (isAdminApiRoute) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    await auth.protect()
    return
  }

  if (!adminUserId && allowsDevelopmentAdminFallback()) return
  if (userId !== adminUserId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
})

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
}
