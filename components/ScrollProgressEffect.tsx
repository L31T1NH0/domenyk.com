"use client";

import { useEffect } from "react";

function setScrollVariables(progress: number, visible: boolean) {
  const root = document.documentElement;
  const progressValue = visible
    ? `${(progress * 100).toFixed(3)}%`
    : "0%";
  root.style.setProperty("--scroll-progress", progressValue);
  root.style.setProperty("--scroll-progress-visible", visible ? "1" : "0");
}

export default function ScrollProgressEffect() {
  useEffect(() => {
    const container = document.querySelector<HTMLElement>(
      "[data-scroll-progress-root]"
    );

    if (!container) {
      setScrollVariables(0, false);
      return;
    }

    let animationFrame = 0;

    const update = () => {
      animationFrame = 0;
      const containerTop =
        container.getBoundingClientRect().top + window.scrollY;
      const scrollTop = Math.max(0, window.scrollY - containerTop);
      const totalScrollable = Math.max(
        container.scrollHeight - window.innerHeight,
        0
      );

      if (totalScrollable <= 0) {
        setScrollVariables(0, false);
        return;
      }

      const progress = Math.min(
        1,
        Math.max(0, scrollTop / totalScrollable)
      );

      setScrollVariables(progress, true);
    };

    const requestUpdate = () => {
      if (animationFrame) return;
      animationFrame = window.requestAnimationFrame(update);
    };

    update();
    if (document.readyState === "complete") {
      requestUpdate();
    }

    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", requestUpdate);
    window.addEventListener("load", requestUpdate);

    return () => {
      window.removeEventListener("scroll", requestUpdate);
      window.removeEventListener("resize", requestUpdate);
      window.removeEventListener("load", requestUpdate);
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
      setScrollVariables(0, false);
    };
  }, []);

  return null;
}
