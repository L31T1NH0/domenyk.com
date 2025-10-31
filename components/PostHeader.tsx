"use client";

import Link from "next/link";
import Image from "next/image";
import { layoutClasses } from "./layout";
import { useReveal } from "@lib/useReveal";
import ShareButton from "@components/ShareButton";
import { Date } from "@components/date";

type PostHeaderProps = {
  cape?: string;
  title: string;
  friendImage?: string;
  coAuthorImageUrl?: string | null;
  date: string;
  readingTime: string;
  postId: string;
  views?: number;
};

const primaryName = "Domenyk";

const noiseTexture =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160' fill='none'%3E%3Cfilter id='a'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23a)' opacity='.35'/%3E%3C/svg%3E\")";

export function PostHeader({
  cape,
  title,
  friendImage,
  coAuthorImageUrl,
  date,
  readingTime,
  postId,
  views,
}: PostHeaderProps) {
  const secondaryImage = coAuthorImageUrl || friendImage || undefined;
  const headerRef = useReveal<HTMLDivElement>({ threshold: 0.2 });

  return (
    <section className={layoutClasses.section}>
      <div ref={headerRef} className={`reveal-init ${layoutClasses.grid}`}>
        <div className={layoutClasses.columns.wide}>
          <div className="relative overflow-hidden rounded-[2.75rem] border border-[var(--color-border)] bg-[rgba(14,14,14,0.9)] shadow-[0_40px_70px_rgba(0,0,0,0.55)]">
            {cape ? (
              <>
                <div className="absolute inset-0">
                  <Image
                    src={cape}
                    alt="Imagem de capa"
                    fill
                    className="object-cover object-center opacity-85"
                    priority
                  />
                </div>
                <div
                  className="absolute inset-0"
                  aria-hidden
                  style={{
                    backgroundImage:
                      "radial-gradient(circle at 20% 20%, rgba(255,75,139,0.25), transparent 55%), radial-gradient(circle at 80% 10%, rgba(255,255,255,0.15), transparent 65%), linear-gradient(180deg, rgba(4,4,4,0.2), rgba(4,4,4,0.85))",
                  }}
                />
                <div
                  className="absolute inset-0 mix-blend-soft-light opacity-40"
                  aria-hidden
                  style={{ backgroundImage: noiseTexture }}
                />
              </>
            ) : (
              <div
                className="absolute inset-0"
                aria-hidden
                style={{
                  backgroundImage:
                    "radial-gradient(circle at 15% 20%, rgba(255,75,139,0.2), transparent 45%), radial-gradient(circle at 80% 0%, rgba(255,255,255,0.12), transparent 60%), linear-gradient(160deg, rgba(12,12,12,0.95), rgba(8,8,8,0.8))",
                }}
              />
            )}

            <div className="relative z-10 flex flex-col items-center gap-8 px-8 py-14 text-center sm:px-14 sm:py-20">
              <div className="flex -space-x-4">
                <Link href="/" className="motion-scale" aria-label="Ver perfil de Domenyk">
                  <Image
                    priority
                    src="/images/profile.jpg"
                    className="size-20 rounded-full border border-[rgba(255,75,139,0.45)] object-cover shadow-[0_15px_35px_rgba(255,75,139,0.3)]"
                    height={112}
                    width={112}
                    alt={primaryName}
                  />
                </Link>
                {secondaryImage && (
                  <Link href="/" className="motion-scale" aria-label="Ver colaborador">
                    <Image
                      src={secondaryImage}
                      className="size-20 rounded-full border border-white/20 object-cover shadow-[0_15px_35px_rgba(255,255,255,0.18)]"
                      height={112}
                      width={112}
                      alt="Colaborador"
                    />
                  </Link>
                )}
              </div>

              <h1 className="max-w-[22ch] text-[clamp(2.3rem,5vw,3.6rem)] font-normal leading-[1.05] text-white">
                {title}
              </h1>

              <div className="flex flex-wrap items-center justify-center gap-4 text-[0.68rem] uppercase tracking-[0.32em] text-[var(--color-muted)]">
                <Date dateString={date} className="text-[0.68rem] uppercase tracking-[0.32em] text-[var(--color-muted)]" />
                <span aria-hidden className="hidden sm:inline text-[var(--color-muted)]">
                  •
                </span>
                <span>{readingTime}</span>
                {typeof views === "number" && (
                  <>
                    <span aria-hidden className="hidden sm:inline text-[var(--color-muted)]">
                      •
                    </span>
                    <span>{views.toLocaleString("pt-BR")} leituras</span>
                  </>
                )}
                <ShareButton id={postId} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
