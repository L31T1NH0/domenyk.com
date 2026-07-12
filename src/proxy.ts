import { clerkMiddleware } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"

function isAdminRoute(pathname: string): boolean {
  return pathname === "/admin" || pathname.startsWith("/admin/") ||
    pathname === "/api/admin" || pathname.startsWith("/api/admin/")
}

function asOrigin(value: string | undefined): string | null {
  if (!value) return null
  try {
    return new URL(value.startsWith("http") ? value : `https://${value}`).origin
  } catch {
    return null
  }
}

const configuredAuthorizedParties = [
  ...(process.env.CLERK_AUTHORIZED_PARTIES ?? "").split(","),
  process.env.NEXT_PUBLIC_SITE_URL,
  process.env.VERCEL_PROJECT_PRODUCTION_URL,
  process.env.VERCEL_URL,
]
  .map((value) => asOrigin(value?.trim()))
  .filter((value): value is string => Boolean(value))

const authorizedParties = Array.from(new Set([
  "https://domenyk.com",
  ...configuredAuthorizedParties,
  ...(process.env.NODE_ENV === "development"
    ? ["http://localhost:3000", "http://127.0.0.1:3000"]
    : []),
]))

function allowsDevelopmentAdminFallback(): boolean {
  return process.env.NODE_ENV === "development" && process.env.DEV_ADMIN_ALLOW_ANY_SIGNED_IN === "true"
}

function documentLanguage(pathname: string): string {
  const locale = pathname.split("/")[1]
  if (locale === "en" || locale === "de" || locale === "id") return locale
  return "pt-BR"
}

export default clerkMiddleware(async (auth, req) => {
  const requestHeaders = new Headers(req.headers)
  requestHeaders.set("x-site-language", documentLanguage(req.nextUrl.pathname))
  const continueRequest = () => NextResponse.next({ request: { headers: requestHeaders } })

  if (!isAdminRoute(req.nextUrl.pathname)) return continueRequest()

  const adminUserId = process.env.ADMIN_USER_ID
  const isAdminApiRoute = req.nextUrl.pathname.startsWith("/api/admin")
  const { userId } = await auth()
  if (!userId) {
    if (isAdminApiRoute) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    await auth.protect()
    return continueRequest()
  }

  if (!adminUserId && allowsDevelopmentAdminFallback()) return continueRequest()
  if (userId !== adminUserId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  return continueRequest()
}, {
  authorizedParties,
  contentSecurityPolicy: {
    strict: true,
    directives: {
      "base-uri": ["self"],
      "connect-src": [
        "https://*.clarity.ms",
        "https://*.vercel-insights.com",
        "https://*.public.blob.vercel-storage.com",
      ],
      "font-src": ["self"],
      "frame-ancestors": ["none"],
      "img-src": [
        "data:",
        "blob:",
        "https://*.public.blob.vercel-storage.com",
        "https://res.cloudinary.com",
        "https://images.clerk.dev",
      ],
      "media-src": ["self", "https:"],
      "object-src": ["none"],
      "script-src": ["https://www.clarity.ms"],
    },
  },
})

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|txt|xml|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
}
