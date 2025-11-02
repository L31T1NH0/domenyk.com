import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import {
  ANALYTICS_SESSION_COOKIE_NAME,
  ANALYTICS_SESSION_MAX_AGE,
  generateSessionId,
} from "@lib/analytics/session";

const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/posts(.*)",
  "/api(.*)",
]);

const isAdminRoute = createRouteMatcher([
  "/admin",
  "/admin/editor(.*)",
  "/staff(.*)",
  "/admin/api(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  const authState = await auth();
  const { userId, sessionClaims, redirectToSignIn } = authState;

  if (isAdminRoute(req) && sessionClaims?.metadata?.role !== "admin") {
    const url = new URL("/", req.url);
    return NextResponse.redirect(url);
  }

  if (!userId && !isPublicRoute(req)) {
    return redirectToSignIn();
  }

  const response = NextResponse.next();

  if (!req.cookies.get(ANALYTICS_SESSION_COOKIE_NAME)) {
    response.cookies.set({
      name: ANALYTICS_SESSION_COOKIE_NAME,
      value: generateSessionId(),
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: ANALYTICS_SESSION_MAX_AGE,
    });
  }

  return response;
});

export const config = {
  matcher: [
    // Ignora arquivos estáticos e rotas internas do Next.js
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2|ico|csv|docx?|xlsx?|zip|webmanifest)|public/.*).*)",
    "/(api/auth|api/clerk)(.*)", // Limite o middleware para rotas de autenticação Clerk
  ],
};
