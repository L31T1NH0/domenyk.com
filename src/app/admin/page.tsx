import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { getMongoDb } from "../../lib/mongo";

type PostRow = {
  _id?: string;
  postId: string;
  title: string;
  date?: string;
  views?: number;
};

export default async function AdminDashboard() {
  const { sessionClaims } = await auth();
  if (sessionClaims?.metadata?.role !== "admin") {
    notFound();
  }

  const db = await getMongoDb();
  const postsCollection = db.collection("posts");

  const [count, viewsAgg, latest] = await Promise.all([
    postsCollection.countDocuments({}),
    postsCollection
      .aggregate<{ totalViews: number }>([
        { $group: { _id: null, totalViews: { $sum: { $ifNull: ["$views", 0] } } } },
        { $project: { _id: 0, totalViews: 1 } },
      ])
      .toArray()
      .then((arr) => arr[0]?.totalViews ?? 0),
    postsCollection
      .find({}, { projection: { _id: 0, postId: 1, title: 1, date: 1, views: 1 } })
      .sort({ date: -1 })
      .limit(6)
      .toArray() as unknown as Promise<PostRow[]>,
  ]);

  const totalViews = typeof viewsAgg === "number" ? viewsAgg : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-zinc-400">Resumo do seu conteudo e desempenho.</p>
        </div>
        <Link
          href="/admin/editor"
          className="inline-flex items-center justify-center rounded-md bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-200"
        >
          Novo post
        </Link>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
          <div className="text-xs text-zinc-400">Posts publicados</div>
          <div className="mt-2 text-3xl font-semibold">{count}</div>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
          <div className="text-xs text-zinc-400">Visualizacoes (total)</div>
          <div className="mt-2 text-3xl font-semibold">{totalViews}</div>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
          <div className="text-xs text-zinc-400">Rascunhos</div>
          <div className="mt-2 text-3xl font-semibold">0</div>
        </div>
      </section>

      <section className="rounded-xl border border-zinc-800 bg-zinc-900/60">
        <div className="flex items-center justify-between border-b border-zinc-800 p-4">
          <h2 className="text-sm font-medium">Recentes</h2>
          <Link href="/admin/editor" className="text-sm text-zinc-400 hover:text-zinc-200">
            Criar
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-zinc-900/40 text-zinc-400">
              <tr>
                <th className="px-4 py-2 font-medium">Titulo</th>
                <th className="px-4 py-2 font-medium">ID</th>
                <th className="px-4 py-2 font-medium">Data</th>
                <th className="px-4 py-2 font-medium text-right">Views</th>
              </tr>
            </thead>
            <tbody>
              {latest.map((p) => (
                <tr key={p.postId} className="border-t border-zinc-800 hover:bg-zinc-900/40">
                  <td className="px-4 py-2 max-w-[420px] truncate">
                    <Link href={`/posts/${p.postId}`} className="hover:underline">
                      {p.title}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-zinc-400">{p.postId}</td>
                  <td className="px-4 py-2 text-zinc-400">{p.date ?? "—"}</td>
                  <td className="px-4 py-2 text-right">{p.views ?? 0}</td>
                </tr>
              ))}
              {latest.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-zinc-400">
                    Nenhum post encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
