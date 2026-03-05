import { useCallback, useEffect, useRef, useState } from "react";

export type Highlight = {
  _id: string;
  postId: string;
  paragraphId: string;
  userId: string;
  authorName: string;
  selectedText: string;
  startOffset: number;
  endOffset: number;
  createdAt: string;
};

export function useHighlights(postId: string) {
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const loaded = useRef(false);

  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;

    fetch(`/api/posts/${encodeURIComponent(postId)}/paragraph-highlights`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setHighlights(data);
      })
      .catch(() => {});
  }, [postId]);

  const addHighlight = useCallback((h: Highlight) => {
    setHighlights((prev) => {
      const filtered = prev.filter(
        (p) => !(p.userId === h.userId && p.paragraphId === h.paragraphId)
      );
      return [...filtered, h];
    });
  }, []);

  const removeHighlight = useCallback((highlightId: string) => {
    setHighlights((prev) => prev.filter((h) => h._id !== highlightId));
  }, []);

  return { highlights, addHighlight, removeHighlight };
}
