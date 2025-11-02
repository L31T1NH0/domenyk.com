"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useIsMobile } from "src/app/posts/[id]/post-content-client";
import { useHeadingsMap } from "@components/useHeadingsMap";

export default function PostMinimap() {
  const isMobile = useIsMobile();
  const headings = useHeadingsMap({ enabled: !isMobile });
  const [activeId, setActiveId] = useState<string | null>(null);
  const [clickedId, setClickedId] = useState<string | null>(null);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    if (isMobile) {
      setPortalTarget(null);
      return;
    }

    const container = document.createElement("div");
    container.dataset.postMinimap = "true";
    document.body.appendChild(container);
    setPortalTarget(container);

    return () => {
      setPortalTarget((current) => (current === container ? null : current));
      document.body.removeChild(container);
    };
  }, [isMobile]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }

    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => setPrefersReducedMotion(mediaQuery.matches);

    updatePreference();
    mediaQuery.addEventListener?.("change", updatePreference);
    mediaQuery.addListener?.(updatePreference);

    return () => {
      mediaQuery.removeEventListener?.("change", updatePreference);
      mediaQuery.removeListener?.(updatePreference);
    };
  }, []);

  useEffect(() => {
    if (isMobile) {
      setActiveId(null);
      return;
    }

    if (headings.length === 0 || typeof window === "undefined") {
      return;
    }

    let frame: number | null = null;

    const updateActiveHeading = () => {
      frame = null;

      const focusLine = window.scrollY + window.innerHeight * 0.4;
      let nextActiveId: string | null = headings[0]?.id ?? null;

      for (const heading of headings) {
        const offsetTop = heading.element.offsetTop;
        if (offsetTop <= focusLine) {
          nextActiveId = heading.id;
        } else {
          break;
        }
      }

      if (nextActiveId !== null) {
        setActiveId((current) => (current === nextActiveId ? current : nextActiveId));
      }
    };

    const requestUpdate = () => {
      if (frame !== null) {
        return;
      }
      frame = window.requestAnimationFrame(updateActiveHeading);
    };

    requestUpdate();

    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", requestUpdate);

    return () => {
      if (frame !== null) {
        window.cancelAnimationFrame(frame);
      }
      window.removeEventListener("scroll", requestUpdate);
      window.removeEventListener("resize", requestUpdate);
    };
  }, [headings, isMobile]);

  useEffect(() => {
    if (isMobile || headings.length === 0) {
      return;
    }

    setActiveId((current) => current ?? headings[0]?.id ?? null);
  }, [headings, isMobile]);

  useEffect(() => {
    if (clickedId === null || prefersReducedMotion) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setClickedId(null);
    }, 220);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [clickedId, prefersReducedMotion]);

  const transitionClasses = useMemo(
    () => (prefersReducedMotion ? "" : "transition-all duration-200 ease-in-out"),
    [prefersReducedMotion],
  );

  if (isMobile || headings.length === 0 || portalTarget === null) {
    return null;
  }

  return createPortal(
    <aside
      className="hidden md:flex md:flex-col fixed top-24 right-4 w-60 max-h-[calc(100vh-6rem)] overflow-y-auto rounded-lg border border-zinc-200/80 bg-white/70 p-3 text-sm text-zinc-700 shadow-lg shadow-zinc-900/5 backdrop-blur dark:border-zinc-700/60 dark:bg-zinc-900/60 dark:text-zinc-300"
    >
      <span className="text-xs uppercase tracking-wide text-zinc-700 dark:text-zinc-300 mb-3">
        Neste artigo
      </span>
      <nav className="flex flex-col gap-1.5" aria-label="Mapa do post">
        {headings.map((heading) => {
          const isActive = heading.id === activeId;
          const isClicked = heading.id === clickedId && !prefersReducedMotion;

          return (
            <button
              key={heading.id}
              type="button"
              title={heading.text}
              className={[
                "text-left w-full rounded-md px-3 py-1.5 text-ellipsis whitespace-nowrap overflow-hidden",
                transitionClasses,
                isActive
                  ? "bg-zinc-200/70 text-zinc-900 dark:bg-zinc-800/60 dark:text-zinc-100"
                  : "hover:text-zinc-900 hover:bg-zinc-100/70 dark:hover:text-zinc-100 dark:hover:bg-zinc-800/40",
                !prefersReducedMotion ? "hover:text-[0.95rem]" : "",
                isClicked ? "ring-2 ring-zinc-300 dark:ring-zinc-600 scale-[1.02]" : "",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500",
              ]
                .filter(Boolean)
                .join(" ")}
              aria-current={isActive ? "true" : undefined}
              onMouseEnter={() => {
                if (prefersReducedMotion) {
                  return;
                }
                setClickedId(null);
              }}
              onClick={() => {
                const behavior = prefersReducedMotion ? "auto" : "smooth";
                heading.element.scrollIntoView({ behavior, block: "start" });
                if (!prefersReducedMotion) {
                  setClickedId(heading.id);
                }
              }}
            >
              {heading.text}
            </button>
          );
        })}
      </nav>
    </aside>,
    portalTarget,
  );
}
