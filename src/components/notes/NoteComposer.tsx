"use client"

import { LinkIcon, PaperAirplaneIcon, XMarkIcon } from "@heroicons/react/24/outline"
import { useCallback, useRef, useState } from "react"
import type { LexicalEditor as LexicalEditorInstance } from "lexical"
import { LexicalEditor, readMarkdownFromEditor } from "@/components/editor/LexicalEditor"
import {
  RICH_COMPOSER_DEFAULT_BORDER_CLASS_NAME,
  RICH_COMPOSER_FRAME_CLASS_NAME,
  RICH_COMPOSER_SUBMIT_CLASS_NAME,
} from "@/components/editor/composerStyles"
import type { SerializedNote } from "@/lib/db/notes"
import { noteDisplayTitle } from "@/lib/seo"

type Props = {
  onPosted: (note: SerializedNote) => void
  submitEndpoint?: string
  threadParent?: SerializedNote | null
  onCancelThread?: () => void
}

export function NoteComposer({
  onPosted,
  submitEndpoint = "/api/admin/notes",
  threadParent = null,
  onCancelThread,
}: Props) {
  const [content, setContent] = useState("")
  const [title, setTitle] = useState("")
  const [editorKey, setEditorKey] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const lexicalEditorRef = useRef<LexicalEditorInstance | null>(null)

  const handleContentChange = useCallback((markdown: string) => {
    setContent(markdown)
  }, [])

  async function submit() {
    const currentContent = lexicalEditorRef.current
      ? readMarkdownFromEditor(lexicalEditorRef.current)
      : content.trim()

    if (!currentContent || submitting) return
    setSubmitting(true)
    setError("")
    try {
      const res = await fetch(submitEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim() || undefined,
          content: currentContent,
          ...(threadParent ? { continueFromNoteId: threadParent._id } : {}),
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error ?? "Não foi possível postar a nota.")
      }
      const note = await res.json()
      onPosted(note)
      setContent("")
      setTitle("")
      setEditorKey((key) => key + 1)
      onCancelThread?.()
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Não foi possível postar a nota.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="pb-3">
      <div className="flex">
        <div className="min-w-0 flex-1">
          {threadParent && (
            <div className="mb-2 flex items-start gap-2 rounded-lg bg-neutral-950/[0.05] px-3 py-2 text-xs text-neutral-700 dark:bg-white/[0.07] dark:text-[#d8d4ce]">
              <LinkIcon className="size-3.5 shrink-0" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block truncate">
                  Continuando a thread de <strong className="font-semibold text-neutral-950 dark:text-[#f1f1f1]">{noteDisplayTitle(threadParent)}</strong>
                </span>
                <span className="mt-0.5 block text-neutral-600 dark:text-[#A8A095]">
                  Escreva uma nova parte ou linke uma nota existente na timeline.
                </span>
              </span>
              <button
                type="button"
                onClick={onCancelThread}
                aria-label="Cancelar continuação da thread"
                className="grid size-7 shrink-0 place-items-center rounded-full text-neutral-600 transition-colors hover:bg-neutral-950/10 hover:text-neutral-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500 dark:text-[#c2bbb1] dark:hover:bg-white/10 dark:hover:text-white dark:focus-visible:ring-neutral-300"
              >
                <XMarkIcon className="size-3.5" aria-hidden />
              </button>
            </div>
          )}
          <div
            className={`${RICH_COMPOSER_FRAME_CLASS_NAME} ${RICH_COMPOSER_DEFAULT_BORDER_CLASS_NAME}`}
            onKeyDown={(event) => {
              if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                event.preventDefault()
                void submit()
              }
            }}
          >
            <label className="sr-only" htmlFor="note-title">Título da nota</label>
            <input
              id="note-title"
              value={title}
              maxLength={120}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Título (opcional)"
              className="w-full border-b border-neutral-950/[0.08] bg-transparent px-3 py-3 text-sm font-medium text-neutral-950 outline-none placeholder:text-neutral-500 dark:border-white/10 dark:text-[#f1f1f1] dark:placeholder:text-neutral-400"
            />
            <LexicalEditor
              key={editorKey}
              namespace="NoteEditor"
              initialMarkdown=""
              onChange={handleContentChange}
              placeholder={threadParent ? "Continue a thread..." : "O que está acontecendo?"}
              shellClassName="min-h-18 px-3 py-3"
              editorClassName="min-h-18 text-sm"
              placeholderClassName="left-3 top-3 text-sm"
              toolbarVariant="comment"
              toolbarPlacement="bottom"
              toolbarTrailingContent={(
                <button
                  type="button"
                  onClick={() => void submit()}
                  disabled={submitting || !content.trim()}
                  className={RICH_COMPOSER_SUBMIT_CLASS_NAME}
                >
                  <PaperAirplaneIcon className="size-3.5" aria-hidden />
                  {submitting ? "Postando" : threadParent ? "Adicionar à thread" : "Postar"}
                </button>
              )}
              onChangeDelayMs={160}
              editorRef={lexicalEditorRef}
            />
          </div>

          {error && <p role="alert" className="mt-2 text-xs text-red-700 dark:text-red-300">{error}</p>}
        </div>
      </div>
    </div>
  )
}
