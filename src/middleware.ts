import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// Rotas públicas: não requerem autenticação
const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/posts(.*)", // Adiciona todas as rotas de posts como públicas
  "/api(.*)", // Adiciona as rotas da API de posts como públicas
]);

// Rotas de admin: requerem role "admin"
const isAdminRoute = createRouteMatcher([
  "/admin",
  "/admin/editor(.*)", // Protege a página do editor e a API
  "/staff(.*)",
  "/admin/api(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  const { userId, redirectToSignIn } = await auth();

  if (
    isAdminRoute(req) &&
    (await auth()).sessionClaims?.metadata?.role !== "admin"
  ) {
    const url = new URL("/", req.url);
    return NextResponse.redirect(url);
  }

  if (!userId && !isPublicRoute(req)) {
    return redirectToSignIn();
  }

  // Log para debug (remova em produção)
  console.log("Middleware executed for path:", req.nextUrl.pathname);
});

export const config = {
  matcher: [
    // Ignora arquivos estáticos e rotas internas do Next.js
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2|ico|csv|docx?|xlsx?|zip|webmanifest)|public/.*).*)",
    "/(api/auth|api/clerk)(.*)", // Limite o middleware para rotas de autenticação Clerk
  ],
};
