import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

// Handler para GET requests (verifica se o usuário é admin)
export async function GET(
  req: Request,
  { params }: { params: { action: string[] } }
) {
  // Autentica o usuário
  const { sessionClaims } = await auth();

  // Verifica se o usuário é um admin
  const isAdmin = sessionClaims?.metadata?.role === "admin";

  return NextResponse.json({ isAdmin }, { status: 200 });
}
