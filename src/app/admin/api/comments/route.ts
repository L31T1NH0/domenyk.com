import { NextResponse } from "next/server";
import { clientPromise } from "../../../../lib/mongo";
import { resolveAdminStatus } from "../../../../lib/admin";

type AdminComment = {
  _id: string;
  postId: string;
  postTitle: string;
  comentario: string;
  createdAt: string;
  author: string;
};

export async function GET(req: Request) {
  const { isAdmin } = await resolveAdminStatus();
  if (!isAdmin) {
    return NextResponse.json({ error: "Not Authorized" }, { status: 403 });
  }

  try {
    const url = new URL(req.url);
    const offset = Math.max(0, parseInt(url.searchParams.get("offset") || "0", 10) || 0);
    const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get("limit") || "20", 10) || 20));

    const client = await clientPromise;
    const db = client.db("blog");
    const posts = db.collection("posts");
    const commentsCol = db.collection("comments");
    const authCommentsCol = db.collection("auth-comments");

    const [nonAuth, auth] = await Promise.all([
      commentsCol
        .find({ parentId: null }, { projection: { comentario: 1, createdAt: 1, postId: 1, nome: 1 } })
        .toArray(),
      authCommentsCol
        .find({ parentId: null }, { projection: { comentario: 1, createdAt: 1, postId: 1, firstName: 1 } })
        .toArray(),
    ]);

    const combined = [
      ...nonAuth.map((c: any) => ({
        _id: String(c._id),
        postId: String(c.postId),
        comentario: String(c.comentario ?? ""),
        createdAt: String(c.createdAt ?? ""),
        author: c.nome ? String(c.nome) : "Usuário",
      })),
      ...auth.map((c: any) => ({
        _id: String(c._id),
        postId: String(c.postId),
        comentario: String(c.comentario ?? ""),
        createdAt: String(c.createdAt ?? ""),
        author: c.firstName ? String(c.firstName) : "Usuário",
      })),
    ].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    const page = combined.slice(offset, offset + limit);
    const distinctPostIds = Array.from(new Set(page.map((c) => c.postId)));
    const postDocs = await posts
      .find({ postId: { $in: distinctPostIds } }, { projection: { postId: 1, title: 1, _id: 0 } })
      .toArray();
    const titleMap = new Map(postDocs.map((p: any) => [String(p.postId), String(p.title ?? "(sem título)")]));

    const result: AdminComment[] = page.map((c) => ({
      ...c,
      postTitle: titleMap.get(c.postId) || "(sem título)",
    }));

    const hasMore = offset + page.length < combined.length;
    return NextResponse.json({ comments: result, hasMore }, { status: 200 });
  } catch (error) {
    console.error("Error fetching all comments:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

