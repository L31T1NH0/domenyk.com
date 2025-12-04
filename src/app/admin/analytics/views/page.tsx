import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";

import { resolveAdminStatus } from "@lib/admin";
import { getMongoDb } from "@lib/mongo";

import { getFromDate, parseRange, type RangeKey } from "../utils";

type ViewRow = {
  path: string;
  serverTs: Date;
  session: string;
  referrer?: string;
  isAuthenticated?: boolean;
  userId?: string;
  userImage?: string;
  isFirstView: boolean;
};

type GroupedPageViews = {
  path: string;
  views: Omit<ViewRow, "path">[];
};

async function getPageViewDetails(from: Date, pathFilter?: string): Promise<GroupedPageViews[]> {
  const db = await getMongoDb();
  const events = db.collection("analytics_events");

  const match: Record<string, unknown> = {
    name: "page_view",
    serverTs: { $gte: from },
  };

  if (pathFilter) {
    match["page.path"] = pathFilter;
  }

  const rows = await events
    .aggregate<GroupedPageViews>([
      { $match: match },
      { $addFields: { path: "$page.path" } },
      { $match: { path: { $type: "string", $ne: "" } } },
      {
        $setWindowFields: {
          partitionBy: { path: "$path", session: "$session" },
          sortBy: { serverTs: 1 },
          output: {
            firstTs: { $first: "$serverTs" },
          },
        },
      },
      { $addFields: { isFirstView: { $eq: ["$serverTs", "$firstTs"] } } },
      {
        $project: {
          _id: 0,
          path: 1,
          serverTs: 1,
          session: 1,
          referrer: "$page.referrer",
          isAuthenticated: "$flags.isAuthenticated",
          userId: "$userId",
          userImage: "$user.image",
          isFirstView: 1,
        },
      },
      { $sort: { path: 1, serverTs: -1 } },
      {
        $group: {
          _id: "$path",
          views: {
            $push: {
              serverTs: "$serverTs",
              session: "$session",
              referrer: "$referrer",
              isAuthenticated: "$isAuthenticated",
              userId: "$userId",
              userImage: "$userImage",
              isFirstView: "$isFirstView",
            },
          },
        },
      },
      { $project: { _id: 0, path: "$_id", views: 1 } },
      { $sort: { path: 1 } },
    ])
    .toArray();

  return rows
    .filter((row): row is GroupedPageViews & { path: string } => typeof row.path === "string" && row.path.length > 0)
    .map((row) => ({ path: row.path, views: row.views ?? [] }));
}

function formatDate(value: Date) {
  return new Date(value).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

export default async function AdminAnalyticsViewsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; path?: string }>;
}) {
  const { isAdmin } = await resolveAdminStatus();
  if (!isAdmin) {
    notFound();
  }

  const sp = await searchParams;
  const range = parseRange(sp?.range);
  const selectedPath = typeof sp?.path === "string" ? sp.path.trim() : "";
  const from = getFromDate(range);

  const [groupedViews] = await Promise.all([getPageViewDetails(from, selectedPath || undefined)]);

  const rangeTabs: { key: RangeKey; label: string }[] = [
    { key: "24h", label: "24h" },
    { key: "7d", label: "7 dias" },
    { key: "30d", label: "30 dias" },
  ];

  const buildRangeHref = (key: RangeKey) => {
    const params = new URLSearchParams();
    params.set("range", key);
    if (selectedPath) {
      params.set("path", selectedPath);
    }
    const query = params.toString();
    return query ? `?${query}` : "";
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Views por post</h1>
          <p className="text-sm text-zinc-400">Listagem detalhada de page views por sessão.</p>
        </div>
        <div className="flex items-center gap-2">
          {rangeTabs.map((t) => (
            <Link
              key={t.key}
              href={buildRangeHref(t.key)}
              className={[
                "inline-flex items-center justify-center rounded-lg border px-3 py-1.5 text-sm transition-colors",
                range === t.key
                  ? "border-zinc-600 bg-zinc-800 text-zinc-100"
                  : "border-zinc-800 bg-zinc-900 text-zinc-300 hover:bg-zinc-800",
              ].join(" ")}
            >
              {t.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 space-y-3">
        <h2 className="text-sm font-medium">Filtros</h2>
        <form className="flex flex-col gap-3 sm:flex-row sm:items-end" action="/admin/analytics/views">
          <input type="hidden" name="range" value={range} />
          <label className="flex flex-col gap-1 text-sm text-zinc-300">
            <span className="text-xs text-zinc-400">Página</span>
            <input
              type="text"
              name="path"
              defaultValue={selectedPath}
              placeholder="/blog/exemplo"
              className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-700 focus:outline-none"
            />
          </label>
          <div className="flex items-center gap-2">
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 transition-colors hover:bg-zinc-800"
            >
              Aplicar
            </button>
            <Link
              href="/admin/analytics/views"
              className="inline-flex items-center justify-center rounded-lg border border-zinc-800 px-3 py-2 text-sm text-zinc-300 transition-colors hover:bg-zinc-800"
            >
              Limpar
            </Link>
          </div>
        </form>
      </div>

      {groupedViews.length === 0 ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-6 text-center text-sm text-zinc-400">
          Nenhum dado no período.
        </div>
      ) : (
        <div className="space-y-4">
          {groupedViews.map((group) => (
            <section key={group.path} className="rounded-xl border border-zinc-800 bg-zinc-900/60">
              <div className="flex items-center justify-between border-b border-zinc-800 p-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-zinc-100">{group.path}</span>
                  <Link href={group.path} className="text-xs text-zinc-400 hover:underline" target="_blank" rel="noreferrer">
                    Abrir página
                  </Link>
                </div>
                <span className="text-xs text-zinc-400">{group.views.length} view(s)</span>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-zinc-900/40 text-zinc-400">
                    <tr>
                      <th className="px-4 py-2 font-medium">Visitante</th>
                      <th className="px-4 py-2 font-medium">Data</th>
                      <th className="px-4 py-2 font-medium">Referrer</th>
                      <th className="px-4 py-2 font-medium text-right">Sinais</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.views.map((view, idx) => (
                      <tr key={`${view.session}-${idx}`} className="border-t border-zinc-800">
                        <td className="px-4 py-2">
                          <div className="flex items-center gap-3">
                            {view.userImage ? (
                              <Image
                                src={view.userImage}
                                alt="Avatar"
                                width={32}
                                height={32}
                                className="h-8 w-8 rounded-full object-cover"
                              />
                            ) : (
                              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-800 text-xs text-zinc-300">
                                {view.isAuthenticated ? "👤" : ""}
                              </div>
                            )}
                            <div className="leading-tight">
                              <div className="text-sm text-zinc-100">{view.userId ?? "Anônimo"}</div>
                              <div className="text-xs text-zinc-500">Sessão: {view.session}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-2 text-zinc-100">{formatDate(view.serverTs)}</td>
                        <td className="px-4 py-2">
                          {view.referrer ? (
                            <Link
                              href={`https://${view.referrer}/`}
                              className="text-zinc-200 hover:underline"
                              target="_blank"
                              rel="noreferrer"
                            >
                              {view.referrer}
                            </Link>
                          ) : (
                            <span className="text-zinc-500">—</span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-right">
                          <div className="flex justify-end gap-2">
                            {view.isAuthenticated ? (
                              <span className="rounded-full bg-emerald-900/40 px-2 py-1 text-[11px] text-emerald-200">Autenticado</span>
                            ) : (
                              <span className="rounded-full bg-zinc-800 px-2 py-1 text-[11px] text-zinc-200">Anônimo</span>
                            )}
                            {view.isFirstView ? (
                              <span className="rounded-full bg-blue-900/40 px-2 py-1 text-[11px] text-blue-200">Primeira view</span>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

export const runtime = "nodejs";
