import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// Rotas públicas: não requerem autenticação
const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/posts(.*)", // Adiciona todas as rotas de posts como públicas
  "/api(.*)", // Adiciona as rotas da API de posts como públicas
  "/admin/check(.*)", // Adiciona a rota de verificação de admin como pública
]);

// Rotas de admin: requerem role "admin"
const isAdminRoute = createRouteMatcher(["/admin(.*)", "/staff(.*)"]);

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
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api/auth|api/clerk)(.*)", // Limite o middleware para rotas de autenticação Clerk, não para todas as APIs
  ],
};

