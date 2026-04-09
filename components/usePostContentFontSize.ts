import { useEffect, useRef, useState, type RefObject } from "react";
import { prepare, layout } from "@chenglou/pretext";

type Options = {
  minSize?: number;
  maxSize?: number;
  maxLinesPerParagraph?: number;
};

type PreparedParagraph = {
  text: string;
  lineHeightRatio: number;
  getPrepared: (fontSize: number) => ReturnType<typeof prepare>;
};

function getLineHeightRatio(style: CSSStyleDeclaration, fallbackFontSize: number) {
  const lineHeight = Number.parseFloat(style.lineHeight);
  if (Number.isFinite(lineHeight) && fallbackFontSize > 0) {
    return lineHeight / fallbackFontSize;
  }

  return 1.625;
}

function buildFont(style: CSSStyleDeclaration, fontSize: number) {
  const fontStyle = style.fontStyle || "normal";
  const fontVariant = style.fontVariant || "normal";
  const fontWeight = style.fontWeight || "400";
  const fontStretch = style.fontStretch || "normal";
  const fontFamily = style.fontFamily || "PolySans";

  return `${fontStyle} ${fontVariant} ${fontWeight} ${fontStretch} ${fontSize}px ${fontFamily}`;
}

export function usePostContentFontSize(
  containerRef: RefObject<HTMLElement | null>,
  options: Options = {}
): number {
  const { minSize = 12, maxSize = 18, maxLinesPerParagraph = 6 } = options;

  const [fontSize, setFontSize] = useState(maxSize);
  const preparedCacheRef = useRef<Map<string, ReturnType<typeof prepare>>>(new Map());

  useEffect(() => {
    let cancelled = false;

    const measure = () => {
      const container = containerRef.current;
      const width = container?.clientWidth ?? 0;
      if (!container || !width || cancelled) return;

      const paragraphElements = Array.from(container.querySelectorAll<HTMLParagraphElement>("p"));
      const preparedParagraphs: PreparedParagraph[] = paragraphElements
        .map((paragraph) => {
          const text = paragraph.textContent?.replace(/\s+/g, " ").trim() ?? "";
          if (!text) return null;

          const style = window.getComputedStyle(paragraph);
          const baseFontSize = Number.parseFloat(style.fontSize) || maxSize;
          const lineHeightRatio = getLineHeightRatio(style, baseFontSize);

          return {
            text,
            lineHeightRatio,
            getPrepared(nextFontSize: number) {
              const font = buildFont(style, nextFontSize);
              const cacheKey = `${font}__${text}`;
              const cached = preparedCacheRef.current.get(cacheKey);
              if (cached) return cached;

              const prepared = prepare(text, font);
              preparedCacheRef.current.set(cacheKey, prepared);
              return prepared;
            },
          };
        })
        .filter((paragraph): paragraph is PreparedParagraph => paragraph !== null);

      if (!preparedParagraphs.length) return;

      let lo = minSize;
      let hi = maxSize;
      let optimal = minSize;

      while (lo <= hi) {
        const mid = Math.floor((lo + hi) / 2);

        let totalLines = 0;
        for (const paragraph of preparedParagraphs) {
          const prepared = paragraph.getPrepared(mid);
          const lineHeight = mid * paragraph.lineHeightRatio;
          const { lineCount } = layout(prepared, width, lineHeight);
          totalLines += lineCount;
        }
        const avg = totalLines / preparedParagraphs.length;

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

    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(container);

    const mutationObserver = new MutationObserver(measure);
    mutationObserver.observe(container, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    return () => {
      cancelled = true;
      resizeObserver.disconnect();
      mutationObserver.disconnect();
    };
  }, [containerRef, minSize, maxSize, maxLinesPerParagraph]);

  return fontSize;
}
