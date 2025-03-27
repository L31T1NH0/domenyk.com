import { NextResponse } from "next/server";
import { clientPromise } from "../../../lib/mongo";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get("query") || "";

    const client = await clientPromise;
    const db = client.db("blog");
    const postsCollection = db.collection("posts");

    // Busca posts
    let posts;
    if (query.trim() === "") {
      // Retorna todos os posts se a query estiver vazia
      posts = await postsCollection
        .find({})
        .sort({ date: -1 })
        .limit(10)
        .toArray();
    } else {
      // Busca com base na query
      posts = await postsCollection
        .find({
          $or: [
            { title: { $regex: query, $options: "i" } },
            { htmlContent: { $regex: query, $options: "i" } },
            { tags: { $in: [new RegExp(query, "i")] } },
          ],
        })
        .sort({ date: -1 })
        .limit(10)
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