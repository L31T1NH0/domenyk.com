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
  LazyParagraphCommentWidget,
  type ParagraphCommentWidgetProps,
} from "./post-content-interactive";
import { useCallback, useEffect, useMemo, useRef, useState, type HTMLAttributes } from "react";

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
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentHtmlContent, setCurrentHtmlContent] = useState(htmlContent);
  const editableContentRef = useRef<HTMLDivElement | null>(null);
  const draftHtmlRef = useRef(htmlContent);

  useEffect(() => {
    setCurrentHtmlContent(htmlContent);
    draftHtmlRef.current = htmlContent;
  }, [htmlContent]);

  useEffect(() => {
    if (!isEditing) {
      return;
    }

    const element = editableContentRef.current;
    if (element) {
      element.innerHTML = draftHtmlRef.current;
    }
  }, [isEditing]);

  const handleInput = useCallback(() => {
    const element = editableContentRef.current;
    if (element) {
      draftHtmlRef.current = element.innerHTML;
    }
  }, []);

  const handleEnterEdit = useCallback(() => {
    if (!isAdmin) return;
    setError(null);
    setIsEditing(true);
  }, [isAdmin]);

  const normalizeMarkdownFromText = useCallback((rawText: string): string => {
    const normalizedLines = rawText
      .replace(/\u00a0/g, " ")
      .split(/\r?\n/)
      .map((line) => line.trim());

    const paragraphs: string[] = [];
    let buffer: string[] = [];

    normalizedLines.forEach((line) => {
      if (line === "") {
        if (buffer.length > 0) {
          paragraphs.push(buffer.join(" ").trim());
          buffer = [];
        }
      } else {
        buffer.push(line);
      }
    });

    if (buffer.length > 0) {
      paragraphs.push(buffer.join(" ").trim());
    }

    return paragraphs.join("\n\n");
  }, []);

  const handleCancelEdit = useCallback(() => {
    setIsEditing(false);
    setError(null);
    draftHtmlRef.current = currentHtmlContent;
    const element = editableContentRef.current;
    if (element) {
      element.innerHTML = currentHtmlContent;
    }
  }, [currentHtmlContent]);

  const handleSave = useCallback(async () => {
    const element = editableContentRef.current;
    const updatedHtml = draftHtmlRef.current ?? currentHtmlContent;
    const updatedMarkdown = element
      ? normalizeMarkdownFromText(element.innerText)
      : normalizeMarkdownFromText(updatedHtml);

    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/posts/${postId}/edit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          htmlContent: updatedHtml,
          markdownContent: updatedMarkdown,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        const message =
          typeof payload.error === "string"
            ? payload.error
            : "Não foi possível salvar as alterações.";
        throw new Error(message);
      }

      const payload = await response.json().catch(() => ({}));
      const nextHtmlContent =
        typeof payload.htmlContent === "string" ? payload.htmlContent : updatedHtml;

      draftHtmlRef.current = nextHtmlContent;
      setCurrentHtmlContent(nextHtmlContent);
      setIsEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao salvar alterações.");
    } finally {
      setIsSaving(false);
    }
  }, [currentHtmlContent, normalizeMarkdownFromText, postId]);

  const editFooter = useMemo(() => {
    if (!isAdmin) {
      return null;
    }

    if (isEditing) {
      return (
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="rounded border border-zinc-300 px-3 py-1 text-xs font-medium text-zinc-800 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-800"
            >
              {isSaving ? "Salvando..." : "Salvar alterações"}
            </button>
            <button
              type="button"
              onClick={handleCancelEdit}
              disabled={isSaving}
              className="rounded border border-transparent px-3 py-1 text-xs text-zinc-600 transition hover:text-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 dark:text-zinc-300 dark:hover:text-zinc-100"
            >
              Cancelar
            </button>
          </div>
          {error ? <span className="text-xs text-red-500">{error}</span> : null}
        </div>
      );
    }

    return (
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleEnterEdit}
          className="text-xs text-zinc-500 underline decoration-dotted underline-offset-2 transition hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          Editar
        </button>
      </div>
    );
  }, [error, handleCancelEdit, handleEnterEdit, handleSave, isAdmin, isEditing, isSaving]);

  const editingContent = useMemo(() => {
    if (!isEditing) {
      return null;
    }

    return (
      <div
        ref={editableContentRef}
        contentEditable
        suppressContentEditableWarning
        className="contents"
        onInput={handleInput}
        style={{ outline: "none" }}
      />
    );
  }, [handleInput, isEditing]);

  const parserOptions = useMemo(() => {
    let paragraphIndex = 0;

    type ReplaceReturn = ReturnType<NonNullable<HTMLReactParserOptions["replace"]>>;

    const options: HTMLReactParserOptions = {};

    options.replace = (node: DOMNode): ReplaceReturn => {
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
        const currentIndex = paragraphIndex;
        paragraphIndex += 1;

        return renderParagraphWithComments(element, options, currentIndex, {
          postId,
          coAuthorUserId,
          isAdmin,
        });
      }

      if (node.type === "tag" && node.name === "p" && !paragraphCommentsEnabled) {
        const element = node as Element;
        return renderParagraphWithoutComments(element, options);
      }

      return undefined;
    };

    return options;
  }, [coAuthorImageUrl, coAuthorUserId, isAdmin, paragraphCommentsEnabled, postId]);

  const parsedContent = useMemo(
    () =>
      currentHtmlContent
        ? parse(currentHtmlContent, parserOptions)
        : <p>Conteúdo não disponível.</p>,
    [currentHtmlContent, parserOptions],
  );

  return (
    <PostContentShell
      postId={postId}
      date={date}
      readingTime={readingTime}
      initialViews={initialViews}
      audioUrl={audioUrl}
      footerSlot={editFooter}
    >
      {isEditing ? editingContent : parsedContent}
    </PostContentShell>
  );
}
