import { notFound } from "next/navigation";
import Link from "next/link";
import { getMongoDb } from "@lib/mongo";
import { resolveAdminStatus } from "@lib/admin";
import { getFromDate, parseRange, type RangeKey } from "./utils";

type DeviceBreakdown = { device: string; count: number }[];
type TopPageRow = {
  path: string;
  views: number;
  authenticatedViews: number;
  anonymousViews: number;
  referrer?: string;
}[];

async function getSummary(from: Date) {
  const db = await getMongoDb();
  const events = db.collection("analytics_events");

  const [pageViewBreakdown, uniqueSessions] = await Promise.all([
    events
      .aggregate<{ _id: boolean; count: number }>([
        { $match: { name: "page_view", serverTs: { $gte: from } } },
        {
          $group: {
            _id: {
              $cond: [{ $eq: ["$flags.isAuthenticated", true] }, true, false],
            },
            count: { $sum: 1 },
          },
        },
      ])
      .toArray(),
    events
      .aggregate<{ _id: string }>([
        { $match: { serverTs: { $gte: from } } },
        { $group: { _id: "$session" } },
        { $group: { _id: null, n: { $sum: 1 } } },
        { $project: { _id: 0, n: 1 } },
      ])
      .toArray()
      .then((arr) => (arr[0] as any)?.n ?? 0),
  ]);

  let authenticatedPageViews = 0;
  let anonymousPageViews = 0;
  for (const row of pageViewBreakdown) {
    if (row._id === true) {
      authenticatedPageViews = row.count;
    } else {
      anonymousPageViews += row.count;
    }
  }

  const pageViews = authenticatedPageViews + anonymousPageViews;

  return { pageViews, authenticatedPageViews, anonymousPageViews, uniqueSessions };
}

async function getDeviceBreakdown(from: Date): Promise<DeviceBreakdown> {
  const db = await getMongoDb();
  const events = db.collection("analytics_events");
  const rows = await events
    .aggregate<{ _id: string | null; count: number }>([
      { $match: { serverTs: { $gte: from } } },
      { $group: { _id: "$device", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ])
    .toArray();
  return rows.map((r) => ({ device: r._id ?? "unknown", count: r.count }));
}

async function getTopPages(from: Date, limit = 10): Promise<TopPageRow> {
  const db = await getMongoDb();
  const events = db.collection("analytics_events");
  const baseRows = await events
    .aggregate<{
      path: string;
      views: number;
      authenticatedViews: number;
    }>([
      { $match: { serverTs: { $gte: from }, name: "page_view" } },
      {
        $group: {
          _id: "$page.path",
          views: { $sum: 1 },
          authenticatedViews: {
            $sum: { $cond: [{ $eq: ["$flags.isAuthenticated", true] }, 1, 0] },
          },
        },
      },
      {
        $project: {
          _id: 0,
          path: "$_id",
          views: 1,
          authenticatedViews: 1,
        },
      },
      { $sort: { views: -1 } },
      { $limit: limit },
    ])
    .toArray();

  const topPaths = baseRows.map((row) => row.path).filter((path): path is string => typeof path === "string");
  let referrers: Record<string, string | undefined> = {};

  if (topPaths.length > 0) {
    const refRows = await events
      .aggregate<{ path: string; referrer: string }>([
        {
          $match: {
            serverTs: { $gte: from },
            name: "page_view",
            "page.path": { $in: topPaths },
            "page.referrer": { $type: "string", $ne: "" },
          },
        },
        { $group: { _id: { path: "$page.path", referrer: "$page.referrer" }, count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $group: { _id: "$_id.path", referrer: { $first: "$_id.referrer" } } },
        { $project: { _id: 0, path: "$_id", referrer: 1 } },
      ])
      .toArray();

    referrers = Object.fromEntries(refRows.map((row) => [row.path, row.referrer]));
  }

  return baseRows
    .filter((row): row is typeof row & { path: string } => typeof row.path === "string" && row.path.length > 0)
    .map((row) => ({
      path: row.path,
      views: row.views,
      authenticatedViews: row.authenticatedViews,
      anonymousViews: Math.max(0, row.views - row.authenticatedViews),
      referrer: referrers[row.path],
    }));
}


type TimeSeriesPoint = {
  label: string;
  views: number;
  sessions: number;
  authenticatedViews: number;
  anonymousViews: number;
};
type TimeUnit = "day" | "hour";

function toKeyString(d: Date, unit: TimeUnit): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  if (unit === "day") {
    return `${yyyy}-${mm}-${dd}`;
  }
  const hh = String(d.getHours()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:00`;
}

function buildRange(from: Date, unit: TimeUnit): string[] {
  const start = new Date(from);
  if (unit === "day") {
    start.setHours(0, 0, 0, 0);
  } else {
    start.setMinutes(0, 0, 0);
  }
  const end = new Date();
  if (unit === "day") {
    end.setHours(0, 0, 0, 0);
  } else {
    end.setMinutes(0, 0, 0);
  }

  const keys: string[] = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    keys.push(toKeyString(cursor, unit));
    if (unit === "day") {
      cursor.setDate(cursor.getDate() + 1);
    } else {
      cursor.setHours(cursor.getHours() + 1);
    }
  }
  return keys;
}

async function getTimeSeries(from: Date, unit: TimeUnit): Promise<TimeSeriesPoint[]> {
  const db = await getMongoDb();
  const events = db.collection("analytics_events");
  const [result] = await events
    .aggregate<{
      views: { bucket: Date; count: number }[];
      authenticatedViews: { bucket: Date; count: number }[];
      sessions: { bucket: Date; count: number }[];
    }>([
      { $match: { serverTs: { $gte: from } } },
      {
        $facet: {
          views: [
            { $match: { name: "page_view" } },
            { $group: { _id: { $dateTrunc: { date: "$serverTs", unit: unit } }, count: { $sum: 1 } } },
            { $project: { _id: 0, bucket: "$_id", count: 1 } },
            { $sort: { day: 1 } },
          ],
          authenticatedViews: [
            { $match: { name: "page_view", "flags.isAuthenticated": true } },
            { $group: { _id: { $dateTrunc: { date: "$serverTs", unit: unit } }, count: { $sum: 1 } } },
            { $project: { _id: 0, bucket: "$_id", count: 1 } },
            { $sort: { day: 1 } },
          ],
          sessions: [
            { $group: { _id: { bucket: { $dateTrunc: { date: "$serverTs", unit: unit } }, session: "$session" } } },
            { $group: { _id: "$_id.bucket", count: { $sum: 1 } } },
            { $project: { _id: 0, bucket: "$_id", count: 1 } },
            { $sort: { day: 1 } },
          ],
        },
      },
    ])
    .toArray();

  const keys = buildRange(from, unit);
  const viewsMap = new Map<string, number>((result?.views ?? []).map((r) => [toKeyString(new Date(r.bucket), unit), r.count]));
  const authedMap = new Map<string, number>(
    (result?.authenticatedViews ?? []).map((r) => [toKeyString(new Date(r.bucket), unit), r.count])
  );
  const sessMap = new Map<string, number>((result?.sessions ?? []).map((r) => [toKeyString(new Date(r.bucket), unit), r.count]));

  return keys.map((label) => ({
    label,
    views: viewsMap.get(label) ?? 0,
    sessions: sessMap.get(label) ?? 0,
    authenticatedViews: authedMap.get(label) ?? 0,
    anonymousViews: Math.max(0, (viewsMap.get(label) ?? 0) - (authedMap.get(label) ?? 0)),
  }));
}

function LineChart({ points }: { points: TimeSeriesPoint[] }) {
  const width = 640;
  const height = 160;
  const pad = 16;
  const innerW = width - pad * 2;
  const innerH = height - pad * 2;
  const n = Math.max(1, points.length);
  const maxY = Math.max(1, ...points.map((p) => p.views), ...points.map((p) => p.sessions));
  const scaleX = (i: number) => (n === 1 ? innerW / 2 : (i / (n - 1)) * innerW) + pad;
  const scaleY = (v: number) => height - pad - (v / maxY) * innerH;

  const toPolyline = (vals: number[]) =>
    vals.map((v, i) => `${scaleX(i)},${scaleY(v)}`).join(" ");

  const views = points.map((p) => p.views);
  const sessions = points.map((p) => p.sessions);

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
      <rect x={0} y={0} width={width} height={height} fill="none" />
      {/* grid */}
      <line x1={pad} y1={height - pad} x2={width - pad} y2={height - pad} stroke="#3f3f46" strokeWidth={1} />
      {/* views */}
      <polyline fill="none" stroke="#60a5fa" strokeWidth={2} points={toPolyline(views)} />
      {/* sessions */}
      <polyline fill="none" stroke="#4ade80" strokeWidth={2} points={toPolyline(sessions)} />
      {/* legend */}
      <g>
        <circle cx={pad + 6} cy={pad + 6} r={3} fill="#60a5fa" />
        <text x={pad + 12} y={pad + 9} fill="#e4e4e7" fontSize="10">Views</text>
        <circle cx={pad + 64} cy={pad + 6} r={3} fill="#4ade80" />
        <text x={pad + 70} y={pad + 9} fill="#e4e4e7" fontSize="10">Sessões</text>
      </g>
    </svg>
  );
}

export default async function AdminAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const { isAdmin } = await resolveAdminStatus();
  if (!isAdmin) {
    notFound();
  }

  const sp = await searchParams;
  const range = parseRange(sp?.range);
  const from = getFromDate(range);

  const [summary, device, topPages, series] = await Promise.all([
    getSummary(from),
    getDeviceBreakdown(from),
    getTopPages(from, 10),
    getTimeSeries(from, range === "24h" ? "hour" : "day"),
  ]);

  const rangeTabs: { key: RangeKey; label: string }[] = [
    { key: "24h", label: "24h" },
    { key: "7d", label: "7 dias" },
    { key: "30d", label: "30 dias" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
          <p className="text-sm text-zinc-400">Leituras, dispositivos e engajamento.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/analytics/views"
            className="inline-flex items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-300 transition-colors hover:bg-zinc-800"
          >
            Detalhar views por post
          </Link>
          {rangeTabs.map((t) => (
            <Link
              key={t.key}
              href={`?range=${t.key}`}
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

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
          <div className="text-xs text-zinc-400">Page views</div>
          <div className="mt-2 text-3xl font-semibold">{summary.pageViews}</div>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
          <div className="text-xs text-zinc-400">Sessões únicas</div>
          <div className="mt-2 text-3xl font-semibold">{summary.uniqueSessions}</div>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
          <div className="text-xs text-zinc-400">Views autenticadas</div>
          <div className="mt-2 text-3xl font-semibold">{summary.authenticatedPageViews}</div>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
          <div className="text-xs text-zinc-400">Views anônimas</div>
          <div className="mt-2 text-3xl font-semibold">{summary.anonymousPageViews}</div>
        </div>
      </section>

      <section className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3 mb-3">
          <h2 className="text-sm font-medium">Série temporal (views x sessões)</h2>
          <span className="text-xs text-zinc-400">{series.length} dia(s)</span>
        </div>
        <LineChart points={series} />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60">
          <div className="flex items-center justify-between border-b border-zinc-800 p-4">
            <h2 className="text-sm font-medium">Top páginas por views</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm min-w-[640px]">
              <thead className="bg-zinc-900/40 text-zinc-400">
                <tr>
                  <th className="px-4 py-2 font-medium">Página</th>
                  <th className="px-4 py-2 font-medium">Domínio</th>
                  <th className="px-4 py-2 font-medium text-right">Views</th>
                  <th className="px-4 py-2 font-medium text-right">Autenticadas</th>
                  <th className="px-4 py-2 font-medium text-right">Anônimas</th>
                </tr>
              </thead>
              <tbody>
                {topPages.length > 0 ? (
                  topPages.map((row) => (
                    <tr key={row.path} className="border-t border-zinc-800">
                      <td className="px-4 py-2">
                        <Link href={row.path} className="text-zinc-100 hover:underline">
                          {row.path}
                        </Link>
                      </td>
                      <td className="px-4 py-2">
                        {row.referrer ? (
                          <Link
                            href={`https://${row.referrer}/`}
                            className="text-zinc-200 hover:underline"
                            target="_blank"
                            rel="noreferrer"
                          >
                            {row.referrer}
                          </Link>
                        ) : (
                          <span className="text-zinc-500">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums">{row.views}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{row.authenticatedViews}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{row.anonymousViews}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-zinc-400">
                      Nenhum dado no período.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60">
          <div className="flex items-center justify-between border-b border-zinc-800 p-4">
            <h2 className="text-sm font-medium">Dispositivos</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-zinc-900/40 text-zinc-400">
                <tr>
                  <th className="px-4 py-2 font-medium">Tipo</th>
                  <th className="px-4 py-2 font-medium text-right">Eventos</th>
                </tr>
              </thead>
              <tbody>
                {device.length > 0 ? (
                  device.map((d) => (
                    <tr key={d.device} className="border-t border-zinc-800">
                      <td className="px-4 py-2 capitalize">{d.device}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{d.count}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={2} className="px-4 py-8 text-center text-zinc-400">
                      Nenhum dado no período.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Seções de funil e progresso removidas após a descontinuação dos eventos de leitura */}
    </div>
  );
}

export const runtime = "nodejs";

