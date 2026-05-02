import Link from "next/link"
import { getPosts } from "@/lib/db/posts"
import { getRecentComments } from "@/lib/db/comments"

export default async function AdminDashboard() {
  const [{ total }, recentComments] = await Promise.all([
    getPosts({ includeUnpublished: true }),
    getRecentComments(5),
  ])

  return (
    <>
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-400">Admin</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Dashboard</h1>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[
          { label: "Posts", value: total, href: "/admin/posts" },
          { label: "Comentários recentes", value: recentComments.length, href: "/admin/comments" },
        ].map((stat) => (
          <Link
            key={stat.href}
            href={stat.href}
            className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm transition-colors hover:border-neutral-300 dark:border-neutral-900 dark:bg-neutral-950 dark:hover:border-neutral-800"
          >
            <p className="text-sm font-medium text-neutral-500">{stat.label}</p>
            <p className="mt-2 text-3xl font-semibold tracking-tight">{stat.value}</p>
          </Link>
        ))}
      </div>

      <section className="rounded-lg border border-neutral-200 bg-white shadow-sm dark:border-neutral-900 dark:bg-neutral-950">
        <div className="border-b border-neutral-200 px-4 py-3 dark:border-neutral-900">
          <h2 className="text-sm font-semibold">Comentários recentes</h2>
        </div>
        <div className="divide-y divide-neutral-100 dark:divide-neutral-900">
          {recentComments.map((c) => (
            <div key={c._id.toString()} className="flex gap-3 px-4 py-3 text-sm">
              {c.authorImageUrl ? (
                <img src={c.authorImageUrl} alt="" className="w-6 h-6 rounded-full shrink-0" />
              ) : (
                <div className="w-6 h-6 rounded-full shrink-0 bg-neutral-200 dark:bg-neutral-800 text-[10px] grid place-items-center">
                  {c.authorName.slice(0, 1).toUpperCase()}
                </div>
              )}
              <div>
                <span className="font-medium">{c.authorName}</span>
                <span className="text-neutral-400 mx-1">·</span>
                <span className="text-neutral-500">{c.content.slice(0, 80)}</span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </>
  )
}
