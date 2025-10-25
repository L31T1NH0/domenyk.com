import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { ObjectId } from "mongodb";

import { getMongoDb } from "../../../../../../lib/mongo";

const COLLECTION_NAME = "paragraph-comments";

type ParagraphCommentDocument = {
  _id: ObjectId;
  postId: string;
  paragraphId: string;
  userId: string;
};

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ postId: string; commentId: string }> }
) {
  const resolvedParams = await params;
  const postId = resolvedParams?.postId;
  const commentId = resolvedParams?.commentId;

  if (!postId || !commentId) {
    return NextResponse.json(
      { error: "Identificador inválido." },
      { status: 400 }
    );
  }

  const { userId, sessionClaims } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const user = await currentUser();
  const isAdmin =
    sessionClaims?.metadata?.role === "admin" ||
    (user?.unsafeMetadata as Record<string, unknown> | undefined)?.role === "admin";

  const db = await getMongoDb();
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
