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
  LazyParagraphCommentWidget,
  type ParagraphCommentWidgetProps,
} from "./post-content-interactive";
import type { HTMLAttributes, RefObject } from "react";

function renderParagraphWithComments(
  node: Element,
  parserOptions: HTMLReactParserOptions,
  paragraphIndex: number,
  options: Pick<ParagraphCommentWidgetProps, "postId" | "coAuthorUserId" | "isAdmin">,
) {
  const paragraphId = `${options.postId}-paragraph-${paragraphIndex}`;
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
    >
      {domToReact((node.children ?? []) as DOMNode[], parserOptions)}
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
  isAdmin,
  isEditing = false,
  contentRef,
}: PostContentClientProps) {
  let paragraphIndex = 0;

  type ReplaceReturn = ReturnType<NonNullable<HTMLReactParserOptions["replace"]>>;

  const parserOptions: HTMLReactParserOptions = {};

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

    if (node.type === "tag" && node.name === "p" && paragraphCommentsEnabled && !isEditing) {
      const element = node as Element;
      const currentIndex = paragraphIndex;
      paragraphIndex += 1;

      return renderParagraphWithComments(element, parserOptions, currentIndex, {
        postId,
        coAuthorUserId,
        isAdmin,
      });
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
      {parsedContent}
    </PostContentShell>
  );
}
