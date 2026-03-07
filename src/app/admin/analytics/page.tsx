import { notFound } from "next/navigation";
import Link from "next/link";
import { unstable_cache } from "next/cache";
import { getMongoDb } from "@lib/mongo";
import { resolveAdminStatus } from "@lib/admin";
import { getFromDate, parseRange, type RangeKey } from "./utils";
import { getAnalyticsEnabled } from "@lib/analytics/config";
import { AnalyticsToggle } from "@components/analytics/AnalyticsToggle";
import MobileHighlightStyleToggle from "../MobileHighlightStyleToggle";

type DeviceBreakdown = { device: string; count: number }[];
type TopPageRow = {
  path: string;
  views: number;
  authenticatedViews: number;
  anonymousViews: number;
  referrer?: string;
}[];

type MobileHighlightStyleSetting = {
  _id: string;
  value?: "badges" | "border";
};


// ---------------------------------------------------------------------------
// FIX #4a: Wrap all heavy MongoDB aggregate functions with unstable_cache.
// Previously, every page render hit the database with 4+ aggregation pipelines.
// With these wrappers, results are cached per range key for 5 minutes,
// dramatically reducing DB load for the admin analytics dashboard.
// ---------------------------------------------------------------------------

async function _getSummary(fromIso: string) {
  const from = new Date(fromIso);
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

async function _getDeviceBreakdown(fromIso: string): Promise<DeviceBreakdown> {
  const from = new Date(fromIso);
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

// ---------------------------------------------------------------------------
// FIX #4b: The original getTopPages ran TWO sequential aggregation pipelines
// against the same collection (one for view counts, then another for referrers).
// This caused two full collection scans on `analytics_events`.
//
// The fix merges both into a single pipeline using $facet, so MongoDB scans
// the collection only once and returns views + referrers in one round-trip.
// ---------------------------------------------------------------------------
async function _getTopPages(fromIso: string, limit = 10): Promise<TopPageRow> {
  const from = new Date(fromIso);
  const db = await getMongoDb();
  const events = db.collection("analytics_events");

  const [result] = await events
    .aggregate<{
      baseRows: { path: string; views: number; authenticatedViews: number }[];
      refRows: { path: string; referrer: string }[];
    }>([
      // Single $match on the whole collection — used by both facets below.
      { $match: { serverTs: { $gte: from }, name: "page_view" } },
      {
        $facet: {
          // Facet 1: view counts per path (same as the old first aggregation)
          baseRows: [
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
          ],
          // Facet 2: top referrer per path (was a separate aggregation before)
          refRows: [
            {
              $match: {
                "page.referrer": { $type: "string", $ne: "" },
              },
            },
            {
              $group: {
                _id: { path: "$page.path", referrer: "$page.referrer" },
                count: { $sum: 1 },
              },
            },
            { $sort: { count: -1 } },
            {
              $group: {
                _id: "$_id.path",
                referrer: { $first: "$_id.referrer" },
              },
            },
            { $project: { _id: 0, path: "$_id", referrer: 1 } },
          ],
        },
      },
    ])
    .toArray();

  const baseRows = result?.baseRows ?? [];
  const refMap = new Map(
    (result?.refRows ?? []).map((r) => [r.path, r.referrer])
  );

  return baseRows
    .filter(
      (row): row is typeof row & { path: string } =>
        typeof row.path === "string" && row.path.length > 0
    )
    .map((row) => ({
      path: row.path,
      views: row.views,
      authenticatedViews: row.authenticatedViews,
      anonymousViews: Math.max(0, row.views - row.authenticatedViews),
      referrer: refMap.get(row.path),
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

async function _getTimeSeries(fromIso: string, unit: TimeUnit): Promise<TimeSeriesPoint[]> {
  const from = new Date(fromIso);
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
            { $sort: { bucket: 1 } },
          ],
          authenticatedViews: [
            { $match: { name: "page_view", "flags.isAuthenticated": true } },
            { $group: { _id: { $dateTrunc: { date: "$serverTs", unit: unit } }, count: { $sum: 1 } } },
            { $project: { _id: 0, bucket: "$_id", count: 1 } },
            { $sort: { bucket: 1 } },
          ],
          sessions: [
            { $group: { _id: { bucket: { $dateTrunc: { date: "$serverTs", unit: unit } }, session: "$session" } } },
            { $group: { _id: "$_id.bucket", count: { $sum: 1 } } },
            { $project: { _id: 0, bucket: "$_id", count: 1 } },
            { $sort: { bucket: 1 } },
          ],
        },
      },
    ])
    .toArray();

  const keys = buildRange(from, unit);
  const viewsMap = new Map<string, number>(
    (result?.views ?? []).map((r) => [toKeyString(new Date(r.bucket), unit), r.count])
  );
  const authedMap = new Map<string, number>(
    (result?.authenticatedViews ?? []).map((r) => [toKeyString(new Date(r.bucket), unit), r.count])
  );
  const sessMap = new Map<string, number>(
    (result?.sessions ?? []).map((r) => [toKeyString(new Date(r.bucket), unit), r.count])
  );

  return keys.map((label) => ({
    label,
    views: viewsMap.get(label) ?? 0,
    sessions: sessMap.get(label) ?? 0,
    authenticatedViews: authedMap.get(label) ?? 0,
    anonymousViews: Math.max(0, (viewsMap.get(label) ?? 0) - (authedMap.get(label) ?? 0)),
  }));
}

// ─── Cached wrappers (5-minute TTL per range key) ───────────────────────────
const ANALYTICS_CACHE_TTL = 5 * 60; // seconds

function getSummary(fromIso: string) {
  return unstable_cache(
    () => _getSummary(fromIso),
    ["analytics-summary", fromIso],
    { revalidate: ANALYTICS_CACHE_TTL }
  )();
}

function getDeviceBreakdown(fromIso: string) {
  return unstable_cache(
    () => _getDeviceBreakdown(fromIso),
    ["analytics-device", fromIso],
    { revalidate: ANALYTICS_CACHE_TTL }
  )();
}

function getTopPages(fromIso: string, limit = 10) {
  return unstable_cache(
    () => _getTopPages(fromIso, limit),
    ["analytics-top-pages", fromIso, String(limit)],
    { revalidate: ANALYTICS_CACHE_TTL }
  )();
}

function getTimeSeries(fromIso: string, unit: TimeUnit) {
  return unstable_cache(
    () => _getTimeSeries(fromIso, unit),
    ["analytics-time-series", fromIso, unit],
    { revalidate: ANALYTICS_CACHE_TTL }
  )();
}
// ────────────────────────────────────────────────────────────────────────────

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
      <line x1={pad} y1={height - pad} x2={width - pad} y2={height - pad} stroke="rgba(255,255,255,0.06)" strokeWidth={1} />
      <polyline fill="none" stroke="#E00070" strokeWidth={2} points={toPolyline(views)} />
      <polyline fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth={1.5} points={toPolyline(sessions)} />
      <g>
        <circle cx={pad + 6} cy={pad + 6} r={3} fill="#E00070" />
        <text x={pad + 12} y={pad + 9} fill="#A8A095" fontSize="10">Views</text>
        <circle cx={pad + 64} cy={pad + 6} r={3} fill="rgba(255,255,255,0.3)" />
        <text x={pad + 70} y={pad + 9} fill="#A8A095" fontSize="10">Sessões</text>
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
  // Serialize to ISO string so unstable_cache key is stable across requests
  const fromIso = from.toISOString();

  const [analyticsEnabled, mobileHighlightStyle] = await Promise.all([
    getAnalyticsEnabled(),
    getMongoDb()
      .then((db) =>
        db
          .collection<MobileHighlightStyleSetting>("settings")
          .findOne({ _id: "mobileHighlightStyle" })
      )
      .then((highlightStyleDoc) =>
        (highlightStyleDoc?.value as "badges" | "border") ?? "badges"
      ),
  ]);

  const [summary, device, topPages, series] = await Promise.all([
    getSummary(fromIso),
    getDeviceBreakdown(fromIso),
    getTopPages(fromIso, 10),
    getTimeSeries(fromIso, range === "24h" ? "hour" : "day"),
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
          <h1 className="text-xl font-semibold tracking-tight text-[#f1f1f1]">Analytics</h1>
          <p className="text-sm text-[#A8A095]">Leituras, dispositivos e engajamento.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/analytics/views"
            className="inline-flex items-center justify-center rounded-md border border-white/10 px-3 py-1.5 text-xs text-[#A8A095] transition-colors hover:border-white/20 hover:text-[#f1f1f1]"
          >
            Detalhar views por post
          </Link>
          {rangeTabs.map((t) => (
            <Link
              key={t.key}
              href={`?range=${t.key}`}
              className={[
                "inline-flex items-center justify-center rounded-md border px-3 py-1.5 text-xs transition-colors",
                range === t.key
                  ? "border-[#E00070]/40 bg-[#E00070]/10 text-[#f1f1f1]"
                  : "border-white/10 text-[#A8A095] hover:border-white/20 hover:text-[#f1f1f1]",
              ].join(" ")}
            >
              {t.label}
            </Link>
          ))}
        </div>
      </div>

      <AnalyticsToggle initialEnabled={analyticsEnabled} />
      <MobileHighlightStyleToggle initialValue={mobileHighlightStyle} />

      <section className="grid sm:grid-cols-2 xl:grid-cols-4 border border-white/8 rounded-lg overflow-hidden divide-x divide-white/8">
        <div className="bg-[#040404] px-5 py-5 flex flex-col gap-3">
          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#A8A095]">Page views</div>
          <div className="text-3xl font-semibold tabular-nums text-[#E00070]">{summary.pageViews}</div>
        </div>
        <div className="bg-[#040404] px-5 py-5 flex flex-col gap-3">
          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#A8A095]">Sessões únicas</div>
          <div className="text-3xl font-semibold tabular-nums text-[#f1f1f1]">{summary.uniqueSessions}</div>
        </div>
        <div className="bg-[#040404] px-5 py-5 flex flex-col gap-3">
          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#A8A095]">Views autenticadas</div>
          <div className="text-3xl font-semibold tabular-nums text-[#f1f1f1]">{summary.authenticatedPageViews}</div>
        </div>
        <div className="bg-[#040404] px-5 py-5 flex flex-col gap-3">
          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#A8A095]">Views anônimas</div>
          <div className="text-3xl font-semibold tabular-nums text-[#f1f1f1]">{summary.anonymousPageViews}</div>
        </div>
      </section>

      <section className="border border-white/8 rounded-lg overflow-hidden">
        <div className="flex items-center justify-between border-b border-white/6 px-4 py-3">
          <h2 className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#A8A095]">Série temporal — views x sessões</h2>
          <span className="text-xs text-[#A8A095]">{series.length} dia(s)</span>
        </div>
        <div className="bg-[#040404] p-4">
          <LineChart points={series} />
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="border border-white/8 rounded-lg overflow-hidden">
          <div className="border-b border-white/6 px-4 py-3">
            <h2 className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#A8A095]">Top páginas por views</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-xs">
              <thead className="border-b border-white/6">
                <tr>
                  <th className="px-4 py-2 font-bold uppercase tracking-[0.14em] text-[#A8A095]">Página</th>
                  <th className="px-4 py-2 font-bold uppercase tracking-[0.14em] text-[#A8A095]">Referrer</th>
                  <th className="px-4 py-2 font-bold uppercase tracking-[0.14em] text-[#A8A095] text-right">Views</th>
                  <th className="px-4 py-2 font-bold uppercase tracking-[0.14em] text-[#A8A095] text-right">Auth</th>
                  <th className="px-4 py-2 font-bold uppercase tracking-[0.14em] text-[#A8A095] text-right">Anon</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/6">
                {topPages.length > 0 ? (
                  topPages.map((p) => (
                    <tr key={p.path} className="hover:bg-white/2 transition-colors">
                      <td className="px-4 py-2.5 font-mono text-[#f1f1f1]">{p.path}</td>
                      <td className="px-4 py-2.5 text-[#A8A095] truncate max-w-[140px]">
                        {p.referrer ?? "—"}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-[#f1f1f1]">{p.views}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-[#A8A095]">{p.authenticatedViews}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-[#A8A095]">{p.anonymousViews}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-[#A8A095]">
                      Nenhum dado no período.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="border border-white/8 rounded-lg overflow-hidden">
          <div className="border-b border-white/6 px-4 py-3">
            <h2 className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#A8A095]">Dispositivos</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-xs">
              <thead className="border-b border-white/6">
                <tr>
                  <th className="px-4 py-2 font-bold uppercase tracking-[0.14em] text-[#A8A095]">Dispositivo</th>
                  <th className="px-4 py-2 font-bold uppercase tracking-[0.14em] text-[#A8A095] text-right">Eventos</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/6">
                {device.length > 0 ? (
                  device.map((d) => (
                    <tr key={d.device} className="hover:bg-white/2 transition-colors">
                      <td className="px-4 py-2.5 capitalize text-[#f1f1f1]">{d.device}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-[#f1f1f1]">{d.count}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={2} className="px-4 py-8 text-center text-[#A8A095]">
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
