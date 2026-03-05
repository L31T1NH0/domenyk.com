import { useEffect, useState } from "react";

function formatSeconds(seconds: number): string {
  if (seconds < 60) return "menos de 1 min";
  const minutes = Math.round(seconds / 60);
  return `${minutes} min`;
}

export function useRealReadingTime(
  postId: string,
  estimatedReadingTime: string
): string {
  const [readingTime, setReadingTime] = useState(estimatedReadingTime);

  useEffect(() => {
    let cancelled = false;

    fetch(`/api/posts/${encodeURIComponent(postId)}/reading-time`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data.available && data.totalSeconds > 0) {
          setReadingTime(formatSeconds(data.totalSeconds));
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [postId]);

  return readingTime;
}
