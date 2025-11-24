import Link from "next/link";
import { notFound } from "next/navigation";
import { getMongoDb } from "../../lib/mongo";
import VisibilityToggle from "./VisibilityToggle";
import RecentPostsClient from "./RecentPostsClient";
import { resolveAdminStatus } from "../../lib/admin";

export const runtime = "nodejs";

type PostRow = {
  _id?: string;
  postId: string;
  title: string;
  subtitle?: string | null;
  date?: string;
  views?: number;
  hidden?: boolean;
  paragraphCommentsEnabled?: boolean;
};

export default async function AdminDashboard() {
  const { isAdmin } = await resolveAdminStatus();
  if (!isAdmin) {
    notFound();
  }

  const db = await getMongoDb();
  const postsCollection = db.collection("posts");

  const [count, viewsAgg, latest] = await Promise.all([
    postsCollection.countDocuments({ hidden: { $ne: true } }),
    postsCollection
      .aggregate<{ totalViews: number }>([
        { $group: { _id: null, totalViews: { $sum: { $ifNull: ["$views", 0] } } } },
        { $project: { _id: 0, totalViews: 1 } },
      ])
      .toArray()
      .then((arr) => arr[0]?.totalViews ?? 0),
    postsCollection
      .find(
        {},
        {
          projection: {
            _id: 0,
            postId: 1,
            title: 1,
            subtitle: 1,
            date: 1,
            views: 1,
            coAuthorUserId: 1,
            paragraphCommentsEnabled: 1,
            hidden: 1,
          },
        }
      )
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
          className="inline-flex items-center justify-center rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-200 shadow-sm hover:bg-zinc-800 hover:text-zinc-100 transition-colors"
        >
          Novo post
        </Link>
        <Link
          href="/admin/analytics"
          className="inline-flex items-center justify-center rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-200 shadow-sm hover:bg-zinc-800 hover:text-zinc-100 transition-colors"
        >
          Analytics
        </Link>
      </div>

      <section className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
          <div className="text-xs text-zinc-400">Posts publicados</div>
          <div className="mt-2 text-3xl font-semibold">{count}</div>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
          <div className="text-xs text-zinc-400">Visualizacoes (total)</div>
          <div className="mt-2 text-3xl font-semibold">{totalViews}</div>
        </div>
      </section>

      <section className="rounded-xl border border-zinc-800 bg-zinc-900/60">
        <div className="flex items-center justify-between border-b border-zinc-800 p-4">
          <h2 className="text-sm font-medium">Recentes</h2>
        </div>
        <div className="p-4 md:p-0">
          <div className="overflow-x-auto">
            <RecentPostsClient initial={latest as any} />
          </div>
        </div>
      </section>
    </div>
  );
}






