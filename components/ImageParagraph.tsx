"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { XMarkIcon } from "@heroicons/react/24/solid";

type ImageParagraphProps = {
  src: string;
  alt: string;
  isMobile: boolean;
  paragraphCommentSlot?: React.ReactNode;
  initialCommentCount?: number;
};

export default function ImageParagraph({
  src,
  alt,
  isMobile,
  paragraphCommentSlot,
  initialCommentCount = 0,
}: ImageParagraphProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const lightboxRef = useRef<HTMLDivElement>(null);

  const openLightbox = useCallback(() => setLightboxOpen(true), []);
  const closeLightbox = useCallback(() => setLightboxOpen(false), []);
  const toggleComments = useCallback(() => setCommentsOpen((v) => !v), []);

  useEffect(() => {
    if (!lightboxOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeLightbox();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [lightboxOpen, closeLightbox]);

  useEffect(() => {
    document.body.style.overflow = lightboxOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [lightboxOpen]);

  return (
    <>
      <span className="relative block group my-2">
        <img
          src={src}
          alt={alt}
          onClick={isMobile ? toggleComments : openLightbox}
          className={`
            rounded-md w-full h-full cursor-zoom-in
            transition-all duration-300
            ${commentsOpen ? "grayscale-0" : "grayscale-100"}
          `}
        />

        {isMobile && initialCommentCount > 0 && !commentsOpen && (
          <span className="absolute bottom-2 right-2 flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[11px] text-white backdrop-blur-sm">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="size-3" aria-hidden>
              <path fillRule="evenodd" d="M1 8.74C1 10.55 2.46 12 4.26 12H5v1.52a.75.75 0 0 0 1.14.642L9.11 12h2.63A3.25 3.25 0 0 0 15 8.74v-2.5A3.25 3.25 0 0 0 11.74 3H4.26A3.25 3.25 0 0 0 1 6.24v2.5Z" clipRule="evenodd" />
            </svg>
            {initialCommentCount}
          </span>
        )}

        {!isMobile && (
          <span className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity rounded-full bg-black/60 p-1.5 backdrop-blur-sm pointer-events-none">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="size-3 text-white" aria-hidden>
              <path d="M6 1a5 5 0 1 1 0 10A5 5 0 0 1 6 1Zm.75 4.25v-1.5a.75.75 0 0 0-1.5 0v1.5h-1.5a.75.75 0 0 0 0 1.5h1.5v1.5a.75.75 0 0 0 1.5 0v-1.5h1.5a.75.75 0 0 0 0-1.5h-1.5ZM13.78 13.78a.75.75 0 0 1-1.06 0L10.22 11.28A6 6 0 1 1 11.28 10.22l2.5 2.5a.75.75 0 0 1 0 1.06Z" />
            </svg>
          </span>
        )}
      </span>

      {isMobile && commentsOpen && (
        <div className="rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 shadow-lg mb-2">
          <div className="relative bg-zinc-950">
            <img
              src={src}
              alt={alt}
              className="w-full h-auto max-h-64 object-contain grayscale-0"
            />
            <button
              type="button"
              onClick={toggleComments}
              aria-label="Fechar"
              className="absolute top-2 right-2 flex items-center justify-center rounded-full bg-black/60 p-1.5 backdrop-blur-sm"
            >
              <XMarkIcon className="h-4 w-4 text-white" />
            </button>
          </div>

          <div className="p-3">{paragraphCommentSlot}</div>
        </div>
      )}

      {lightboxOpen && (
        <div
          ref={lightboxRef}
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === lightboxRef.current) closeLightbox();
          }}
        >
          <button
            type="button"
            onClick={closeLightbox}
            aria-label="Fechar"
            className="absolute top-4 right-4 flex items-center justify-center rounded-full bg-white/10 p-2 transition-colors hover:bg-white/20"
          >
            <XMarkIcon className="h-5 w-5 text-white" />
          </button>
          <img
            src={src}
            alt={alt}
            className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain grayscale-0 shadow-2xl"
          />
        </div>
      )}
    </>
  );
}
