import { NextResponse } from "next/server";
import { clientPromise } from "../../../lib/mongo";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get("query") || "";

    const client = await clientPromise;
    const db = client.db("blog");
    const postsCollection = db.collection("posts");

<<<<<<< HEAD
    const client = await clientPromise;
    const db = client.db("blog");
    const postsCollection = db.collection("posts");

    if (query === "") {
=======
    // Busca posts com projeção para retornar apenas os campos necessários
    let posts;
    if (query.trim() === "") {
      // Retorna todos os posts se a query estiver vazia
>>>>>>> parent of ab2cc0b (Refactor home and post pages for server rendering)
      posts = await postsCollection
        .find({})
        .sort({ date: -1 })
        .limit(10)
        .project({
          postId: 1,
          title: 1,
          date: 1,
          views: 1,
          tags: 1,
          _id: 0, // Exclui o campo _id
        })
        .toArray();
    } else {
      // Busca com base na query
      posts = await postsCollection
        .find({
          $or: [
            { title: { $regex: query, $options: "i" } },
            { tags: { $in: [new RegExp(query, "i")] } },
          ],
        })
        .sort({ date: -1 })
        .limit(10)
        .project({
          postId: 1,
          title: 1,
          date: 1,
          views: 1,
          tags: 1,
          _id: 0, // Exclui o campo _id
        })
        .toArray();
    }

    return NextResponse.json(posts, { status: 200 });
  } catch (error) {
    console.error("Error searching posts:", {
      error: (error as Error).message,
      stack: (error as Error).stack,
    });
    return NextResponse.json(
      { error: "Internal server error: " + (error as Error).message },
      { status: 500 }
    );
  }
}