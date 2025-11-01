"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Date } from "@components/date";
import ShareButton from "@components/ShareButton";
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

        const paragraphProps = attributesToProps(element.attribs ?? {});
        const enhancedParagraphProps = {
          ...paragraphProps,
          className: [
            (paragraphProps as any)?.className,
            "transition-colors rounded-md -mx-2 px-2 py-0.5 hover:bg-zinc-100/60 dark:hover:bg-zinc-800/40",
          ]
            .filter(Boolean)
            .join(" "),
        } as typeof paragraphProps;

        return (
          <ParagraphCommentWidget
            key={paragraphId}
            postId={postId}
            paragraphId={paragraphId}
            paragraphIndex={currentIndex}
            coAuthorUserId={coAuthorUserId}
            paragraphProps={enhancedParagraphProps}
            isAdmin={isAdmin}
            isMobile={isMobile}
          >
            {domToReact((element.children ?? []) as DOMNode[], parserOptions)}
          </ParagraphCommentWidget>
        );
      }

      if (node.type === "tag" && node.name === "p" && !paragraphCommentsEnabled) {
        const element = node as Element;
        const paragraphProps = attributesToProps(element.attribs ?? {});
        const className = [
          (paragraphProps as any)?.className,
          "transition-colors rounded-md -mx-2 px-2 py-0.5 hover:bg-zinc-100/60 dark:hover:bg-zinc-800/40",
        ]
          .filter(Boolean)
          .join(" ");
        return (
          <p {...paragraphProps} className={className}>
            {domToReact((element.children ?? []) as DOMNode[], parserOptions)}
          </p>
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

  return (
    <IsMobileContext.Provider value={isMobile}>
      <article className="flex flex-col gap-4 mt-4">
        <div className="flex items-center justify-between text-sm text-zinc-500 border-b border-zinc-200 dark:border-zinc-700 pb-3">
          <div className="flex items-center gap-3 flex-wrap">
            <Date dateString={date} />
            <span>| {readingTime}</span>
            <span>{views} views</span>
          </div>
          <ShareButton id={postId} />
        </div>

        {audioUrl && <AudioPlayer audioUrl={audioUrl} />}

        <div className="flex flex-col gap-4 lg:text-lg sm:text-sm max-sm:text-xs">
          {parsedContent}
        </div>

        {/* <Chatbot htmlContent={htmlContent} /> */}
      </article>
    </IsMobileContext.Provider>
  );
}
