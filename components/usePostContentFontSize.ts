import { useEffect, useState, type RefObject } from "react";
import { prepare, layout } from "@chenglou/pretext";

export function usePostContentFontSize(
  paragraphTexts: string[],
  containerRef: RefObject<HTMLElement | null>,
  options: {
    minSize?: number;
    maxSize?: number;
    fontFamily?: string;
    lineHeightRatio?: number;
    maxLinesPerParagraph?: number;
  } = {}
): number {
  const {
    minSize = 14,
    maxSize = 18,
    fontFamily = "PolySans",
    lineHeightRatio = 1.625,
    maxLinesPerParagraph = 6,
  } = options;

  const [fontSize, setFontSize] = useState(maxSize);

  useEffect(() => {
    let cancelled = false;
    const texts = paragraphTexts.filter(Boolean);
    if (!texts.length) return;

    const measure = () => {
      const width = containerRef.current?.clientWidth ?? 0;
      if (!width || cancelled) return;

      let lo = minSize;
      let hi = maxSize;
      let optimal = minSize;

      while (lo <= hi) {
        const mid = Math.floor((lo + hi) / 2);
        const font = `${mid}px ${fontFamily}`;
        const lh = mid * lineHeightRatio;

        let totalLines = 0;
        for (const text of texts) {
          const prepared = prepare(text, font);
          const { lineCount } = layout(prepared, width, lh);
          totalLines += lineCount;
        }
        const avg = totalLines / texts.length;

        if (avg <= maxLinesPerParagraph) {
          optimal = mid;
          lo = mid + 1;
        } else {
          hi = mid - 1;
        }
      }

      if (!cancelled) setFontSize(optimal);
    };

    document.fonts.ready.then(measure);

    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => {
      cancelled = true;
      ro.disconnect();
    };
  }, [paragraphTexts, minSize, maxSize, fontFamily, lineHeightRatio, maxLinesPerParagraph]);

  return fontSize;
}
