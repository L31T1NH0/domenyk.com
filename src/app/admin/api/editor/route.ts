import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { clientPromise } from "../../../../lib/mongo"; // Conexão com o MongoDB

// Handler para POST requests (publicação de posts)
export async function POST(req: Request) {
  const { sessionClaims } = await auth();

  // Verifica se o usuário é um admin
  if (sessionClaims?.metadata?.role !== "admin") {
    return NextResponse.json({ error: "Not Authorized" }, { status: 403 });
  }

  try {
    const formData = await req.formData();
    const title = formData.get("title") as string;
    const postId = formData.get("postId") as string;
    const content = formData.get("content") as string;
    const tags = formData.get("tags") as string; // Novo campo de tags
    const audioUrl = formData.get("audioUrl") as string;

    // Valida os dados de entrada
    if (!title || typeof title !== "string") {
      return NextResponse.json(
        { error: "Title is required and must be a string" },
        { status: 400 }
      );
    }
    if (!postId || typeof postId !== "string") {
      return NextResponse.json(
        { error: "Post ID is required and must be a string" },
        { status: 400 }
      );
    }
    if (!content || typeof content !== "string") {
      return NextResponse.json(
        { error: "Content is required and must be a string" },
        { status: 400 }
      );
    }

    // Processa o campo tags
    let tagsArray: string[] = [];
    if (tags && typeof tags === "string") {
      tagsArray = tags
        .split(",")
        .map((tag) => tag.trim().toLowerCase())
        .filter((tag) => tag.length > 0)
        .slice(0, 5); // Limita a 5 tags
    }

    // Valida o audioUrl, se fornecido
    if (audioUrl && typeof audioUrl !== "string") {
      return NextResponse.json(
        { error: "Audio URL must be a string if provided" },
        { status: 400 }
      );
    }

    const client = await clientPromise;
    const db = client.db("blog");
    const postsCollection = db.collection("posts");

    // Verifica se já existe um post com o mesmo postId
    const existingPost = await postsCollection.findOne({ postId });
    if (existingPost) {
      return NextResponse.json(
        { error: "Post ID already exists" },
        { status: 400 }
      );
    }

    // Cria o novo post com o campo tags
    const newPost = {
      postId,
      title,
      htmlContent: content, // Armazena o conteúdo como Markdown (htmlContent para consistência com o projeto)
      date: new Date().toISOString().split("T")[0], // Formato "YYYY-MM-DD"
      views: 0, // Inicializa as views como 0
      audioUrl: audioUrl || null, // Adiciona o URL do áudio, ou null se não fornecido
      tags: tagsArray.length > 0 ? tagsArray : [], // Adiciona o array de tags, ou vazio se não houver tags
    };

    await postsCollection.insertOne(newPost);

    return NextResponse.json(
      { message: "Post created successfully", postId },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error creating post:", {
      error: (error as Error).message,
      stack: (error as Error).stack,
    });
    return NextResponse.json(
      { error: "Internal server error: " + (error as Error).message },
      { status: 500 }
    );
  }
}