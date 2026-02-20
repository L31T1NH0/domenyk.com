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
      <div className="relative overflow-hidden rounded-2xl border border-zinc-800/80 bg-gradient-to-br from-zinc-900/90 via-zinc-900/70 to-zinc-950 p-6 shadow-[0_20px_60px_-35px_rgba(0,0,0,0.7)]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(161,161,170,0.12),transparent_45%)]" />
        <div className="relative flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-zinc-400">Resumo do seu conteudo e desempenho.</p>
        </div>
        <Link
          href="/admin/editor"
          className="inline-flex items-center justify-center rounded-lg border border-zinc-700/80 bg-zinc-900/90 px-4 py-2 text-sm font-medium text-zinc-100 shadow-sm transition-all hover:-translate-y-0.5 hover:border-zinc-600 hover:bg-zinc-800"
        >
          Novo post
        </Link>
        <Link
          href="/admin/analytics"
          className="inline-flex items-center justify-center rounded-lg border border-zinc-700/80 bg-zinc-900/90 px-4 py-2 text-sm font-medium text-zinc-100 shadow-sm transition-all hover:-translate-y-0.5 hover:border-zinc-600 hover:bg-zinc-800"
        >
          Analytics
        </Link>
        </div>
      </div>

      <section className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-zinc-800/80 bg-gradient-to-b from-zinc-900/90 to-zinc-900/50 p-5 shadow-[0_12px_40px_-28px_rgba(0,0,0,0.9)]">
          <div className="text-xs text-zinc-400">posts publicados</div>
          <div className="mt-2 text-3xl font-semibold tracking-tight">{count}</div>
        </div>
        <div className="rounded-2xl border border-zinc-800/80 bg-gradient-to-b from-zinc-900/90 to-zinc-900/50 p-5 shadow-[0_12px_40px_-28px_rgba(0,0,0,0.9)]">
          <div className="text-xs text-zinc-400">views</div>
          <div className="mt-2 text-3xl font-semibold tracking-tight">{totalViews}</div>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-zinc-800/80 bg-zinc-900/60 shadow-[0_20px_50px_-40px_rgba(0,0,0,0.9)]">
        <div className="flex items-center justify-between border-b border-zinc-800/90 bg-zinc-900/60 px-4 py-3">
          <h2 className="text-sm font-medium text-zinc-200">Recentes</h2>
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





