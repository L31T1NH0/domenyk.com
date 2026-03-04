"use client";

import { useEffect } from "react";

type Bucket = { section: number; totalSeconds: number };

function buildGradient(buckets: Bucket[]): string {
  const max = Math.max(...buckets.map((b) => b.totalSeconds), 1);
  const stops = buckets.map((b, i) => {
    const opacity = 0.15 + (b.totalSeconds / max) * 0.75;
    const from = `${i * 10}%`;
    const to = `${(i + 1) * 10}%`;
    return `rgba(224, 0, 112, ${opacity.toFixed(3)}) ${from},
            rgba(224, 0, 112, ${opacity.toFixed(3)}) ${to}`;
  });

  return `linear-gradient(to right, ${stops.join(", ")})`;
}

export default function HeatmapProgressBar({ postId }: { postId: string }) {
  useEffect(() => {
    let cancelled = false;

    fetch(`/api/posts/${encodeURIComponent(postId)}/attention-heatmap`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (!data.available) return;

        const gradient = buildGradient(data.buckets);
        document.documentElement.style.setProperty("--scroll-heatmap-gradient", gradient);
        document.documentElement.style.setProperty("--scroll-heatmap-visible", "1");
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      document.documentElement.style.setProperty("--scroll-heatmap-visible", "0");
    };
  }, [postId]);

  return null;
}
