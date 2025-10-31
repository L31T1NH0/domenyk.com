"use client";

import Link from "next/link";
import Image from "next/image";
import { layoutClasses } from "./layout";
import { useReveal } from "@lib/useReveal";

type HeaderProps = {
  home?: boolean;
};

const name = "Domenyk";

const subtitle =
  "Manifesto digital sobre código, cultura e desobediência criativa — um laboratório aberto para ideias que desafiam o ruído.";

export function Header({ home = false }: HeaderProps) {
  const panelRef = useReveal<HTMLDivElement>({ threshold: 0.25 });

  const portrait = (
    <div className="relative inline-flex items-center justify-center">
      <Image
        priority
        src="/images/profile.jpg"
        className="size-28 sm:size-32 rounded-full border border-[rgba(255,75,139,0.45)] object-cover shadow-[0_18px_40px_rgba(255,75,139,0.25)] transition duration-300 hover:border-[rgba(255,75,139,0.75)] hover:shadow-[0_24px_50px_rgba(255,75,139,0.35)]"
        height={180}
        width={180}
        alt={name}
      />
      <span className="pointer-events-none absolute inset-0 rounded-full border border-white/10 mix-blend-screen" aria-hidden />
    </div>
  );

  return (
    <section className={layoutClasses.section}>
      <div ref={panelRef} className={`reveal-init ${layoutClasses.grid}`}>
        <div className={layoutClasses.columns.full}>
          <div className="surface-panel px-6 py-12 sm:px-12 sm:py-16 text-center flex flex-col items-center gap-6">
            {home ? (
              portrait
            ) : (
              <Link href="/" aria-label="Voltar para a página inicial" className="motion-scale">
                {portrait}
              </Link>
            )}

            <div className="space-y-3">
              <span className="text-xs tracking-[0.6em] text-[var(--color-muted)]">{name.toUpperCase()}</span>
              <h1 className="text-[clamp(2.5rem,5vw,3.4rem)] leading-[1.05]">{name.toUpperCase()}</h1>
            </div>

            <p className="max-w-[58ch] text-base sm:text-lg text-[var(--color-text-soft)]">
              {subtitle}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
