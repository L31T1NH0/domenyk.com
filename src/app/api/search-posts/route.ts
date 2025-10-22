import { NextResponse } from "next/server";
import { clientPromise } from "../../../lib/mongo";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get("query")?.trim() ?? "";

    const db = await getMongoDb();
    const postsCollection = db.collection<RawPost>("posts");

    const client = await clientPromise;
    const db = client.db("blog");
    const postsCollection = db.collection("posts");

    if (query === "") {
      posts = await postsCollection
        .find({}, { projection: PROJECTION })
        .sort({ date: -1 })
        .limit(10)
        .toArray();
    } else {
      posts = await postsCollection
        .find(
          { $text: { $search: query } },
          {
            projection: {
              ...PROJECTION,
              score: { $meta: "textScore" },
            },
          }
        )
        .collation(SEARCH_COLLATION)
        .sort({ score: { $meta: "textScore" }, date: -1 })
        .limit(10)
        .toArray();

      if (posts.length === 0) {
        posts = await postsCollection
          .find(
            {
              $or: [
                { title: { $regex: query, $options: "i" } },
                { tags: { $in: [new RegExp(query, "i")] } },
              ],
            },
            { projection: PROJECTION }
          )
          .collation(SEARCH_COLLATION)
          .sort({ date: -1 })
          .limit(10)
          .toArray();
      }
    }

    const normalized = posts.map(normalizePost);

    return NextResponse.json(normalized, {
      status: 200,
      headers: {
        "Cache-Control": "s-maxage=60, stale-while-revalidate=30",
      },
    });
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
