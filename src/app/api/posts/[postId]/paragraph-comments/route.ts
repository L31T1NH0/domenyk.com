import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { ObjectId } from "mongodb";

import { getMongoDb } from "../../../../../lib/mongo";
import type { ParagraphComment } from "../../../../../../types/paragraph-comments";

const COLLECTION_NAME = "paragraph-comments";
const MAX_LENGTH = 480;

type ParagraphCommentDocument = {
  _id: ObjectId;
  postId: string;
  paragraphId: string;
  userId: string;
  authorName: string;
  authorImageUrl: string | null;
  content: string;
  createdAt: string;
  updatedAt: string;
};

const mapDocumentToResponse = (
  document: ParagraphCommentDocument
): ParagraphComment => ({
  _id: document._id.toString(),
  postId: document.postId,
  paragraphId: document.paragraphId,
  userId: document.userId,
  authorName: document.authorName,
  authorImageUrl: document.authorImageUrl,
  content: document.content,
  createdAt: document.createdAt,
  updatedAt: document.updatedAt,
});

export async function GET(
  req: Request,
  { params }: { params: Promise<{ postId: string }> }
) {
  const resolvedParams = await params;
  const postId = resolvedParams?.postId;
  if (!postId) {
    return NextResponse.json(
      { error: "Post ID inválido." },
      { status: 400 }
    );
  }

  const url = new URL(req.url);
  const paragraphId = url.searchParams.get("paragraphId");

  if (!paragraphId) {
    return NextResponse.json(
      { error: "Parágrafo não informado." },
      { status: 400 }
    );
  }

  try {
    const db = await getMongoDb();
    const collection = db.collection<ParagraphCommentDocument>(COLLECTION_NAME);

    const documents = await collection
      .find({ postId, paragraphId })
      .sort({ createdAt: 1 })
      .toArray();

    const comments = documents.map(mapDocumentToResponse);

    return NextResponse.json(comments, { status: 200 });
  } catch (error) {
    console.error("Failed to fetch paragraph comments", error);
    return NextResponse.json(
      { error: "Erro interno ao buscar comentários." },
      { status: 500 }
    );
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ postId: string }> }
) {
  const resolvedParams = await params;
  const postId = resolvedParams?.postId;
  if (!postId) {
    return NextResponse.json(
      { error: "Post ID inválido." },
      { status: 400 }
    );
  }

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
  } catch (error) {
    return NextResponse.json(
      { error: "Formato de requisição inválido." },
      { status: 400 }
    );
  }

  if (
    !body ||
    typeof body !== "object" ||
    !("paragraphId" in body) ||
    !("content" in body)
  ) {
    return NextResponse.json(
      { error: "Dados insuficientes." },
      { status: 400 }
    );
  }

  const paragraphId = String((body as Record<string, unknown>).paragraphId || "").trim();
  const content = String((body as Record<string, unknown>).content || "").trim();

  if (!paragraphId) {
    return NextResponse.json(
      { error: "Parágrafo inválido." },
      { status: 400 }
    );
  }

  if (!content) {
    return NextResponse.json(
      { error: "Escreva um comentário antes de enviar." },
      { status: 400 }
    );
  }

  if (content.length > MAX_LENGTH) {
    return NextResponse.json(
      { error: `O comentário deve ter no máximo ${MAX_LENGTH} caracteres.` },
      { status: 400 }
    );
  }

  const now = new Date().toISOString();
  const authorName =
    user.fullName || user.firstName || user.username || "Leitor";
  const authorImageUrl = user.imageUrl ?? null;

  const document: ParagraphCommentDocument = {
    _id: new ObjectId(),
    postId,
    paragraphId,
    userId,
    authorName,
    authorImageUrl,
    content,
    createdAt: now,
    updatedAt: now,
  };

  try {
    const db = await getMongoDb();
    const collection = db.collection<ParagraphCommentDocument>(COLLECTION_NAME);
    await collection.insertOne(document);

    return NextResponse.json(
      { comment: mapDocumentToResponse(document) },
      { status: 201 }
    );
  } catch (error) {
    console.error("Failed to save paragraph comment", error);
    return NextResponse.json(
      { error: "Erro ao salvar o comentário." },
      { status: 500 }
    );
  }
}
