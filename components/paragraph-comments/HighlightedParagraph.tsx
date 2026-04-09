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
  onOpenComments?: () => void;
  isMobile?: boolean;
  mobileHighlightStyle?: "badges" | "border";
  hasComments?: boolean;
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
  onOpenComments,
  isMobile = false,
  mobileHighlightStyle = "badges",
  hasComments = false,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [selection, setSelection] = useState<SelectionInfo | null>(null);
  const [saving, setSaving] = useState(false);
  const [myHighlight, setMyHighlight] = useState<Highlight | null>(null);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [mobileMenuPos, setMobileMenuPos] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [useTouchActions, setUseTouchActions] = useState(isMobile);
  const [snackbarMessage, setSnackbarMessage] = useState<string | null>(null);
  const longPressTimerRef = useRef<number | null>(null);
  const longPressTriggeredRef = useRef(false);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const snackbarTimeoutRef = useRef<number | null>(null);
  const lastHintAtRef = useRef(0);

  const clearLongPressTimer = useCallback(() => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const showSnackbar = useCallback((message: string, durationMs = 2600) => {
    if (snackbarTimeoutRef.current !== null) {
      window.clearTimeout(snackbarTimeoutRef.current);
      snackbarTimeoutRef.current = null;
    }
    setSnackbarMessage(message);
    snackbarTimeoutRef.current = window.setTimeout(() => {
      setSnackbarMessage(null);
      snackbarTimeoutRef.current = null;
    }, durationMs);
  }, []);

  const isInteractiveTarget = useCallback((target: EventTarget | null) => {
    const element = target as HTMLElement | null;
    if (!element) return false;
    return Boolean(
      element.closest(
        "button, a, input, textarea, select, [role='button'], [contenteditable='true'], [data-highlight-popover]",
      ),
    );
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const media = window.matchMedia("(hover: none), (pointer: coarse), (max-width: 767px)");
    const update = () => {
      setUseTouchActions(isMobile || media.matches || navigator.maxTouchPoints > 0);
    };

    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [isMobile]);

  useEffect(() => {
    if (typeof window === "undefined" || !useTouchActions) return;
    const key = "paragraph-actions-gesture-hint-v1";
    const hasSeenHint = window.localStorage.getItem(key) === "1";
    if (hasSeenHint) return;
    showSnackbar("Dica: pressione e segure um parágrafo para comentar ou destacar.", 3400);
    window.localStorage.setItem(key, "1");
  }, [showSnackbar, useTouchActions]);

  useEffect(() => {
    return () => {
      clearLongPressTimer();
      if (snackbarTimeoutRef.current !== null) {
        window.clearTimeout(snackbarTimeoutRef.current);
      }
    };
  }, [clearLongPressTimer]);

  const openTouchMenuAt = useCallback(() => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setSelection(null);
    window.getSelection()?.removeAllRanges();
    setMobileMenuPos({
      x: rect.right,
      y: rect.top - 8,
    });
    setShowMobileMenu(true);
    showSnackbar("Ações do parágrafo abertas: comentar ou destacar.", 2200);
  }, [showSnackbar]);

  useEffect(() => {
    const mine = highlights.find(
      (h) => h.paragraphId === paragraphId && h.userId === userId,
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
        },
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

  const highlightFullParagraph = useCallback(async () => {
    if (!userId || saving) return;
    const fullText = containerRef.current?.textContent?.trim() ?? "";
    if (!fullText) return;
    setSaving(true);
    try {
      const res = await fetch(
        `/api/posts/${encodeURIComponent(postId)}/paragraph-highlights`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            paragraphId,
            selectedText: fullText,
            startOffset: 0,
            endOffset: fullText.length,
          }),
        },
      );
      if (!res.ok) throw new Error(await res.text());
      const { highlight } = await res.json();
      onHighlightSaved(highlight);
      setShowMobileMenu(false);
    } catch (e) {
      console.error("Failed to save highlight", e);
    } finally {
      setSaving(false);
    }
  }, [userId, saving, postId, paragraphId, onHighlightSaved]);

  const deleteHighlight = useCallback(async () => {
    if (!myHighlight) return;
    try {
      await fetch(
        `/api/posts/${encodeURIComponent(postId)}/paragraph-highlights`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ highlightId: myHighlight._id }),
        },
      );
      onHighlightDeleted(myHighlight._id);
    } catch (e) {
      console.error("Failed to delete highlight", e);
    }
  }, [myHighlight, postId, onHighlightDeleted]);

  useEffect(() => {
    if (!selection && !showMobileMenu) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        containerRef.current?.contains(target) ||
        (target as Element).closest?.("[data-highlight-popover]")
      ) {
        return;
      }
      setSelection(null);
      setShowMobileMenu(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [selection, showMobileMenu]);

  useEffect(() => {
    if (!showMobileMenu) return;

    const hideMobileMenu = () => {
      setShowMobileMenu(false);
    };

    window.addEventListener("scroll", hideMobileMenu, { passive: true });
    window.addEventListener("touchmove", hideMobileMenu, { passive: true });

    return () => {
      window.removeEventListener("scroll", hideMobileMenu);
      window.removeEventListener("touchmove", hideMobileMenu);
    };
  }, [showMobileMenu]);

  return (
    <>
      <div
        {...(paragraphProps as any)}
        ref={containerRef}
        onMouseUp={handleMouseUp}
        onTouchStart={(e) => {
          if (!useTouchActions) return;
          if (isInteractiveTarget(e.target)) return;
          const touch = e.touches[0];
          if (!touch) return;
          touchStartRef.current = { x: touch.clientX, y: touch.clientY };
          longPressTriggeredRef.current = false;
          clearLongPressTimer();
          longPressTimerRef.current = window.setTimeout(() => {
            longPressTriggeredRef.current = true;
            openTouchMenuAt();
          }, 420);
        }}
        onTouchMove={(e) => {
          if (!useTouchActions || !touchStartRef.current) return;
          const touch = e.touches[0];
          if (!touch) return;
          const dx = Math.abs(touch.clientX - touchStartRef.current.x);
          const dy = Math.abs(touch.clientY - touchStartRef.current.y);
          if (dx > 10 || dy > 10) {
            clearLongPressTimer();
            touchStartRef.current = null;
          }
        }}
        onTouchEnd={() => {
          if (!useTouchActions) return;
          const hadTapCandidate = touchStartRef.current !== null;
          const triggered = longPressTriggeredRef.current;
          clearLongPressTimer();
          touchStartRef.current = null;
          longPressTriggeredRef.current = false;
          if (!triggered && hadTapCandidate) {
            const now = Date.now();
            if (now - lastHintAtRef.current < 5000) {
              return;
            }
            lastHintAtRef.current = now;
            showSnackbar("Para comentar ou destacar, pressione e segure o parágrafo.");
          }
        }}
        onTouchCancel={() => {
          clearLongPressTimer();
          touchStartRef.current = null;
          longPressTriggeredRef.current = false;
        }}
        className={[
          (paragraphProps as any)?.className,
          "relative",
          mobileHighlightStyle === "border"
            ? (myHighlight || hasComments ? "pl-2" : "")
            : myHighlight
              ? "border-l-2 border-yellow-400/60 pl-2"
              : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {mobileHighlightStyle === "border" && (myHighlight || hasComments) && (
          <span
            aria-hidden
            className="absolute left-0 top-0 h-full w-0.5"
            style={{
              background: myHighlight && hasComments
                ? "linear-gradient(to bottom, #facc1599 50%, #a78bfa99 50%)"
                : myHighlight
                  ? "#facc1599"
                  : "#a78bfa99",
            }}
          />
        )}
        {children}
      </div>

      {showMobileMenu && mobileMenuPos && (
        <span
          data-highlight-popover
          className="fixed z-[9998] -translate-x-full -translate-y-full"
          style={{ left: mobileMenuPos.x, top: mobileMenuPos.y }}
        >
          <span className="flex items-center gap-1 rounded-full bg-zinc-900 px-3 py-1.5 shadow-lg ring-1 ring-zinc-700">
            {!myHighlight ? (
              <button
                type="button"
                onClick={() => void highlightFullParagraph()}
                disabled={saving}
                className="flex items-center gap-1 text-xs font-medium text-yellow-300 hover:text-yellow-200 disabled:opacity-50"
              >
                <span aria-hidden>✦</span>
                {saving ? "Salvando…" : "Destacar"}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  void deleteHighlight();
                  setShowMobileMenu(false);
                }}
                className="flex items-center gap-1 text-xs font-medium text-red-400 hover:text-red-300"
              >
                <span aria-hidden>✦</span>
                Remover destaque
              </button>
            )}
            <span className="mx-1 text-zinc-600" aria-hidden>
              |
            </span>
            <button
              type="button"
              onClick={() => {
                setShowMobileMenu(false);
                onOpenComments?.();
              }}
              className="flex items-center gap-1 text-xs font-medium text-zinc-300 hover:text-white"
            >
              Comentar
            </button>
          </span>
          <span className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-zinc-900" />
        </span>
      )}

      {useTouchActions && snackbarMessage && (
        <span className="fixed bottom-4 left-1/2 z-[9999] w-[min(92vw,28rem)] -translate-x-1/2 rounded-xl border border-zinc-700 bg-zinc-900/95 px-4 py-3 text-center text-xs font-medium text-zinc-100 shadow-xl backdrop-blur">
          {snackbarMessage}
        </span>
      )}

      {!isMobile && selection && userId && (
        <span
          data-highlight-popover
          className="fixed z-[9998] -translate-x-1/2 -translate-y-full"
          style={{ left: selection.x, top: selection.y }}
        >
          <span className="flex items-center gap-1 rounded-full bg-zinc-900 px-3 py-1.5 shadow-lg ring-1 ring-zinc-700">
            {!myHighlight && (
              <button
                type="button"
                onClick={saveHighlight}
                disabled={saving}
                className="flex items-center gap-1 text-xs font-medium text-yellow-300 hover:text-yellow-200 disabled:opacity-50"
              >
                <span aria-hidden>✦</span>
                {saving ? "Salvando…" : "Destacar"}
              </button>
            )}
            {myHighlight && (
              <button
                type="button"
                onClick={deleteHighlight}
                className="flex items-center gap-1 text-xs font-medium text-red-400 hover:text-red-300"
              >
                <span aria-hidden>✦</span>
                Remover
              </button>
            )}
            <span className="mx-1 text-zinc-600" aria-hidden>
              |
            </span>
            <button
              type="button"
              onClick={() => {
                setSelection(null);
                window.getSelection()?.removeAllRanges();
                onOpenComments?.();
              }}
              className="flex items-center gap-1 text-xs font-medium text-zinc-300 hover:text-white"
            >
              Comentar
            </button>
          </span>
          <span className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-zinc-900" />
        </span>
      )}
    </>
  );
}
