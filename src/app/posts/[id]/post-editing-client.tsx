"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { BackHome } from "@components/back-home";
import Comment from "@components/Comment";

import PostContentClient from "./post-content-client";

type LexicalEditorModule = typeof import("../../../../components/editor/LexicalEditor");

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
  const [LexicalEditor, setLexicalEditor] = useState<
    LexicalEditorModule["default"] | null
  >(null);
  const [editorLoadError, setEditorLoadError] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [markdownValue, setMarkdownValue] = useState(initialMarkdown);
  const [lastSavedMarkdown, setLastSavedMarkdown] = useState(initialMarkdown);
  const [htmlContent, setHtmlContent] = useState(initialHtmlContent);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    import("../../../../components/editor/LexicalEditor")
      .then((mod) => setLexicalEditor(() => mod.default))
      .catch((error) => {
        console.error("Failed to load inline editor", error);
        setEditorLoadError(true);
      });
  }, []);

  const editorActions = useMemo(() => {
    if (editorLoadError) {
      return null;
    }

    if (!isEditing) {
      return (
        <button
          type="button"
          onClick={() => {
            if (!LexicalEditor) {
              setEditorLoadError(true);
              return;
            }
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

    if (!LexicalEditor) {
      return (
        <div className="rounded-xl border border-zinc-800/70 bg-zinc-950/70 p-4 text-sm text-zinc-200">
          Carregando editor...
        </div>
      );
    }

    return (
      <div className="space-y-3 rounded-2xl border border-white/10 bg-zinc-950/80 p-4">
        <LexicalEditor
          value={markdownValue}
          onChange={setMarkdownValue}
          appearance="inline"
        />
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
                  body: JSON.stringify({ markdownContent: markdownValue }),
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
      </div>
    );
  }, [
    LexicalEditor,
    editorLoadError,
    isEditing,
    isSaving,
    lastSavedMarkdown,
    markdownValue,
    postId,
    title,
    saveError,
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
      />
      <BackHome />
      {isAdmin && (
        <div className="mt-4 sm:mt-6 mb-2">
          {editorLoadError ? (
            <Link
              href={`/admin/editor?postId=${encodeURIComponent(postId)}`}
              className="inline-flex items-center gap-2 rounded-full bg-purple-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-purple-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 dark:bg-purple-500 dark:hover:bg-purple-400"
              aria-label={`Editar post ${title ? `"${title}"` : "atual"}`}
            >
              <span className="leading-none">Editar post</span>
            </Link>
          ) : (
            editorActions
          )}
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
