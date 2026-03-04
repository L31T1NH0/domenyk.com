import { NextResponse } from "next/server";

import { getMongoDb } from "../../../../../../lib/mongo";

const COLLECTION_NAME = "paragraph-comments";

type SummaryItem = {
  paragraphId: string;
  count: number;
};

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const resolvedParams = await params;
  const postId = resolvedParams?.id;

  if (!postId) {
    return NextResponse.json({ error: "Post ID inválido." }, { status: 400 });
  }

  try {
    const db = await getMongoDb();
    const postsCollection = db.collection("posts");
    const post = await postsCollection.findOne(
      { postId },
      { projection: { _id: 1, paragraphCommentsEnabled: 1 } }
    );

    if (!post) {
      return NextResponse.json({ error: "Post não encontrado." }, { status: 404 });
    }

    if ((post as any).paragraphCommentsEnabled === false) {
      return NextResponse.json(
        { error: "Comentários por parágrafo desativados para este post." },
        { status: 403 }
      );
    }

    const collection = db.collection(COLLECTION_NAME);

    const summary = (await collection
      .aggregate([
        { $match: { postId } },
        { $group: { _id: "$paragraphId", count: { $sum: 1 } } },
        { $project: { _id: 0, paragraphId: "$_id", count: 1 } },
      ])
      .toArray()) as SummaryItem[];

    return NextResponse.json(summary, { status: 200 });
  } catch (error) {
    console.error("Failed to fetch paragraph comments summary", error);
    return NextResponse.json(
      { error: "Erro interno ao buscar resumo de comentários." },
      { status: 500 }
    );
  }
}
