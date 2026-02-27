import Link from "next/link";
import { notFound } from "next/navigation";
import { getMongoDb } from "../../lib/mongo";
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
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-medium tracking-tight text-zinc-100">
            Dashboard
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Resumo do seu conteúdo e desempenho.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/admin/editor"
            className="inline-flex items-center gap-1.5 rounded-md bg-zinc-100 px-3.5 py-1.5 text-sm font-medium text-zinc-900 transition-colors hover:bg-white"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M8 3v10M3 8h10" />
            </svg>
            Novo post
          </Link>
          <Link
            href="/admin/analytics"
            className="inline-flex items-center rounded-md border border-zinc-800 px-3.5 py-1.5 text-sm text-zinc-400 transition-colors hover:border-zinc-700 hover:text-zinc-200"
          >
            Analytics
          </Link>
        </div>
      </div>

      {/* Stats */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Posts publicados" value={count} />
        <StatCard label="Views totais" value={totalViews.toLocaleString("pt-BR")} />
      </section>

      {/* Recent posts */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-medium text-zinc-400">Recentes</h2>
        </div>
        <div className="overflow-hidden rounded-lg border border-zinc-800/60">
          <div className="overflow-x-auto">
            <RecentPostsClient initial={latest as any} />
          </div>
        </div>
      </section>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-zinc-800/60 bg-zinc-900/40 px-5 py-4">
      <div className="text-xs font-medium uppercase tracking-wider text-zinc-500">
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold tabular-nums tracking-tight text-zinc-100">
        {value}
      </div>
    </div>
  );
}
