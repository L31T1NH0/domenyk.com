"use client";

import Link from "next/link";
import Image from "next/image";

type HeaderProps = {
  home?: boolean;
};

const name = "Domenyk";

export function Header({ home }: HeaderProps) {
  const figure = (
    <div className="overflow-hidden border border-neutral-800 bg-neutral-900 shadow-[0_0_120px_rgba(0,0,0,0.35)]">
      <Image
        priority
        src="/images/profile.jpg"
        className="h-auto w-full object-cover grayscale-[60%] contrast-125"
        height={640}
        width={512}
        alt={name}
      />
    </div>
  );

  return (
    <header className="flex flex-col gap-8">
      {home ? (
        figure
      ) : (
        <Link href="/" className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500">
          {figure}
        </Link>
      )}

      <div className="flex flex-col gap-4">
        <span className="text-xs uppercase tracking-[0.3em] text-neutral-500">Autor</span>
        <strong className="text-4xl font-semibold tracking-tight text-neutral-100">{name}</strong>
        <p className="text-sm leading-6 text-neutral-400">
          Registro público das leituras, discordâncias e posições que resolvi manter acessíveis.
        </p>
        <div className="flex flex-wrap gap-3 text-xs uppercase tracking-[0.25em] text-neutral-500">
          <span className="rounded-full border border-neutral-700 px-3 py-1">Análise</span>
          <span className="rounded-full border border-neutral-700 px-3 py-1">Relato</span>
          <span className="rounded-full border border-neutral-700 px-3 py-1">Observação</span>
        </div>
      </div>
    </header>
  );
}
