import { useEffect, useState } from "react";

export type HeadingEntry = {
  id: string;
  text: string;
  level: number;
  element: HTMLHeadingElement;
};

type UseHeadingsMapOptions = {
  enabled?: boolean;
  dependencies?: ReadonlyArray<unknown>;
};

function slugifyHeading(text: string): string {
  const normalized = text
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  const cleaned = normalized.replace(/[^a-z0-9\s-]/g, " ");
  const collapsed = cleaned.trim().replace(/\s+/g, "-");

  return collapsed.length > 0 ? collapsed : "heading";
}

export function useHeadingsMap({
  enabled = true,
  dependencies = [],
}: UseHeadingsMapOptions = {}): HeadingEntry[] {
  const [headings, setHeadings] = useState<HeadingEntry[]>([]);

  useEffect(() => {
    if (!enabled) {
      setHeadings([]);
      return;
    }

    if (typeof document === "undefined") {
      return;
    }

    const nodes = Array.from(document.querySelectorAll("h4"));
    const slugCounts = new Map<string, number>();

    const nextHeadings = nodes.map((node) => {
      const element = node as HTMLHeadingElement;
      const text = element.textContent?.trim() ?? "";

      let identifier = element.id?.trim() ?? "";
      if (!identifier) {
        const base = slugifyHeading(text);
        const currentCount = slugCounts.get(base) ?? 0;
        slugCounts.set(base, currentCount + 1);
        identifier = currentCount === 0 ? base : `${base}-${currentCount}`;
      }

      return {
        id: identifier,
        text,
        level: 4,
        element,
      } satisfies HeadingEntry;
    });

    setHeadings(nextHeadings);
  }, [enabled, ...dependencies]);

  return headings;
}
