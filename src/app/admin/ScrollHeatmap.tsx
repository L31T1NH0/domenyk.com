"use client";

import { useEffect, useState } from "react";

type HeatmapRow = { section: number; totalSeconds: number };

const SECTIONS = 10;

function fmt(s: number): string {
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m${s % 60 > 0 ? `${s % 60}s` : ""}`;
}

export default function ScrollHeatmap({ postId }: { postId: string }) {
  const [data, setData] = useState<HeatmapRow[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/admin/api/scroll-heatmap?postId=${encodeURIComponent(postId)}`)
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, [postId]);

  if (loading) {
    return <div className="text-xs text-zinc-500">Carregando heatmap...</div>;
  }

  if (!data || data.length === 0) {
    return <div className="text-xs text-zinc-500">Sem dados de atenção ainda.</div>;
  }

  const map = new Map(data.map((d) => [d.section, d.totalSeconds]));
  const max = Math.max(...Array.from(map.values()), 1);

  const width = 600;
  const height = 80;
  const padX = 24;
  const padY = 12;
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;

  const pts = Array.from({ length: SECTIONS }, (_, i) => {
    const x = padX + (i / (SECTIONS - 1)) * innerW;
    const y = padY + innerH - ((map.get(i) ?? 0) / max) * innerH;
    return { x, y, i };
  });

  const polyline = pts.map((p) => `${p.x},${p.y}`).join(" ");
  const area = [`${padX},${padY + innerH}`, ...pts.map((p) => `${p.x},${p.y}`), `${padX + innerW},${padY + innerH}`].join(" ");

  return (
    <div className="space-y-1">
      <div className="text-xs font-medium text-zinc-400">Atenção por seção do post</div>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
        <polyline fill="rgba(250,204,21,0.12)" stroke="none" points={area} />
        <polyline fill="none" stroke="#facc15" strokeWidth={2} strokeLinejoin="round" points={polyline} />
        {pts.map(({ x, y, i }) => {
          const s = map.get(i) ?? 0;
          return (
            <g key={i}>
              <circle cx={x} cy={y} r={3} fill="#facc15" />
              {s > 0 && (
                <text x={x} y={y - 5} textAnchor="middle" fontSize={8} fill="#a1a1aa">
                  {fmt(s)}
                </text>
              )}
              <text x={x} y={height - 1} textAnchor="middle" fontSize={9} fill="#52525b">
                {i * 10}%
              </text>
            </g>
          );
        })}
      </svg>
      <div className="flex justify-between text-[10px] text-zinc-600 px-1">
        <span>início</span>
        <span>fim</span>
      </div>
    </div>
  );
}
