import { notFound } from "next/navigation";
import Link from "next/link";
import { getMongoDb } from "@lib/mongo";
import { resolveAdminStatus } from "@lib/admin";

type RangeKey = "24h" | "7d" | "30d";

function parseRange(input: unknown): RangeKey {
  const value = typeof input === "string" ? (input as string).toLowerCase() : "";
  if (value === "24h" || value === "7d" || value === "30d") return value;
  return "7d";
}

function getFromDate(range: RangeKey): Date {
  const now = new Date();
  const from = new Date(now);
  if (range === "24h") {
    from.setTime(now.getTime() - 24 * 60 * 60 * 1000);
  } else if (range === "30d") {
    from.setTime(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  } else {
    from.setTime(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  }
  return from;
}

type DeviceBreakdown = { device: string; count: number }[];
type TopPagesRow = { path: string; views: number; completions: number; completionRate: number }[];
type ProgressSummary = {
  uniqueViews: number;
  p25: number;
  p50: number;
  p75: number;
  p100: number;
};
type PageProgressRow = {
  path: string;
  uniqueViews: number;
  p25: number;
  p50: number;
  p75: number;
  p100: number;
  completionRate: number;
}[];

async function getSummary(from: Date) {
  const db = await getMongoDb();
  const events = db.collection("analytics_events");

  const [pageViews, readCompletions, uniqueSessions] = await Promise.all([
    events.countDocuments({ name: "page_view", serverTs: { $gte: from } }),
    events.countDocuments({ name: "read_complete", serverTs: { $gte: from } }),
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

  return { pageViews, readCompletions, uniqueSessions };
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

async function getTopPages(from: Date, limit = 10): Promise<TopPagesRow> {
  const db = await getMongoDb();
  const events = db.collection("analytics_events");
  const rows = await events
    .aggregate<{
      path: string;
      views: number;
      completions: number;
      completionRate: number;
    }>([
      { $match: { serverTs: { $gte: from }, name: { $in: ["page_view", "read_complete"] } } },
      { $group: { _id: { path: "$page.path", name: "$name" }, count: { $sum: 1 } } },
      {
        $group: {
          _id: "$_id.path",
          views: {
            $sum: { $cond: [{ $eq: ["$_id.name", "page_view"] }, "$count", 0] },
          },
          completions: {
            $sum: { $cond: [{ $eq: ["$_id.name", "read_complete"] }, "$count", 0] },
          },
        },
      },
      {
        $project: {
          _id: 0,
          path: "$_id",
          views: 1,
          completions: 1,
          completionRate: {
            $cond: [{ $gt: ["$views", 0] }, { $divide: ["$completions", "$views"] }, 0],
          },
        },
      },
      { $sort: { views: -1 } },
      { $limit: limit },
    ])
    .toArray();

  return rows.map((r) => ({
    path: r.path,
    views: r.views,
    completions: r.completions,
    completionRate: r.completionRate,
  }));
}

async function getProgressSummary(from: Date): Promise<ProgressSummary> {
  const db = await getMongoDb();
  const events = db.collection("analytics_events");

  const [res] = await events
    .aggregate<{
      views: number;
      p25: number;
      p50: number;
      p75: number;
      p100: number;
    }>([
      { $match: { serverTs: { $gte: from }, name: { $in: ["page_view", "read_progress", "read_complete"] } } },
      {
        $project: {
          page: "$page.path",
          session: "$session",
          type: "$name",
          milestone: {
            $cond: [
              { $eq: ["$name", "read_complete"] },
              100,
              { $ifNull: ["$data.progress", null] },
            ],
          },
        },
      },
      {
        $project: {
          page: 1,
          session: 1,
          milestone: {
            $switch: {
              branches: [
                { case: { $eq: ["$type", "page_view"] }, then: 0 },
                { case: { $eq: ["$milestone", 25] }, then: 25 },
                { case: { $eq: ["$milestone", 50] }, then: 50 },
                { case: { $eq: ["$milestone", 75] }, then: 75 },
                { case: { $eq: ["$milestone", 100] }, then: 100 },
              ],
              default: null,
            },
          },
        },
      },
      { $match: { milestone: { $in: [0, 25, 50, 75, 100] } } },
      { $group: { _id: { page: "$page", session: "$session", m: "$milestone" } } },
      {
        $group: {
          _id: null,
          views: { $sum: { $cond: [{ $eq: ["$_id.m", 0] }, 1, 0] } },
          p25: { $sum: { $cond: [{ $eq: ["$_id.m", 25] }, 1, 0] } },
          p50: { $sum: { $cond: [{ $eq: ["$_id.m", 50] }, 1, 0] } },
          p75: { $sum: { $cond: [{ $eq: ["$_id.m", 75] }, 1, 0] } },
          p100: { $sum: { $cond: [{ $eq: ["$_id.m", 100] }, 1, 0] } },
        },
      },
      { $project: { _id: 0, views: 1, p25: 1, p50: 1, p75: 1, p100: 1 } },
    ])
    .toArray();

  return {
    uniqueViews: res?.views ?? 0,
    p25: res?.p25 ?? 0,
    p50: res?.p50 ?? 0,
    p75: res?.p75 ?? 0,
    p100: res?.p100 ?? 0,
  };
}

async function getTopPagesProgress(from: Date, limit = 10): Promise<PageProgressRow> {
  const db = await getMongoDb();
  const events = db.collection("analytics_events");
  const rows = await events
    .aggregate<{
      path: string;
      uniqueViews: number;
      p25: number;
      p50: number;
      p75: number;
      p100: number;
      completionRate: number;
    }>([
      { $match: { serverTs: { $gte: from }, name: { $in: ["page_view", "read_progress", "read_complete"] } } },
      {
        $project: {
          page: "$page.path",
          session: "$session",
          type: "$name",
          milestone: {
            $cond: [
              { $eq: ["$name", "page_view"] },
              0,
              { $cond: [{ $eq: ["$name", "read_complete"] }, 100, { $ifNull: ["$data.progress", null] }] },
            ],
          },
        },
      },
      { $match: { milestone: { $in: [0, 25, 50, 75, 100] } } },
      { $group: { _id: { page: "$page", session: "$session", m: "$milestone" } } },
      {
        $group: {
          _id: "$_id.page",
          uniqueViews: { $sum: { $cond: [{ $eq: ["$_id.m", 0] }, 1, 0] } },
          p25: { $sum: { $cond: [{ $eq: ["$_id.m", 25] }, 1, 0] } },
          p50: { $sum: { $cond: [{ $eq: ["$_id.m", 50] }, 1, 0] } },
          p75: { $sum: { $cond: [{ $eq: ["$_id.m", 75] }, 1, 0] } },
          p100: { $sum: { $cond: [{ $eq: ["$_id.m", 100] }, 1, 0] } },
        },
      },
      {
        $project: {
          _id: 0,
          path: "$_id",
          uniqueViews: 1,
          p25: 1,
          p50: 1,
          p75: 1,
          p100: 1,
          completionRate: { $cond: [{ $gt: ["$uniqueViews", 0] }, { $divide: ["$p100", "$uniqueViews"] }, 0] },
        },
      },
      { $sort: { uniqueViews: -1 } },
      { $limit: limit },
    ])
    .toArray();

  return rows.map((r) => ({
    path: r.path,
    uniqueViews: r.uniqueViews,
    p25: r.p25,
    p50: r.p50,
    p75: r.p75,
    p100: r.p100,
    completionRate: r.completionRate,
  }));
}

type TimeSeriesPoint = { label: string; views: number; sessions: number; completions: number };
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
      completions: { bucket: Date; count: number }[];
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
          completions: [
            { $match: { name: "read_complete" } },
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
  const compsMap = new Map<string, number>((result?.completions ?? []).map((r) => [toKeyString(new Date(r.bucket), unit), r.count]));
  const sessMap = new Map<string, number>((result?.sessions ?? []).map((r) => [toKeyString(new Date(r.bucket), unit), r.count]));

  return keys.map((label) => ({
    label,
    views: viewsMap.get(label) ?? 0,
    sessions: sessMap.get(label) ?? 0,
    completions: compsMap.get(label) ?? 0,
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

  const [summary, device, topPages, series, progress, topProgress] = await Promise.all([
    getSummary(from),
    getDeviceBreakdown(from),
    getTopPages(from, 10),
    getTimeSeries(from, range === "24h" ? "hour" : "day"),
    getProgressSummary(from),
    getTopPagesProgress(from, 8),
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

      <section className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
          <div className="text-xs text-zinc-400">Page views</div>
          <div className="mt-2 text-3xl font-semibold">{summary.pageViews}</div>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
          <div className="text-xs text-zinc-400">Sessões únicas</div>
          <div className="mt-2 text-3xl font-semibold">{summary.uniqueSessions}</div>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
          <div className="text-xs text-zinc-400">Leituras completas</div>
          <div className="mt-2 text-3xl font-semibold">{summary.readCompletions}</div>
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
            <table className="min-w-full text-left text-sm">
              <thead className="bg-zinc-900/40 text-zinc-400">
                <tr>
                  <th className="px-4 py-2 font-medium">Página</th>
                  <th className="px-4 py-2 font-medium text-right">Views</th>
                  <th className="px-4 py-2 font-medium text-right">Completos</th>
                  <th className="px-4 py-2 font-medium text-right">%</th>
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
                      <td className="px-4 py-2 text-right tabular-nums">{row.views}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{row.completions}</td>
                      <td className="px-4 py-2 text-right tabular-nums">
                        {Math.round(row.completionRate * 100)}%
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-zinc-400">
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

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3 mb-3">
            <h2 className="text-sm font-medium">Funnel de leitura (único sessão+pagina)</h2>
            <span className="text-xs text-zinc-400">Período: {range}</span>
          </div>
          <div className="grid grid-cols-5 gap-3">
            {[
              { label: "Views", value: progress.uniqueViews },
              { label: "25%", value: progress.p25, rate: progress.uniqueViews ? progress.p25 / progress.uniqueViews : 0 },
              { label: "50%", value: progress.p50, rate: progress.uniqueViews ? progress.p50 / progress.uniqueViews : 0 },
              { label: "75%", value: progress.p75, rate: progress.uniqueViews ? progress.p75 / progress.uniqueViews : 0 },
              { label: "100%", value: progress.p100, rate: progress.uniqueViews ? progress.p100 / progress.uniqueViews : 0 },
            ].map((it, idx) => (
              <div key={`${it.label}-${idx}`} className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
                <div className="text-xs text-zinc-400">{it.label}</div>
                <div className="mt-1 text-xl font-semibold tabular-nums">{it.value}</div>
                {typeof it.rate === "number" && idx > 0 && (
                  <div className="text-xs text-zinc-400">{Math.round(it.rate * 100)}%</div>
                )}
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60">
          <div className="flex items-center justify-between border-b border-zinc-800 p-4">
            <h2 className="text-sm font-medium">Top páginas — progresso de leitura</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-zinc-900/40 text-zinc-400">
                <tr>
                  <th className="px-4 py-2 font-medium">Página</th>
                  <th className="px-4 py-2 font-medium text-right">Views*</th>
                  <th className="px-4 py-2 font-medium text-right">25%</th>
                  <th className="px-4 py-2 font-medium text-right">50%</th>
                  <th className="px-4 py-2 font-medium text-right">75%</th>
                  <th className="px-4 py-2 font-medium text-right">100%</th>
                  <th className="px-4 py-2 font-medium text-right">Compl. %</th>
                </tr>
              </thead>
              <tbody>
                {topProgress.length > 0 ? (
                  topProgress.map((row) => (
                    <tr key={`progress-${row.path}`} className="border-t border-zinc-800">
                      <td className="px-4 py-2">
                        <Link href={row.path} className="text-zinc-100 hover:underline">
                          {row.path}
                        </Link>
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums">{row.uniqueViews}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{row.p25}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{row.p50}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{row.p75}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{row.p100}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{Math.round((row.completionRate || 0) * 100)}%</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-zinc-400">
                      Nenhum dado no período.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            <div className="px-4 py-2 text-xs text-zinc-500">* Views únicos por sessão e página.</div>
          </div>
        </div>
      </section>
    </div>
  );
}

export const runtime = "nodejs";

