"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ChevronLeftIcon } from "@heroicons/react/24/outline";

export function BackHome() {
  const [left, setLeft] = useState<number | null>(null);
  const linkRef = useRef<HTMLAnchorElement | null>(null);

  useEffect(() => {
    const computeLeft = () => {
      const container = document.querySelector<HTMLElement>("[data-layout-container='true']");
      if (!container) {
        setLeft(8);
        return;
      }
      const rect = container.getBoundingClientRect();
      const width = linkRef.current?.offsetWidth ?? 40;
      const gap = 16; // 16px fora do container
      const next = Math.max(8, Math.floor(rect.left - gap - width));
      setLeft(next);
    };

    computeLeft();
    window.addEventListener("resize", computeLeft);
    return () => window.removeEventListener("resize", computeLeft);
  }, []);

  return (
    <>
      {/* Mobile: inline */}
      <div className="md:hidden my-6 mx-0">
        <Link
          href="/"
          className="inline-flex w-fit h-fit items-center gap-2 py-1 text-zinc-600 hover:text-zinc-900 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 dark:text-zinc-300 dark:hover:text-zinc-100 mx-0"
          aria-label="Voltar para a página inicial"
          title="Voltar para a página inicial"
        >
          <ChevronLeftIcon className="size-5" aria-hidden="true" />
          <span className="text-sm">Voltar</span>
        </Link>
      </div>

      {/* Desktop: fixo, fora do container */}
      <div className="hidden md:flex">
        <Link
          ref={linkRef}
          href="/"
          className="fixed top-1/2 -translate-y-1/2 z-40 flex items-center justify-center p-1.5 rounded-full text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors transition-transform duration-150 hover:scale-110"
          style={left !== null ? { left } : undefined}
          aria-label="Voltar para a página inicial"
          title="Voltar para a página inicial"
        >
          <ChevronLeftIcon className="size-7 text-zinc-700 dark:text-zinc-300" aria-hidden="true" />
        </Link>
      </div>
    </>
  );
}
