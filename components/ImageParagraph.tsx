"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { XMarkIcon } from "@heroicons/react/24/solid";

type ImageParagraphProps = {
  src: string;
  alt: string;
  isMobile?: boolean;
  paragraphCommentSlot?: React.ReactNode;
  initialCommentCount?: number;
};

export default function ImageParagraph({ src, alt }: ImageParagraphProps) {
  const [open, setOpen] = useState(false);
  const [visible, setVisible] = useState(false);
  const scrollYOnOpen = useRef(0);
  const overlayRef = useRef<HTMLDivElement>(null);
  const SCROLL_DISMISS_THRESHOLD = 80;

  const openLightbox = useCallback(() => {
    scrollYOnOpen.current = window.scrollY;
    setOpen(true);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setVisible(true));
    });
  }, []);

  const closeLightbox = useCallback(() => {
    setVisible(false);
    setTimeout(() => setOpen(false), 250);
  }, []);

  // Fecha com Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeLightbox();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, closeLightbox]);

  // Bloqueia scroll do body enquanto aberto
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Scroll-to-dismiss: detecta scroll mesmo com body bloqueado
  useEffect(() => {
    if (!open) return;
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) > SCROLL_DISMISS_THRESHOLD) closeLightbox();
    };
    const onTouchStart = (e: TouchEvent) => {
      scrollYOnOpen.current = e.touches[0]?.clientY ?? 0;
    };
    const onTouchMove = (e: TouchEvent) => {
      const delta = Math.abs((e.touches[0]?.clientY ?? 0) - scrollYOnOpen.current);
      if (delta > SCROLL_DISMISS_THRESHOLD) closeLightbox();
    };
    window.addEventListener("wheel", onWheel, { passive: true });
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    return () => {
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
    };
  }, [open, closeLightbox]);

  return (
    <>
      {/* Imagem inline no post */}
      <span data-image-paragraph className="relative block group my-2">
        <img
          src={src}
          alt={alt}
          onClick={openLightbox}
          className="rounded-md w-full h-full cursor-zoom-in"
        />
        {/* Ícone de zoom */}
        <span className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity rounded-full bg-black/60 p-1.5 backdrop-blur-sm pointer-events-none">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="size-3 text-white" aria-hidden>
            <path d="M6 1a5 5 0 1 1 0 10A5 5 0 0 1 6 1Zm.75 4.25v-1.5a.75.75 0 0 0-1.5 0v1.5h-1.5a.75.75 0 0 0 0 1.5h1.5v1.5a.75.75 0 0 0 1.5 0v-1.5h1.5a.75.75 0 0 0 0-1.5h-1.5ZM13.78 13.78a.75.75 0 0 1-1.06 0L10.22 11.28A6 6 0 1 1 11.28 10.22l2.5 2.5a.75.75 0 0 1 0 1.06Z" />
          </svg>
        </span>
      </span>

      {/* Lightbox — fullscreen, mobile e desktop */}
      {open && (
        <div
          ref={overlayRef}
          onClick={(e) => {
            if (e.target === overlayRef.current) closeLightbox();
          }}
          className="fixed inset-0 z-[9999] flex items-center justify-center"
          style={{
            backgroundColor: `rgba(0,0,0,${visible ? 0.92 : 0})`,
            backdropFilter: `blur(${visible ? 8 : 0}px)`,
            transition: "background-color 250ms ease, backdrop-filter 250ms ease",
          }}
        >
          {/* Botão fechar */}
          <button
            type="button"
            onClick={closeLightbox}
            aria-label="Fechar"
            className="absolute top-4 right-4 z-10 flex items-center justify-center rounded-full bg-white/10 p-2 transition-colors hover:bg-white/20"
            style={{
              opacity: visible ? 1 : 0,
              transition: "opacity 250ms ease",
            }}
          >
            <XMarkIcon className="h-5 w-5 text-white" />
          </button>

          {/* Imagem */}
          <img
            src={src}
            alt={alt}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain shadow-2xl"
            style={{
              filter: "grayscale(0)",
              opacity: visible ? 1 : 0,
              transform: visible ? "scale(1)" : "scale(0.92)",
              transition: "opacity 250ms ease, transform 250ms ease",
            }}
          />

          {/* Dica de fechar — some após 2s */}
          <DismissHint visible={visible} />
        </div>
      )}
    </>
  );
}

function DismissHint({ visible }: { visible: boolean }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setShow(true);
    const t = setTimeout(() => setShow(false), 2000);
    return () => clearTimeout(t);
  }, [visible]);

  return (
    <span
      className="absolute bottom-6 left-1/2 -translate-x-1/2 rounded-full bg-white/10 px-3 py-1 text-xs text-white/70 backdrop-blur-sm pointer-events-none"
      style={{
        opacity: show ? 1 : 0,
        transition: "opacity 400ms ease",
      }}
    >
      Scroll ou Esc para fechar
    </span>
  );
}
