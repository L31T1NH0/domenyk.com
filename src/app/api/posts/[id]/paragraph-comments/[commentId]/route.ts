import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ObjectId } from "mongodb";

import { getMongoDb } from "../../../../../../lib/mongo";
import { resolveAdminStatus } from "../../../../../../lib/admin";

const COLLECTION_NAME = "paragraph-comments";

type ParagraphCommentDocument = {
  _id: ObjectId;
  postId: string;
  paragraphId: string;
  userId: string;
};

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; commentId: string }> }
) {
  const resolvedParams = await params;
  const postId = resolvedParams?.id;
  const commentId = resolvedParams?.commentId;

  if (!postId || !commentId) {
    return NextResponse.json(
      { error: "Identificador inválido." },
      { status: 400 }
    );
  }

  const { userId, sessionClaims } = await auth();
  const adminStatus = await resolveAdminStatus({ sessionClaims, userId });
  if (!userId) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const isAdmin = adminStatus.isAdmin;

  const db = await getMongoDb();
  const postsCollection = db.collection("posts");
  const post = await postsCollection.findOne(
    { postId },
    { projection: { _id: 1, hidden: 1, paragraphCommentsEnabled: 1 } }
  );

  if (!post) {
    return NextResponse.json({ error: "Post não encontrado." }, { status: 404 });
  }

  if ((post as any).hidden === true && !isAdmin) {
    return NextResponse.json({ error: "Post não encontrado." }, { status: 404 });
  }

  if ((post as any).paragraphCommentsEnabled === false && !isAdmin) {
    return NextResponse.json(
      { error: "Comentários por parágrafo desativados para este post." },
      { status: 403 }
    );
  }

  const collection = db.collection<ParagraphCommentDocument>(COLLECTION_NAME);

  let objectId: ObjectId;
  try {
    objectId = new ObjectId(commentId);
  } catch (error) {
    return NextResponse.json(
      { error: "Comentário inválido." },
      { status: 400 }
    );
  }

  const existing = await collection.findOne({ _id: objectId, postId });
  if (!existing) {
    return NextResponse.json({ error: "Comentário não encontrado." }, { status: 404 });
  }

  if (!isAdmin && existing.userId !== userId) {
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  }

  await collection.deleteOne({ _id: objectId, postId });

  return NextResponse.json({ success: true }, { status: 200 });
}
