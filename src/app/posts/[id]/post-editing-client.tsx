"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { BackHome } from "@components/back-home";
import Comment from "@components/Comment";

import PostContentClient from "./post-content-client";
import PostContentShell from "./post-content-interactive";

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
  tags: string[];
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
  tags,
}: PostEditingClientProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [markdownValue, setMarkdownValue] = useState(initialMarkdown);
  const [lastSavedMarkdown, setLastSavedMarkdown] = useState(initialMarkdown);
  const [htmlContent, setHtmlContent] = useState(initialHtmlContent);
  const [lastSavedHtml, setLastSavedHtml] = useState(initialHtmlContent);
  const [saveError, setSaveError] = useState<string | null>(null);
  const markdownTextAreaRef = useRef<HTMLTextAreaElement | null>(null);

  const adjustTextareaHeight = useCallback(() => {
    const textarea = markdownTextAreaRef.current;
    if (!textarea) return;

    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, []);

  useEffect(() => {
    if (isEditing) {
      adjustTextareaHeight();
    }
  }, [adjustTextareaHeight, isEditing, markdownValue]);

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
              const response = await fetch(`/api/posts/${postId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ contentMarkdown: markdownValue }),
              });

              if (!response.ok) {
                const payload = (await response.json().catch(() => null)) as
                  | { error?: string }
                  | null;
                throw new Error(payload?.error || "Falha ao salvar alterações");
              }

              const payload = (await response.json()) as {
                htmlContent?: string;
                contentMarkdown?: string;
              };

              if (typeof payload.contentMarkdown === "string") {
                setMarkdownValue(payload.contentMarkdown);
                setLastSavedMarkdown(payload.contentMarkdown);
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
      {isEditing ? (
        <PostContentShell
          postId={postId}
          date={date}
          readingTime={readingTime}
          initialViews={initialViews}
          audioUrl={audioUrl}
          disableViewTracking
          hideShareButton
        >
          <textarea
            ref={markdownTextAreaRef}
            value={markdownValue}
            onChange={(event) => setMarkdownValue(event.target.value)}
            className="block w-full resize-none whitespace-pre-wrap break-words rounded-2xl border border-transparent bg-transparent px-2 py-1 text-base leading-relaxed text-zinc-100 outline-none ring-0 transition focus:border-purple-400/60 focus:ring-2 focus:ring-purple-400/25"
            style={{ fontFamily: "inherit", minHeight: "120px" }}
            spellCheck={false}
          />
        </PostContentShell>
      ) : (
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
          isEditing={false}
        />
      )}
      <div className="mt-8 border-t border-zinc-200/80 pt-5 dark:border-zinc-700/80">
        {tags.length > 0 && (
          <div className="mb-5 flex flex-wrap items-center gap-2">
            {tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center rounded-full border border-zinc-300/80 px-3 py-1 text-xs font-medium text-zinc-700 dark:border-zinc-600 dark:text-zinc-200"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>
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
