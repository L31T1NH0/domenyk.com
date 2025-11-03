import { notFound } from "next/navigation";
import Link from "next/link";
import type { Db } from "mongodb";

import { getMongoDb } from "@lib/mongo";
import { resolveAdminStatus } from "@lib/admin";
import { ANALYTICS_COLLECTIONS } from "@lib/analytics/persistence";
import { refreshAnalyticsRollups } from "@lib/analytics/rollups";

type RangeKey = "24h" | "7d" | "30d";

const FUNNEL_BUCKETS = Array.from({ length: 21 }, (_, i) => i * 5);
const MAX_SESSION_ACTIVE_MS = 2 * 60 * 60 * 1000;

type Summary = {
  pageViews: number;
  sessions: number;
  completions: number;
  completionRate: number;
  avgMs: number;
  medianMs: number;
  p95Ms: number;
  funnel: Record<number, number>;
};

function createEmptySummary(): Summary {
  const funnel: Record<number, number> = {};
  for (const bucket of FUNNEL_BUCKETS) {
    funnel[bucket] = 0;
  }
  return {
    pageViews: 0,
    sessions: 0,
    completions: 0,
    completionRate: 0,
    avgMs: 0,
    medianMs: 0,
    p95Ms: 0,
    funnel,
  };
}

type ReferrerRow = {
  referrer: string | null;
  views: number;
  sessions: number;
  share: number;
};

type DeviceRow = {
  deviceType: string;
  os: string;
  browser: string;
  views: number;
  sessions: number;
  share: number;
};

type TopPageRow = {
  path: string;
  views: number;
  sessions: number;
  completionRate: number;
};

type PageFunnelRow = {
  path: string;
  sessions: number;
  funnel: Record<number, number>;
  completionRate: number;
};

type TimeSeriesPoint = { label: string; views: number; sessions: number };

type RangeBounds = {
  from: Date;
  to: Date;
  dayStart: Date;
  dayEnd: Date;
};

function parseRange(input: unknown): RangeKey {
  const value = typeof input === "string" ? input.toLowerCase() : "";
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

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function addUtcDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function enumerateDays(start: Date, end: Date): Date[] {
  const days: Date[] = [];
  for (let cursor = new Date(start); cursor <= end; cursor = addUtcDays(cursor, 1)) {
    days.push(new Date(cursor));
  }
  return days;
}

function computePercentile(sorted: number[], percentile: number): number {
  if (sorted.length === 0) {
    return 0;
  }
  if (sorted.length === 1) {
    return sorted[0];
  }
  const position = (sorted.length - 1) * percentile;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  const weight = position - lower;
  if (upper >= sorted.length) {
    return sorted[sorted.length - 1];
  }
  if (lower === upper) {
    return sorted[lower];
  }
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) {
    return "0s";
  }
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const remMinutes = minutes % 60;
    return `${hours}h ${remMinutes}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}

function getRangeBounds(range: RangeKey): RangeBounds {
  const from = getFromDate(range);
  const to = new Date();
  const dayStart = startOfUtcDay(from);
  const dayEnd = startOfUtcDay(to);
  return { from, to, dayStart, dayEnd };
}

async function getSummary(db: Db, bounds: RangeBounds): Promise<Summary> {
  const readState = db.collection(ANALYTICS_COLLECTIONS.readState);
  const states = await readState
    .find(
      { lastAt: { $gte: bounds.from, $lt: bounds.to } },
      { projection: { progress_max: 1, time_active_ms: 1 } }
    )
    .toArray();

  const sessions = states.length;
  const times: number[] = [];
  let completions = 0;
  const funnelCounts = new Map<number, number>();
  for (const bucket of FUNNEL_BUCKETS) {
    funnelCounts.set(bucket, 0);
  }

  for (const state of states) {
    const progress = Math.max(0, Math.min(100, Math.round((state as any).progress_max ?? 0)));
    if (progress >= 100) {
      completions += 1;
    }
    for (const bucket of FUNNEL_BUCKETS) {
      if (progress >= bucket) {
        funnelCounts.set(bucket, (funnelCounts.get(bucket) ?? 0) + 1);
      }
    }
    const timeMs = Math.max(
      0,
      Math.min(
        MAX_SESSION_ACTIVE_MS,
        Math.round((state as any).time_active_ms ?? 0)
      )
    );
    times.push(timeMs);
  }

  const totalTime = times.reduce((acc, value) => acc + value, 0);
  const sortedTimes = times.slice().sort((a, b) => a - b);
  const avgMs = sessions > 0 ? totalTime / sessions : 0;
  const medianMs = computePercentile(sortedTimes, 0.5);
  const p95Ms = computePercentile(sortedTimes, 0.95);

  const funnel: Record<number, number> = {};
  for (const bucket of FUNNEL_BUCKETS) {
    funnel[bucket] = funnelCounts.get(bucket) ?? 0;
  }

  const pageRollups = db.collection(ANALYTICS_COLLECTIONS.pageRollups);
  const [viewsAgg] = await pageRollups
    .aggregate<{ views: number }>([
      { $match: { day: { $gte: bounds.dayStart, $lte: bounds.dayEnd } } },
      { $group: { _id: null, views: { $sum: "$views" } } },
      { $project: { _id: 0, views: 1 } },
    ])
    .toArray();

  return {
    pageViews: viewsAgg?.views ?? 0,
    sessions,
    completions,
    completionRate: sessions > 0 ? completions / sessions : 0,
    avgMs,
    medianMs,
    p95Ms,
    funnel,
  };
}

async function getTopReferrers(
  db: Db,
  bounds: RangeBounds,
  limit = 10
): Promise<ReferrerRow[]> {
  const referrers = db.collection(ANALYTICS_COLLECTIONS.referrerRollups);
  const rows = await referrers
    .aggregate<ReferrerRow & { _id: string | null }>([
      { $match: { day: { $gte: bounds.dayStart, $lte: bounds.dayEnd } } },
      {
        $group: {
          _id: "$referrer",
          views: { $sum: "$views" },
          sessions: { $sum: "$sessions" },
        },
      },
      { $sort: { views: -1 } },
      { $limit: limit },
    ])
    .toArray();

  const totalViews = rows.reduce((acc, row) => acc + row.views, 0);

  return rows.map((row) => ({
    referrer: row._id ?? null,
    views: row.views,
    sessions: row.sessions,
    share: totalViews > 0 ? row.views / totalViews : 0,
  }));
}

async function getDeviceBreakdown(
  db: Db,
  bounds: RangeBounds
): Promise<DeviceRow[]> {
  const uaRollups = db.collection(ANALYTICS_COLLECTIONS.uaRollups);
  const rows = await uaRollups
    .aggregate<{
      _id: { deviceType: string; os: string; browser: string };
      views: number;
      sessions: number;
    }>([
      { $match: { day: { $gte: bounds.dayStart, $lte: bounds.dayEnd } } },
      {
        $group: {
          _id: {
            deviceType: "$deviceType",
            os: "$os",
            browser: "$browser",
          },
          views: { $sum: "$views" },
          sessions: { $sum: "$sessions" },
        },
      },
      { $sort: { sessions: -1 } },
    ])
    .toArray();

  const totalSessions = rows.reduce((acc, row) => acc + row.sessions, 0);

  return rows.map((row) => ({
    deviceType: row._id.deviceType ?? "unknown",
    os: row._id.os ?? "unknown",
    browser: row._id.browser ?? "unknown",
    views: row.views,
    sessions: row.sessions,
    share: totalSessions > 0 ? row.sessions / totalSessions : 0,
  }));
}

async function getTopPages(
  db: Db,
  bounds: RangeBounds,
  limit = 10
): Promise<TopPageRow[]> {
  const pageRollups = db.collection(ANALYTICS_COLLECTIONS.pageRollups);
  const rows = await pageRollups
    .aggregate<{
      _id: string;
      views: number;
      sessions: number;
      completions: number;
    }>([
      { $match: { day: { $gte: bounds.dayStart, $lte: bounds.dayEnd } } },
      {
        $group: {
          _id: "$path",
          views: { $sum: "$views" },
          sessions: { $sum: "$sessions" },
          completions: { $sum: { $ifNull: ["$funnel.b100", 0] } },
        },
      },
      { $sort: { views: -1 } },
      { $limit: limit },
    ])
    .toArray();

  return rows.map((row) => ({
    path: row._id,
    views: row.views,
    sessions: row.sessions,
    completionRate: row.sessions > 0 ? row.completions / row.sessions : 0,
  }));
}

async function getTopPagesFunnels(
  db: Db,
  bounds: RangeBounds,
  limit = 8
): Promise<PageFunnelRow[]> {
  const pageRollups = db.collection(ANALYTICS_COLLECTIONS.pageRollups);
  const groupStage: Record<string, unknown> = {
    _id: "$path",
    sessions: { $sum: "$sessions" },
  };
  for (const bucket of FUNNEL_BUCKETS) {
    groupStage[`b${bucket}`] = {
      $sum: { $ifNull: [`$funnel.b${bucket}`, 0] },
    };
  }

  const rows = await pageRollups
    .aggregate<({ _id: string; sessions: number } & Record<string, number>)>([
      { $match: { day: { $gte: bounds.dayStart, $lte: bounds.dayEnd } } },
      { $group: groupStage },
      { $sort: { sessions: -1 } },
      { $limit: limit },
    ])
    .toArray();

  return rows.map((row) => {
    const funnel: Record<number, number> = {};
    for (const bucket of FUNNEL_BUCKETS) {
      funnel[bucket] = Number(row[`b${bucket}`] ?? 0);
    }
    const sessions = Number(row.sessions ?? 0);
    return {
      path: String(row._id ?? "/"),
      sessions,
      funnel,
      completionRate: sessions > 0 ? (funnel[100] ?? 0) / sessions : 0,
    };
  });
}

async function getTimeSeries(db: Db, bounds: RangeBounds): Promise<TimeSeriesPoint[]> {
  const pageRollups = db.collection(ANALYTICS_COLLECTIONS.pageRollups);
  const docs = await pageRollups
    .find({ day: { $gte: bounds.dayStart, $lte: bounds.dayEnd } })
    .toArray();

  const map = new Map<string, { views: number; sessions: number }>();
  for (const doc of docs) {
    const label = startOfUtcDay(doc.day).toISOString().slice(0, 10);
    const entry = map.get(label) ?? { views: 0, sessions: 0 };
    entry.views += (doc as any).views ?? 0;
    entry.sessions += (doc as any).sessions ?? 0;
    map.set(label, entry);
  }

  const labels = enumerateDays(bounds.dayStart, bounds.dayEnd).map((day) =>
    day.toISOString().slice(0, 10)
  );

  return labels.map((label) => {
    const entry = map.get(label) ?? { views: 0, sessions: 0 };
    return {
      label,
      views: entry.views,
      sessions: entry.sessions,
    };
  });
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

  const toPolyline = (values: number[]) =>
    values.map((v, i) => `${scaleX(i)},${scaleY(v)}`).join(" ");

  const views = points.map((p) => p.views);
  const sessions = points.map((p) => p.sessions);

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
      <rect x={0} y={0} width={width} height={height} fill="none" />
      <line x1={pad} y1={height - pad} x2={width - pad} y2={height - pad} stroke="#3f3f46" strokeWidth={1} />
      <polyline fill="none" stroke="#60a5fa" strokeWidth={2} points={toPolyline(views)} />
      <polyline fill="none" stroke="#4ade80" strokeWidth={2} points={toPolyline(sessions)} />
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
  const bounds = getRangeBounds(range);

  const shouldSkipAnalytics =
    process.env.CI === "1" || process.env.NEXT_PHASE === "phase-production-build";

  let summary: Summary = createEmptySummary();
  let referrers: ReferrerRow[] = [];
  let devices: DeviceRow[] = [];
  let topPages: TopPageRow[] = [];
  let funnels: PageFunnelRow[] = [];
  let series: TimeSeriesPoint[] = [];
  let loadError: string | null = null;

  if (shouldSkipAnalytics) {
    loadError = "Analytics desabilitado durante builds/CI.";
  } else {
    try {
      const db = await getMongoDb();
      await refreshAnalyticsRollups(db, { from: bounds.from, to: bounds.to });

      const results = await Promise.all([
        getSummary(db, bounds),
        getTopReferrers(db, bounds, 10),
        getDeviceBreakdown(db, bounds),
        getTopPages(db, bounds, 10),
        getTopPagesFunnels(db, bounds, 8),
        getTimeSeries(db, bounds),
      ]);

      summary = results[0];
      referrers = results[1];
      devices = results[2];
      topPages = results[3];
      funnels = results[4];
      series = results[5];
    } catch (error) {
      console.error("Falha ao carregar analytics do MongoDB:", error);
      loadError =
        error instanceof Error
          ? error.message
          : "Não foi possível conectar ao MongoDB para carregar métricas.";
    }
  }

  const funnelRows = FUNNEL_BUCKETS.map((bucket) => {
    const count = summary.funnel[bucket] ?? 0;
    return {
      bucket,
      count,
      rate: summary.sessions > 0 ? count / summary.sessions : 0,
    };
  });

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
          <p className="text-sm text-zinc-400">Leituras, origens e engajamento real.</p>
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

      {loadError && (
        <div className="rounded-lg border border-amber-700/40 bg-amber-900/20 p-3 text-sm text-amber-200">
          {loadError}
        </div>
      )}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
          <div className="text-xs text-zinc-400">Page views</div>
          <div className="mt-2 text-3xl font-semibold tabular-nums">{summary.pageViews}</div>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
          <div className="text-xs text-zinc-400">Sessões únicas</div>
          <div className="mt-2 text-3xl font-semibold tabular-nums">{summary.sessions}</div>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
          <div className="text-xs text-zinc-400">Completion rate</div>
          <div className="mt-2 text-3xl font-semibold tabular-nums">
            {Math.round(summary.completionRate * 100)}%
          </div>
          <div className="text-xs text-zinc-500">{summary.completions} leituras completas</div>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
          <div className="text-xs text-zinc-400">Tempo ativo médio</div>
          <div className="mt-2 text-3xl font-semibold tabular-nums">
            {formatDuration(summary.avgMs)}
          </div>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
          <div className="text-xs text-zinc-400">Tempo mediano</div>
          <div className="mt-2 text-3xl font-semibold tabular-nums">
            {formatDuration(summary.medianMs)}
          </div>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
          <div className="text-xs text-zinc-400">Tempo p95</div>
          <div className="mt-2 text-3xl font-semibold tabular-nums">
            {formatDuration(summary.p95Ms)}
          </div>
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
                  <th className="px-4 py-2 font-medium text-right">Sessões</th>
                  <th className="px-4 py-2 font-medium text-right">Compl. %</th>
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
                      <td className="px-4 py-2 text-right tabular-nums">{row.sessions}</td>
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
            <h2 className="text-sm font-medium">Top referrers</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-zinc-900/40 text-zinc-400">
                <tr>
                  <th className="px-4 py-2 font-medium">Origem</th>
                  <th className="px-4 py-2 font-medium text-right">Views</th>
                  <th className="px-4 py-2 font-medium text-right">Sessões</th>
                  <th className="px-4 py-2 font-medium text-right">%</th>
                </tr>
              </thead>
              <tbody>
                {referrers.length > 0 ? (
                  referrers.map((row, idx) => (
                    <tr key={`${row.referrer ?? "direct"}-${idx}`} className="border-t border-zinc-800">
                      <td className="px-4 py-2">
                        {row.referrer ? row.referrer : <span className="text-zinc-400">(direto)</span>}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums">{row.views}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{row.sessions}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{Math.round(row.share * 100)}%</td>
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
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60">
          <div className="flex items-center justify-between border-b border-zinc-800 p-4">
            <h2 className="text-sm font-medium">Dispositivo / SO / Browser</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-zinc-900/40 text-zinc-400">
                <tr>
                  <th className="px-4 py-2 font-medium">Dispositivo</th>
                  <th className="px-4 py-2 font-medium">SO</th>
                  <th className="px-4 py-2 font-medium">Browser</th>
                  <th className="px-4 py-2 font-medium text-right">Sessões</th>
                  <th className="px-4 py-2 font-medium text-right">%</th>
                </tr>
              </thead>
              <tbody>
                {devices.length > 0 ? (
                  devices.map((row, idx) => (
                    <tr key={`${row.deviceType}-${row.os}-${row.browser}-${idx}`} className="border-t border-zinc-800">
                      <td className="px-4 py-2 capitalize">{row.deviceType}</td>
                      <td className="px-4 py-2">{row.os}</td>
                      <td className="px-4 py-2">{row.browser}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{row.sessions}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{Math.round(row.share * 100)}%</td>
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
            <h2 className="text-sm font-medium">Funil de leitura (sessões)</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-zinc-900/40 text-zinc-400">
                <tr>
                  <th className="px-4 py-2 font-medium">Bucket</th>
                  <th className="px-4 py-2 font-medium text-right">Sessões</th>
                  <th className="px-4 py-2 font-medium text-right">%</th>
                </tr>
              </thead>
              <tbody>
                {funnelRows.map((row) => (
                  <tr key={`funnel-${row.bucket}`} className="border-t border-zinc-800">
                    <td className="px-4 py-2">{row.bucket}%</td>
                    <td className="px-4 py-2 text-right tabular-nums">{row.count}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{Math.round(row.rate * 100)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-zinc-800 bg-zinc-900/60">
        <div className="flex items-center justify-between border-b border-zinc-800 p-4">
          <h2 className="text-sm font-medium">Top páginas — progresso (buckets de 5%)</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-zinc-900/40 text-zinc-400">
              <tr>
                <th className="px-4 py-2 font-medium">Página</th>
                <th className="px-4 py-2 font-medium text-right">Sessões</th>
                {FUNNEL_BUCKETS.map((bucket) => (
                  <th key={`head-${bucket}`} className="px-4 py-2 font-medium text-right">
                    {bucket}%
                  </th>
                ))}
                <th className="px-4 py-2 font-medium text-right">Compl. %</th>
              </tr>
            </thead>
            <tbody>
              {funnels.length > 0 ? (
                funnels.map((row) => (
                  <tr key={`funnel-${row.path}`} className="border-t border-zinc-800">
                    <td className="px-4 py-2 min-w-[160px]">
                      <Link href={row.path} className="text-zinc-100 hover:underline">
                        {row.path}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">{row.sessions}</td>
                    {FUNNEL_BUCKETS.map((bucket) => (
                      <td key={`${row.path}-b${bucket}`} className="px-4 py-2 text-right tabular-nums">
                        {row.funnel[bucket] ?? 0}
                      </td>
                    ))}
                    <td className="px-4 py-2 text-right tabular-nums">
                      {Math.round(row.completionRate * 100)}%
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={FUNNEL_BUCKETS.length + 3} className="px-4 py-8 text-center text-zinc-400">
                    Nenhum dado no período.
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

export const runtime = "nodejs";
