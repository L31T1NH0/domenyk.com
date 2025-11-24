import { NextResponse, type NextRequest } from "next/server";
import { clientPromise } from "../../../../../lib/mongo";
import { resolveAdminStatus } from "../../../../../lib/admin";

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  const id = params?.id;

  if (!id || typeof id !== "string") {
    return NextResponse.json({ error: "Post ID é obrigatório." }, { status: 400 });
  }

  const { isAdmin } = await resolveAdminStatus();
  if (!isAdmin) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Corpo da requisição inválido." }, { status: 400 });
  }

  const { title, subtitle, htmlContent, markdownContent } =
    (payload as Partial<Record<string, unknown>>) ?? {};

  const updateDocument: Record<string, unknown> = {};

  if (typeof title === "string") {
    updateDocument.title = title;
  }

  if (typeof subtitle === "string") {
    updateDocument.subtitle = subtitle;
  }

  if (typeof htmlContent === "string") {
    updateDocument.htmlContent = htmlContent;
    updateDocument.content = htmlContent;
  }

  if (typeof markdownContent === "string") {
    const trimmedMarkdown = markdownContent.trim();
    updateDocument.markdownContent = trimmedMarkdown;
    updateDocument.contentMarkdown = trimmedMarkdown;
  }

  if (Object.keys(updateDocument).length === 0) {
    return NextResponse.json({ error: "Nenhum campo válido para atualizar." }, { status: 400 });
  }

  updateDocument.updatedAt = new Date().toISOString();

  try {
    const client = await clientPromise;
    const db = client.db("blog");
    const collection = db.collection("posts");

    const result = await collection.updateOne({ postId: id }, { $set: updateDocument });

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: "Post não encontrado." }, { status: 404 });
    }

    return NextResponse.json(
      {
        ok: true,
        htmlContent: updateDocument.htmlContent,
        markdownContent: updateDocument.markdownContent,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Erro ao atualizar post:", error);
    return NextResponse.json({ error: "Erro interno ao atualizar post." }, { status: 500 });
  }
}
