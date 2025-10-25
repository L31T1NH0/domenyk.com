import { NextResponse } from "next/server";
import { clientPromise } from "../../../lib/mongo"; // Conexão com o MongoDB
import { resolveAdminStatus } from "../../../lib/admin";

// Tipos para os dados de entrada
type DeletePostBody = {
  postId: string;
};

// Handler para POST requests
export async function POST(
  req: Request,
  { params }: { params: Promise<{ action: string[] }> }
) {
  const resolvedParams = await params; // Aguarda a resolução do params
  const [action] = resolvedParams.action || []; // Captura a primeira parte do wildcard (ex.: "deletePost")

  // Autentica o usuário
  const { isAdmin } = await resolveAdminStatus();

  // Verifica se o usuário é um admin
  if (!isAdmin) {
    return NextResponse.json({ error: "Not Authorized" }, { status: 403 });
  }

  try {
    const client = await clientPromise;
    const db = client.db("blog");
    const postsCollection = db.collection("posts");

    if (action === "deletePost") {
      const { postId } = (await req.json()) as DeletePostBody;

      // Valida os dados de entrada
      if (!postId || typeof postId !== "string") {
        return NextResponse.json(
          { error: "Post ID is required and must be a string" },
          { status: 400 }
        );
      }

      // Deleta o post do MongoDB
      const result = await postsCollection.deleteOne({ postId });
      if (result.deletedCount === 0) {
        return NextResponse.json({ error: "Post not found" }, { status: 404 });
      }

      return NextResponse.json(
        { message: "Post deleted successfully", postId },
        { status: 200 }
      );
    } else {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
  } catch (error) {
    console.error("Error in staff action:", {
      action,
      error: (error as Error).message,
      stack: (error as Error).stack,
    });
    return NextResponse.json(
      { error: "Internal server error: " + (error as Error).message },
      { status: 500 }
    );
  }
}
