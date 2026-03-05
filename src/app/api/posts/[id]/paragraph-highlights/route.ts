import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { ObjectId } from "mongodb";

import { getMongoDb } from "@lib/mongo";
import { resolveAdminStatus } from "@lib/admin";

const COLLECTION = "paragraph-highlights";
const MAX_LENGTH = 300;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: postId } = await params;
  if (!postId) {
    return NextResponse.json({ error: "postId required" }, { status: 400 });
  }

  const db = await getMongoDb();
  const docs = await db
    .collection(COLLECTION)
    .find({ postId })
    .sort({ createdAt: 1 })
    .toArray();

  return NextResponse.json(
    docs.map((d: any) => ({
      _id: d._id.toString(),
      postId: d.postId,
      paragraphId: d.paragraphId,
      userId: d.userId,
      authorName: d.authorName,
      selectedText: d.selectedText,
      startOffset: d.startOffset,
      endOffset: d.endOffset,
      createdAt: d.createdAt,
    })),
    { status: 200 }
  );
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: postId } = await params;
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: "Usuário não encontrado." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Payload inválido." }, { status: 400 });
  }

  const { paragraphId, selectedText, startOffset, endOffset } = body as any;

  if (
    !paragraphId ||
    !selectedText ||
    typeof startOffset !== "number" ||
    typeof endOffset !== "number"
  ) {
    return NextResponse.json({ error: "Dados insuficientes." }, { status: 400 });
  }

  if (selectedText.trim().length === 0 || selectedText.length > MAX_LENGTH) {
    return NextResponse.json(
      { error: `Destaque deve ter entre 1 e ${MAX_LENGTH} caracteres.` },
      { status: 400 }
    );
  }

  const db = await getMongoDb();

  await db.collection(COLLECTION).deleteOne({ postId, paragraphId, userId });

  const doc = {
    postId,
    paragraphId,
    userId,
    authorName: user.fullName || user.firstName || user.username || "Leitor",
    selectedText: selectedText.trim(),
    startOffset,
    endOffset,
    createdAt: new Date().toISOString(),
  };

  const result = await db.collection(COLLECTION).insertOne(doc);

  return NextResponse.json(
    { highlight: { ...doc, _id: result.insertedId.toString() } },
    { status: 201 }
  );
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: postId } = await params;
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const { isAdmin } = await resolveAdminStatus();
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Payload inválido." }, { status: 400 });
  }

  const { highlightId } = body as any;
  if (!highlightId) {
    return NextResponse.json({ error: "highlightId required." }, { status: 400 });
  }

  const db = await getMongoDb();
  let objectId: ObjectId;
  try {
    objectId = new ObjectId(highlightId);
  } catch {
    return NextResponse.json({ error: "highlightId inválido." }, { status: 400 });
  }
  const doc = await db.collection(COLLECTION).findOne({ _id: objectId, postId });

  if (!doc) {
    return NextResponse.json({ error: "Não encontrado." }, { status: 404 });
  }

  if (!isAdmin && (doc as any).userId !== userId) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 403 });
  }

  await db.collection(COLLECTION).deleteOne({ _id: objectId, postId });

  return NextResponse.json({ deleted: true }, { status: 200 });
}
