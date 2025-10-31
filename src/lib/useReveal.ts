"use client";

import { useEffect, useRef } from "react";

type UseRevealOptions = {
  once?: boolean;
  rootMargin?: string;
  threshold?: number;
};

export function useReveal<T extends HTMLElement>(
  { once = true, rootMargin = "0px", threshold = 0.1 }: UseRevealOptions = {}
) {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    if (typeof window === "undefined") return;

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    const element = ref.current;

    if (prefersReducedMotion) {
      element.classList.add("reveal-visible");
      element.classList.remove("reveal-init");
      return;
    }

    element.classList.add("reveal-init");

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting || entry.intersectionRatio > 0) {
            entry.target.classList.add("reveal-visible");
            entry.target.classList.remove("reveal-init");
            if (once) {
              observer.unobserve(entry.target);
            }
          }
        });
      },
      { rootMargin, threshold }
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [once, rootMargin, threshold]);

  return ref;
}
