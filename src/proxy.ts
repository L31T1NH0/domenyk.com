import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"

const isAdminRoute = createRouteMatcher(["/admin(.*)", "/api/admin(.*)"])

export default clerkMiddleware(async (auth, req) => {
  if (!isAdminRoute(req)) return

  const { userId } = await auth.protect()
  const adminUserId = process.env.ADMIN_USER_ID
  if (!adminUserId && process.env.NODE_ENV === "development") return
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
