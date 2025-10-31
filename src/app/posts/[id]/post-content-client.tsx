"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type HTMLAttributes,
} from "react";
import { Date } from "@components/date";
import AudioPlayer from "@components/AudioPlayer";
import parse, {
  DOMNode,
  Element,
  attributesToProps,
  domToReact,
  type HTMLReactParserOptions,
} from "html-react-parser";
import ParagraphCommentWidget from "@components/paragraph-comments/ParagraphCommentWidget";
import PostReference from "@components/PostReference";
import AutorReference from "@components/AutorReference";
import PostMinimap from "@components/PostMinimap";
import { layoutClasses } from "@components/layout";
import { useReveal } from "@lib/useReveal";

const IsMobileContext = createContext<boolean | null>(null);

export function useIsMobile(): boolean {
  const context = useContext(IsMobileContext);
  if (context === null) {
    throw new Error("useIsMobile must be used within an IsMobileContext provider");
  }
  return context;
}

type PostContentClientProps = {
  postId: string;
  date: string;
  htmlContent: string;
  initialViews: number;
  audioUrl?: string;
  readingTime: string;
  coAuthorUserId?: string | null;
  coAuthorImageUrl?: string | null;
  paragraphCommentsEnabled: boolean;
  isAdmin: boolean;
};

export default function PostContentClient({
  postId,
  date,
  htmlContent,
  initialViews,
  audioUrl,
  readingTime,
  coAuthorUserId,
  coAuthorImageUrl,
  paragraphCommentsEnabled,
  isAdmin,
}: PostContentClientProps) {
  const [views, setViews] = useState(initialViews);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    handleResize();
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  useEffect(() => {
    let canceled = false;

    const trackView = async () => {
      try {
        const response = await fetch(`/api/posts/${postId}`);
        if (!response.ok) {
          return;
        }
        const { views } = await response.json();
        if (!canceled && typeof views === "number") {
          setViews(views);
        }
      } catch (error) {
        console.error("Failed to refresh post views", error);
      }
    };

    trackView();

    return () => {
      canceled = true;
    };
  }, [postId]);

  const parsedContent = useMemo(() => {
    if (!htmlContent) {
      return <p>Conteúdo não disponível.</p>;
    }

    let paragraphIndex = 0;

    const parserOptions: HTMLReactParserOptions = {};

    parserOptions.replace = (node: DOMNode) => {
      if (node.type === "tag" && node.name === "span") {
        const element = node as Element;
        const role = element.attribs?.["data-role"] ?? element.attribs?.dataRole;
        if (role === "post-reference") {
          const slug = element.attribs?.["data-slug"] ?? element.attribs?.dataSlug;
          if (typeof slug === "string" && slug.trim() !== "") {
            return <PostReference slug={slug} />;
          }
        }
        if (role === "author-reference") {
          const kind = (element.attribs?.["data-kind"] ?? element.attribs?.dataKind) as string | undefined;
          if (kind === "author") {
            return <AutorReference kind="author" />;
          }
          if (kind === "co-author") {
            return <AutorReference kind="co-author" coAuthorImageUrl={coAuthorImageUrl ?? null} />;
          }
        }
      }

      if (node.type === "tag" && node.name === "p" && paragraphCommentsEnabled) {
        const element = node as Element;
        const paragraphId = `${postId}-paragraph-${paragraphIndex}`;
        const currentIndex = paragraphIndex;
        paragraphIndex += 1;

        const paragraphProps = attributesToProps(element.attribs ?? {}) as HTMLAttributes<HTMLParagraphElement>;
        const paragraphClassName = [paragraphProps.className, "article-paragraph"].filter(Boolean).join(" ");

        return (
          <ParagraphCommentWidget
            key={paragraphId}
            postId={postId}
            paragraphId={paragraphId}
            paragraphIndex={currentIndex}
            coAuthorUserId={coAuthorUserId}
            paragraphProps={{ ...paragraphProps, className: paragraphClassName }}
            isAdmin={isAdmin}
            isMobile={isMobile}
          >
            {domToReact((element.children ?? []) as DOMNode[], parserOptions)}
          </ParagraphCommentWidget>
        );
      }

      return undefined;
    };

    return parse(htmlContent, parserOptions);
  }, [
    coAuthorUserId,
    htmlContent,
    isAdmin,
    isMobile,
    paragraphCommentsEnabled,
    postId,
  ]);

  const sectionRef = useReveal<HTMLDivElement>({ threshold: 0.15 });

  return (
    <IsMobileContext.Provider value={isMobile}>
      <section className={layoutClasses.section}>
        <div ref={sectionRef} className={`reveal-init ${layoutClasses.grid}`}>
          <article
            className={`${layoutClasses.columns.main} relative mx-auto flex flex-col gap-10 overflow-hidden rounded-[2rem] border border-[var(--color-border)] bg-[rgba(18,18,18,0.72)] px-6 py-10 shadow-[0_34px_60px_rgba(0,0,0,0.5)] sm:px-10 sm:py-12`}
          >
            <div
              className="pointer-events-none absolute inset-0 opacity-60"
              aria-hidden
              style={{
                backgroundImage:
                  "radial-gradient(circle at top, rgba(255,75,139,0.18), transparent 65%), linear-gradient(180deg, rgba(8,8,8,0.35), rgba(8,8,8,0.85))",
              }}
            />

            <div className="relative flex flex-col gap-6 text-[0.75rem] uppercase tracking-[0.28em] text-[var(--color-muted)]">
              <div className="flex flex-wrap items-center gap-3">
                <Date dateString={date} className="text-[0.75rem] uppercase tracking-[0.28em] text-[var(--color-muted)]" />
                <span aria-hidden className="hidden sm:inline text-[var(--color-muted)]">
                  •
                </span>
                <span>{readingTime}</span>
                <span aria-hidden className="hidden sm:inline text-[var(--color-muted)]">
                  •
                </span>
                <span>{views.toLocaleString("pt-BR")} leituras</span>
              </div>
              <div className="h-px bg-[rgba(255,255,255,0.12)]" />
            </div>

            {audioUrl && (
              <div className="relative rounded-2xl border border-[rgba(255,255,255,0.12)] bg-[rgba(12,12,12,0.85)] p-4">
                <AudioPlayer audioUrl={audioUrl} />
              </div>
            )}

            <div className="relative mx-auto flex w-full max-w-[68ch] flex-col gap-6 text-base leading-[1.7] text-[var(--color-text)]">
              {parsedContent}
            </div>
          </article>
        </div>
      </section>
      <PostMinimap />
    </IsMobileContext.Provider>
  );
}
