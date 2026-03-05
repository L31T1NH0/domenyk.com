"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import type { Highlight } from "./useHighlights";

type Props = {
  paragraphId: string;
  postId: string;
  highlights: Highlight[];
  onHighlightSaved: (h: Highlight) => void;
  onHighlightDeleted: (id: string) => void;
  paragraphProps?: HTMLAttributes<HTMLElement>;
  children: ReactNode;
  userId: string | null | undefined;
};

type SelectionInfo = {
  selectedText: string;
  startOffset: number;
  endOffset: number;
  x: number;
  y: number;
};

export default function HighlightedParagraph({
  paragraphId,
  postId,
  highlights,
  onHighlightSaved,
  onHighlightDeleted,
  paragraphProps,
  children,
  userId,
}: Props) {
  const containerRef = useRef<HTMLSpanElement>(null);
  const [selection, setSelection] = useState<SelectionInfo | null>(null);
  const [saving, setSaving] = useState(false);
  const [myHighlight, setMyHighlight] = useState<Highlight | null>(null);

  useEffect(() => {
    const mine = highlights.find(
      (h) => h.paragraphId === paragraphId && h.userId === userId
    );
    setMyHighlight(mine ?? null);
  }, [highlights, paragraphId, userId]);

  const handleMouseUp = useCallback(() => {
    if (!userId) return;
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount) {
      setSelection(null);
      return;
    }

    const range = sel.getRangeAt(0);
    const container = containerRef.current;
    if (!container || !container.contains(range.commonAncestorContainer)) {
      setSelection(null);
      return;
    }

    const selectedText = sel.toString().trim();
    if (!selectedText) {
      setSelection(null);
      return;
    }

    const preRange = document.createRange();
    preRange.setStart(container, 0);
    preRange.setEnd(range.startContainer, range.startOffset);
    const startOffset = preRange.toString().length;
    const endOffset = startOffset + selectedText.length;

    const rect = range.getBoundingClientRect();
    setSelection({
      selectedText,
      startOffset,
      endOffset,
      x: rect.left + rect.width / 2,
      y: rect.top + window.scrollY - 8,
    });
  }, [userId]);

  const saveHighlight = useCallback(async () => {
    if (!selection || saving) return;
    setSaving(true);
    try {
      const res = await fetch(
        `/api/posts/${encodeURIComponent(postId)}/paragraph-highlights`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            paragraphId,
            selectedText: selection.selectedText,
            startOffset: selection.startOffset,
            endOffset: selection.endOffset,
          }),
        }
      );
      if (!res.ok) throw new Error(await res.text());
      const { highlight } = await res.json();
      onHighlightSaved(highlight);
      setSelection(null);
      window.getSelection()?.removeAllRanges();
    } catch (e) {
      console.error("Failed to save highlight", e);
    } finally {
      setSaving(false);
    }
  }, [selection, saving, postId, paragraphId, onHighlightSaved]);

  const deleteHighlight = useCallback(async () => {
    if (!myHighlight) return;
    try {
      await fetch(`/api/posts/${encodeURIComponent(postId)}/paragraph-highlights`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ highlightId: myHighlight._id }),
      });
      onHighlightDeleted(myHighlight._id);
    } catch (e) {
      console.error("Failed to delete highlight", e);
    }
  }, [myHighlight, postId, onHighlightDeleted]);

  useEffect(() => {
    if (!selection) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!containerRef.current?.contains(target)) {
        setSelection(null);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [selection]);

  const otherHighlights = highlights.filter(
    (h) => h.paragraphId === paragraphId && h.userId !== userId
  );
  const highlightCount = otherHighlights.length + (myHighlight ? 1 : 0);

  return (
    <>
      <span
        {...(paragraphProps as any)}
        ref={containerRef}
        onMouseUp={handleMouseUp}
        onTouchEnd={handleMouseUp}
        className={[
          (paragraphProps as any)?.className,
          "relative",
          myHighlight ? "border-l-2 border-yellow-400/60 pl-2" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {children}

        {highlightCount > 0 && (
          <span
            className="ml-2 inline-flex items-center gap-0.5 rounded-full bg-yellow-400/20 px-1.5 py-0.5 text-[10px] font-medium text-yellow-700 dark:text-yellow-300 cursor-default"
            title={`${highlightCount} destaque${highlightCount > 1 ? "s" : ""} neste parágrafo`}
          >
            ✦ {highlightCount}
          </span>
        )}
      </span>

      {selection && userId && (
        <span
          className="fixed z-[9998] -translate-x-1/2 -translate-y-full"
          style={{ left: selection.x, top: selection.y }}
        >
          <span className="flex items-center gap-1 rounded-full bg-zinc-900 px-3 py-1.5 shadow-lg ring-1 ring-zinc-700">
            <button
              type="button"
              onClick={saveHighlight}
              disabled={saving}
              className="flex items-center gap-1 text-xs font-medium text-yellow-300 hover:text-yellow-200 disabled:opacity-50"
            >
              <span aria-hidden>✦</span>
              {saving ? "Salvando…" : "Destacar"}
            </button>
            {myHighlight && (
              <>
                <span className="mx-1 text-zinc-600" aria-hidden>
                  |
                </span>
                <button
                  type="button"
                  onClick={deleteHighlight}
                  className="text-xs text-zinc-400 hover:text-red-400"
                >
                  Remover
                </button>
              </>
            )}
          </span>
          <span className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-zinc-900" />
        </span>
      )}
    </>
  );
}
