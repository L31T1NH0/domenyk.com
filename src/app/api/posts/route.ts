import { NextResponse } from "next/server";
import { clientPromise } from "../../../lib/mongo"; // Use clientPromise, que agora está exportado

export async function GET() {
  try {
    console.log("Iniciando requisição para buscar posts...");
    const client = await clientPromise;
    if (!client) {
      throw new Error("Falha ao conectar ao MongoDB Atlas");
    }
    const db = client.db(process.env.MONGODB_DB || "blog");
    console.log(
      "Conexão com o MongoDB Atlas estabelecida para posts:",
      db.databaseName
    );

    // Verifica se a coleção 'posts' existe
    const collections = await db.listCollections({ name: "posts" }).toArray();
    if (!collections.length) {
      console.warn("Coleção 'posts' não encontrada no MongoDB Atlas");
      return NextResponse.json([], { status: 200 }); // Retorna array vazio com status 200
    }

    const posts = await db
      .collection("posts")
      .find(
        {},
        { projection: { postId: 1, title: 1, date: 1, views: 1, _id: 0 } }
      ) // Apenas campos necessários
      .sort({ date: -1 }) // Mais recentes primeiro
      .toArray();

    console.log("Posts retornados do MongoDB Atlas:", posts);

    if (!posts.length) {
      console.warn("Nenhum post encontrado no MongoDB Atlas");
      return NextResponse.json([], { status: 200 }); // Retorna array vazio com status 200, não 404
    }

    return NextResponse.json(posts, { status: 200 });
  } catch (error) {
    console.error("Erro ao buscar posts do MongoDB Atlas:", {
      message: (error as Error).message,
      stack: (error as Error).stack,
    });
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
