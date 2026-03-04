"use client";

import { useEffect, useRef } from "react";
import { useAnalytics } from "./AnalyticsProvider";

const SECTIONS = 10;
const TICK_MS = 1000;
const CAP_SECONDS = 120;

export default function SectionAttentionTracker({ postId }: { postId: string }) {
  const { trackEvent } = useAnalytics();
  const secondsRef = useRef<number[]>(new Array(SECTIONS).fill(0));
  const flushedRef = useRef<number[]>(new Array(SECTIONS).fill(0));
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    secondsRef.current = new Array(SECTIONS).fill(0);
    flushedRef.current = new Array(SECTIONS).fill(0);

    const getCurrentSection = (): number | null => {
      const content = document.querySelector<HTMLElement>("[data-post-content]");
      if (!content) return null;

      const rect = content.getBoundingClientRect();
      const contentH = content.offsetHeight;
      if (contentH === 0) return null;

      const centerInContent = -rect.top + window.innerHeight / 2;
      if (centerInContent < 0 || centerInContent > contentH) return null;

      const section = Math.min(SECTIONS - 1, Math.floor((centerInContent / contentH) * SECTIONS));
      return section;
    };

    tickRef.current = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      const section = getCurrentSection();
      if (section === null) return;
      if (secondsRef.current[section] < CAP_SECONDS) {
        secondsRef.current[section] += 1;
      }
    }, TICK_MS);

    const flush = () => {
      secondsRef.current.forEach((total, i) => {
        const delta = total - flushedRef.current[i];
        if (delta > 0) {
          trackEvent("section_attention", {
            postId,
            section: i,
            seconds: delta,
          });
          flushedRef.current[i] = total;
        }
      });
    };

    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", flush);

    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, [postId, trackEvent]);

  return null;
}
