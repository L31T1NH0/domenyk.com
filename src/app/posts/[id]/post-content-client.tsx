"use client";

import parse, {
  DOMNode,
  Element,
  attributesToProps,
  domToReact,
  type HTMLReactParserOptions,
} from "html-react-parser";
import PostReference from "@components/PostReference";
import AutorReference from "@components/AutorReference";
import PostContentShell, {
  IsMobileContext,
  LazyParagraphCommentWidget,
  type ParagraphCommentWidgetProps,
} from "./post-content-interactive";
import SectionAttentionTracker from "@components/analytics/SectionAttentionTracker";
import HeatmapProgressBar from "@components/HeatmapProgressBar";
import { useContext, useRef, type HTMLAttributes, type RefObject } from "react";
import { useCommentsSummary } from "@components/paragraph-comments/useCommentsSummary";
import ImageParagraph from "@components/ImageParagraph";
import { useHighlights } from "@components/paragraph-comments/useHighlights";
import HighlightedParagraph from "@components/paragraph-comments/HighlightedParagraph";
import { useAuth } from "@clerk/nextjs";
import type { Highlight } from "@components/paragraph-comments/useHighlights";

function renderParagraphWithComments(
  node: Element,
  parserOptions: HTMLReactParserOptions,
  paragraphIndex: number,
  options: Pick<ParagraphCommentWidgetProps, "postId" | "coAuthorUserId" | "isAdmin" | "mobileHighlightStyle">,
  summaryMap: Map<string, number>,
  highlightProps?: {
    highlights: Highlight[];
    userId: string | null | undefined;
    isMobile: boolean;
    mobileHighlightStyle: "badges" | "border";
    openCommentsFnsRef: RefObject<Map<string, () => Promise<void>>>;
    onHighlightSaved: (h: Highlight) => void;
    onHighlightDeleted: (id: string) => void;
  }
) {
  const paragraphId = `${options.postId}-paragraph-${paragraphIndex}`;
  const initialCount = summaryMap.get(paragraphId) ?? 0;
  const paragraphProps = attributesToProps(node.attribs ?? {}) as HTMLAttributes<HTMLParagraphElement>;
  const enhancedParagraphProps: HTMLAttributes<HTMLParagraphElement> = {
    ...paragraphProps,
    className: [
      (paragraphProps as any)?.className,
      "transition-colors rounded-md -mx-2 px-2 py-0.5 hover:bg-zinc-100/90 dark:hover:bg-zinc-800/60",
    ]
      .filter(Boolean)
      .join(" "),
  };

  const content = domToReact((node.children ?? []) as DOMNode[], parserOptions);

  if (highlightProps) {
    return (
      <HighlightedParagraph
        key={paragraphId}
        paragraphId={paragraphId}
        postId={options.postId}
        highlights={highlightProps.highlights}
        userId={highlightProps.userId}
        onHighlightSaved={highlightProps.onHighlightSaved}
        onHighlightDeleted={highlightProps.onHighlightDeleted}
        paragraphProps={enhancedParagraphProps}
        isMobile={highlightProps.isMobile}
        mobileHighlightStyle={highlightProps.mobileHighlightStyle}
        hasComments={initialCount > 0}
        onOpenComments={() => highlightProps.openCommentsFnsRef.current?.get(paragraphId)?.()}
      >
        <LazyParagraphCommentWidget
          postId={options.postId}
          paragraphId={paragraphId}
          paragraphIndex={paragraphIndex}
          coAuthorUserId={options.coAuthorUserId}
          paragraphProps={{}}
          isAdmin={options.isAdmin}
          isMobile={highlightProps.isMobile}
          initialCount={initialCount}
          onRegisterOpenComments={(fn) => highlightProps.openCommentsFnsRef.current?.set(paragraphId, fn)}
          onHighlight={() => {
            if (!highlightProps.userId) {
              return;
            }
            const paragraphText = document
              .querySelector(`[data-paragraph-id="${paragraphId}"] p`)
              ?.textContent?.trim();
            if (!paragraphText) {
              return;
            }

            void fetch(`/api/posts/${encodeURIComponent(options.postId)}/paragraph-highlights`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                paragraphId,
                selectedText: paragraphText,
                startOffset: 0,
                endOffset: paragraphText.length,
              }),
            })
              .then(async (response) => {
                if (!response.ok) {
                  throw new Error(await response.text());
                }
                return response.json() as Promise<{ highlight: Highlight }>;
              })
              .then((data) => {
                highlightProps.onHighlightSaved(data.highlight);
              })
              .catch((error) => {
                console.error("Failed to save highlight", error);
              });
          }}
          highlightCount={highlightProps.highlights.filter((h) => h.paragraphId === paragraphId).length}
          mobileHighlightStyle={highlightProps.mobileHighlightStyle}
        >
          {content}
        </LazyParagraphCommentWidget>
      </HighlightedParagraph>
    );
  }

  return (
    <LazyParagraphCommentWidget
      key={paragraphId}
      postId={options.postId}
      paragraphId={paragraphId}
      paragraphIndex={paragraphIndex}
      coAuthorUserId={options.coAuthorUserId}
      paragraphProps={enhancedParagraphProps}
      isAdmin={options.isAdmin}
      isMobile={false}
      initialCount={initialCount}
      mobileHighlightStyle={options.mobileHighlightStyle ?? "badges"}
    >
      {content}
    </LazyParagraphCommentWidget>
  );
}

function renderParagraphWithoutComments(node: Element, parserOptions: HTMLReactParserOptions) {
  const paragraphProps = attributesToProps(node.attribs ?? {}) as HTMLAttributes<HTMLParagraphElement>;
  const className = [
    (paragraphProps as any)?.className,
    "transition-colors rounded-md -mx-2 px-2 py-0.5 hover:bg-zinc-100/90 dark:hover:bg-zinc-800/60",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <p {...paragraphProps} className={className}>
      {domToReact((node.children ?? []) as DOMNode[], parserOptions)}
    </p>
  );
}

function ImageParagraphWithoutComments({
  src,
  alt,
}: {
  src: string;
  alt: string;
}) {
  const isMobile = useContext(IsMobileContext) ?? false;
  return <ImageParagraph src={src} alt={alt} isMobile={isMobile} />;
}

function ImageParagraphWithComments({
  src,
  alt,
  postId,
  paragraphId,
  paragraphIndex,
  coAuthorUserId,
  isAdmin,
  initialCount,
  mobileHighlightStyle = "badges",
}: {
  src: string;
  alt: string;
  postId: string;
  paragraphId: string;
  paragraphIndex: number;
  coAuthorUserId?: string | null;
  isAdmin: boolean;
  initialCount: number;
  mobileHighlightStyle?: "badges" | "border";
}) {
  const isMobile = useContext(IsMobileContext) ?? false;

  const commentSlot = (
    <LazyParagraphCommentWidget
      postId={postId}
      paragraphId={paragraphId}
      paragraphIndex={paragraphIndex}
      coAuthorUserId={coAuthorUserId}
      isAdmin={isAdmin}
      isMobile={isMobile}
      initialCount={initialCount}
      paragraphProps={{}}
      mobileHighlightStyle={mobileHighlightStyle}
    >
      <span />
    </LazyParagraphCommentWidget>
  );

  return (
    <ImageParagraph
      src={src}
      alt={alt}
      isMobile={isMobile}
      paragraphCommentSlot={commentSlot}
      initialCommentCount={initialCount}
    />
  );
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
  mobileHighlightStyle?: "badges" | "border";
  isAdmin: boolean;
  isEditing?: boolean;
  contentRef?: RefObject<HTMLDivElement | null>;
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
  mobileHighlightStyle,
  isAdmin,
  isEditing = false,
  contentRef,
}: PostContentClientProps) {
  const { userId } = useAuth();
  const isMobile = useContext(IsMobileContext) ?? false;
  const summaryMap = useCommentsSummary(postId);
  const { highlights, addHighlight, removeHighlight } = useHighlights(postId);
  const openCommentsFnsRef = useRef<Map<string, () => Promise<void>>>(new Map());
  let paragraphIndex = 0;

  type ReplaceReturn = ReturnType<NonNullable<HTMLReactParserOptions["replace"]>>;

  const parserOptions: HTMLReactParserOptions = {};

  function extractSingleImage(node: Element): { src: string; alt: string } | null {
    const children = (node.children ?? []).filter(
      (c: any) => c.type !== "text" || c.data?.trim() !== "",
    );
    if (children.length !== 1) return null;
    const child = children[0] as any;
    if (child.type !== "tag" || child.name !== "img") return null;
    const src = child.attribs?.src ?? "";
    const alt = child.attribs?.alt ?? "";
    if (!src) return null;
    return { src, alt };
  }

  parserOptions.replace = (node: DOMNode): ReplaceReturn => {
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

    if (node.type === "tag" && node.name === "p" && !isEditing) {
      const element = node as Element;
      const imageData = extractSingleImage(element);

      if (imageData) {
        const currentIndex = paragraphIndex;
        paragraphIndex += 1;
        const paragraphId = `${postId}-paragraph-${currentIndex}`;
        const initialCount = summaryMap.get(paragraphId) ?? 0;

        if (paragraphCommentsEnabled) {
          return (
            <ImageParagraphWithComments
              key={paragraphId}
              src={imageData.src}
              alt={imageData.alt}
              postId={postId}
              paragraphId={paragraphId}
              paragraphIndex={currentIndex}
              coAuthorUserId={coAuthorUserId}
              isAdmin={isAdmin}
              initialCount={initialCount}
              mobileHighlightStyle={mobileHighlightStyle}
            />
          );
        }

        return (
          <ImageParagraphWithoutComments
            key={paragraphId}
            src={imageData.src}
            alt={imageData.alt}
          />
        );
      }
    }

    if (node.type === "tag" && node.name === "p" && paragraphCommentsEnabled && !isEditing) {
      const element = node as Element;
      const currentIndex = paragraphIndex;
      paragraphIndex += 1;

      return renderParagraphWithComments(
        element,
        parserOptions,
        currentIndex,
        { postId, coAuthorUserId, isAdmin, mobileHighlightStyle },
        summaryMap,
        {
          highlights,
          userId,
          isMobile,
          mobileHighlightStyle: mobileHighlightStyle ?? "badges",
          openCommentsFnsRef,
          onHighlightSaved: addHighlight,
          onHighlightDeleted: removeHighlight,
        }
      );
    }

    if (node.type === "tag" && node.name === "p" && !paragraphCommentsEnabled) {
      const element = node as Element;
      return renderParagraphWithoutComments(element, parserOptions);
    }

    return undefined;
  };

  const parsedContent = htmlContent ? parse(htmlContent, parserOptions) : <p>Conteúdo não disponível.</p>;

  return (
    <PostContentShell
      postId={postId}
      date={date}
      readingTime={readingTime}
      initialViews={initialViews}
      audioUrl={audioUrl}
      isEditing={isEditing}
      contentRef={contentRef}
    >
      <SectionAttentionTracker postId={postId} />
      <HeatmapProgressBar postId={postId} />
      {parsedContent}
    </PostContentShell>
  );
}
