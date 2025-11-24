"use client";

import { useCallback, useMemo, useRef, useState } from "react";

import { BackHome } from "@components/back-home";
import Comment from "@components/Comment";

import PostContentClient from "./post-content-client";

export type PostEditingClientProps = {
  postId: string;
  title: string;
  date: string;
  initialHtmlContent: string;
  initialViews: number;
  audioUrl?: string;
  readingTime: string;
  coAuthorUserId?: string | null;
  coAuthorImageUrl?: string | null;
  paragraphCommentsEnabled: boolean;
  isAdmin: boolean;
  initialMarkdown: string;
};

export default function PostEditingClient({
  postId,
  title,
  date,
  initialHtmlContent,
  initialViews,
  audioUrl,
  readingTime,
  coAuthorUserId,
  coAuthorImageUrl,
  paragraphCommentsEnabled,
  isAdmin,
  initialMarkdown,
}: PostEditingClientProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [markdownValue, setMarkdownValue] = useState(initialMarkdown);
  const [lastSavedMarkdown, setLastSavedMarkdown] = useState(initialMarkdown);
  const [htmlContent, setHtmlContent] = useState(initialHtmlContent);
  const [lastSavedHtml, setLastSavedHtml] = useState(initialHtmlContent);
  const [saveError, setSaveError] = useState<string | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);

  const extractMarkdownFromNode = useCallback((node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) {
      return (node.textContent ?? "").replace(/\s+/g, " ").trim();
    }

    if (!(node instanceof HTMLElement)) {
      return "";
    }

    const serializeInline = (element: HTMLElement): string => {
      let result = "";
      element.childNodes.forEach((child) => {
        if (child.nodeType === Node.TEXT_NODE) {
          result += child.textContent;
          return;
        }

        if (!(child instanceof HTMLElement)) {
          return;
        }

        if (child.tagName === "BR") {
          result += "\n";
          return;
        }

        if (child.tagName === "A") {
          const text = serializeInline(child);
          const href = child.getAttribute("href") || "";
          result += href ? `[${text}](${href})` : text;
          return;
        }

        result += serializeInline(child);
      });
      return result;
    };

    const serializeBlock = (element: HTMLElement): string => {
      const tag = element.tagName.toLowerCase();
      const content = serializeInline(element).trim();

      if (!content) {
        return "";
      }

      if (tag === "h1") return `# ${content}`;
      if (tag === "h2") return `## ${content}`;
      if (tag === "h3") return `### ${content}`;
      if (tag === "h4") return `#### ${content}`;
      if (tag === "h5") return `##### ${content}`;
      if (tag === "h6") return `###### ${content}`;
      if (tag === "li") return content;
      if (tag === "blockquote") {
        return content
          .split(/\n+/)
          .map((line) => `> ${line.trim()}`)
          .join("\n");
      }
      if (tag === "ul") {
        return Array.from(element.children)
          .map((child) => `- ${serializeBlock(child as HTMLElement)}`)
          .join("\n");
      }
      if (tag === "ol") {
        return Array.from(element.children)
          .map((child, index) => `${index + 1}. ${serializeBlock(child as HTMLElement)}`)
          .join("\n");
      }

      return content;
    };

    return serializeBlock(node);
  }, []);

  const editorActions = useMemo(() => {
    if (!isEditing) {
      return (
        <button
          type="button"
          onClick={() => {
            setSaveError(null);
            setIsEditing(true);
          }}
          className="inline-flex items-center gap-2 rounded-full bg-purple-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-purple-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 dark:bg-purple-500 dark:hover:bg-purple-400"
          aria-label={`Editar post ${title ? `"${title}"` : "atual"}`}
        >
          <span className="leading-none">Editar post</span>
        </button>
      );
    }

    return (
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <button
          type="button"
          onClick={async () => {
            setSaveError(null);
            setIsSaving(true);
            try {
              const container = contentRef.current;
              const nextMarkdown = container
                ? Array.from(container.childNodes)
                    .map((node) => extractMarkdownFromNode(node))
                    .filter((value) => value.trim() !== "")
                    .join("\n\n")
                : markdownValue;

              setMarkdownValue(nextMarkdown);

              const response = await fetch(`/api/posts/${postId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ markdownContent: nextMarkdown }),
              });

              if (!response.ok) {
                const payload = (await response.json().catch(() => null)) as
                  | { error?: string }
                  | null;
                throw new Error(payload?.error || "Falha ao salvar alterações");
              }

              const payload = (await response.json()) as {
                htmlContent?: string;
                markdownContent?: string;
              };

              if (typeof payload.markdownContent === "string") {
                setMarkdownValue(payload.markdownContent);
                setLastSavedMarkdown(payload.markdownContent);
              }
              if (typeof payload.htmlContent === "string") {
                setHtmlContent(payload.htmlContent);
                setLastSavedHtml(payload.htmlContent);
              }

              setIsEditing(false);
            } catch (error) {
              console.error(error);
              setSaveError(
                error instanceof Error ? error.message : "Erro ao salvar"
              );
            } finally {
              setIsSaving(false);
            }
          }}
          disabled={isSaving}
          className="inline-flex items-center rounded-full bg-emerald-500 px-4 py-2 font-semibold text-emerald-950 transition hover:bg-emerald-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isSaving ? "Salvando..." : "Salvar alterações"}
        </button>
        <button
          type="button"
          onClick={() => {
            setMarkdownValue(lastSavedMarkdown);
            setHtmlContent(lastSavedHtml);
            setIsEditing(false);
            setSaveError(null);
          }}
          className="inline-flex items-center rounded-full border border-zinc-700 px-4 py-2 font-semibold text-zinc-200 transition hover:border-zinc-500 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500"
        >
          Cancelar
        </button>
        {saveError && (
          <span className="text-sm font-medium text-red-400">{saveError}</span>
        )}
      </div>
    );
  }, [
    extractMarkdownFromNode,
    isEditing,
    isSaving,
    lastSavedMarkdown,
    lastSavedHtml,
    markdownValue,
    postId,
    saveError,
    title,
  ]);

  return (
    <>
      <PostContentClient
        postId={postId}
        date={date}
        htmlContent={htmlContent}
        initialViews={initialViews}
        audioUrl={audioUrl}
        readingTime={readingTime}
        coAuthorUserId={coAuthorUserId}
        coAuthorImageUrl={coAuthorImageUrl}
        paragraphCommentsEnabled={paragraphCommentsEnabled}
        isAdmin={isAdmin}
        isEditing={isEditing}
        contentRef={contentRef}
      />
      <BackHome />
      {isAdmin && (
        <div className="mt-4 sm:mt-6 mb-2">
          {editorActions}
        </div>
      )}
      <div className="mt-4 sm:mt-6 mb-6">
        <Comment
          postId={postId}
          coAuthorUserId={coAuthorUserId ?? undefined}
          isAdmin={isAdmin}
        />
      </div>
    </>
  );
}
