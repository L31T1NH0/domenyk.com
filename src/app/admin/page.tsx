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
  const commentsCollection = db.collection("comments");
  const authCommentsCollection = db.collection("auth-comments");

  const [totalCount, visibleCount, viewsAgg, totalComments, latest] = await Promise.all([
    postsCollection.countDocuments({}),
    postsCollection.countDocuments({ hidden: { $ne: true } }),
    postsCollection
      .aggregate<{ totalViews: number }>([
        { $group: { _id: null, totalViews: { $sum: { $ifNull: ["$views", 0] } } } },
        { $project: { _id: 0, totalViews: 1 } },
      ])
      .toArray()
      .then((arr) => arr[0]?.totalViews ?? 0),
    Promise.all([
      commentsCollection.countDocuments({ parentId: null }),
      authCommentsCollection.countDocuments({ parentId: null }),
    ]).then(([a, b]) => a + b),
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
      .limit(3)
      .toArray() as unknown as Promise<PostRow[]>,
  ]);

  const totalViews = typeof viewsAgg === "number" ? viewsAgg : 0;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-[#f1f1f1]">
            Dashboard
          </h1>
          <p className="mt-1 text-sm text-[#A8A095]">
            Resumo do seu conteúdo e desempenho.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/admin/editor"
            className="inline-flex items-center gap-1.5 rounded-md bg-[#E00070] px-3.5 py-1.5 text-sm font-medium text-white transition-opacity hover:opacity-80"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M8 3v10M3 8h10" />
            </svg>
            Novo post
          </Link>
          <Link
            href="/admin/analytics"
            className="inline-flex items-center rounded-md border border-white/10 px-3.5 py-1.5 text-sm text-[#A8A095] transition-colors hover:border-white/20 hover:text-[#f1f1f1]"
          >
            Analytics
          </Link>
        </div>
      </div>

      {/* Stats */}
      <section className="grid sm:grid-cols-2 lg:grid-cols-4 border border-white/8 rounded-lg overflow-hidden divide-x divide-white/8">
        <StatCard label="Views totais" value={totalViews.toLocaleString("pt-BR")} accent />
        <StatCard label="Posts visíveis" value={visibleCount} />
        <StatCard label="Posts publicados" value={totalCount} />
        <StatCard label="Comentários totais" value={totalComments} />
      </section>

      {/* Recent posts */}
      <section>
        <div className="mb-3">
          <h2 className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#A8A095]">
            Posts
          </h2>
        </div>
        <RecentPostsClient initial={latest as any} />
      </section>
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div className="bg-[#040404] px-5 py-5 flex flex-col gap-3">
      <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#A8A095]">
        {label}
      </div>
      <div className={`text-3xl font-semibold tabular-nums tracking-tight ${accent ? "text-[#E00070]" : "text-[#f1f1f1]"}`}>
        {value}
      </div>
    </div>
  );
}
