"use client"

import { PaperAirplaneIcon } from "@heroicons/react/24/outline"
import { useCallback, useEffect, useRef, useState } from "react"
import type { LexicalEditor as LexicalEditorInstance } from "lexical"
import { LexicalEditor, readMarkdownFromEditor } from "@/components/editor/LexicalEditor"

type Props = {
  draft: string
  submitting: boolean
  placeholder?: string
  submitLabel?: string
  submittingLabel?: string
  size?: "default" | "compact"
  autoFocus?: boolean
  allowImageUpload?: boolean
  onDraftChange: (draft: string) => void
  onSubmit: (content?: string) => Promise<boolean | void> | boolean | void
}

export function RichCommentComposer({
  draft,
  submitting,
  placeholder = "Escreva um comentário...",
  submitLabel = "Enviar",
  submittingLabel = "Enviando...",
  size = "default",
  autoFocus = false,
  allowImageUpload = false,
  onDraftChange,
  onSubmit,
}: Props) {
  const editorRef = useRef<LexicalEditorInstance | null>(null)
  const [editorKey, setEditorKey] = useState(0)
  const compact = size === "compact"

  useEffect(() => {
    if (!autoFocus) return
    queueMicrotask(() => editorRef.current?.focus())
  }, [autoFocus])

  const handleChange = useCallback((markdown: string) => {
    onDraftChange(markdown)
  }, [onDraftChange])

  async function submit() {
    const content = editorRef.current ? readMarkdownFromEditor(editorRef.current) : draft.trim()
    if (!content || submitting) return

    const posted = await onSubmit(content)
    if (posted !== false) {
      setEditorKey((key) => key + 1)
    }
  }

  const submitButton = (
    <button
      type="button"
      onClick={() => void submit()}
      disabled={submitting || !draft.trim()}
      className="inline-flex min-h-11 items-center gap-1.5 rounded-md bg-neutral-950 px-2.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[#c00060] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E00070]/60 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-[#f1f1f1] dark:text-[#080808] dark:hover:bg-[#E00070] dark:hover:text-white sm:min-h-8"
    >
      <PaperAirplaneIcon className="size-3.5" aria-hidden />
      {submitting ? submittingLabel : submitLabel}
    </button>
  )

  return (
    <div
      className={[
        "rounded-lg border bg-transparent transition-colors focus-within:border-[#E00070]/50 focus-within:ring-1 focus-within:ring-[#E00070]/15",
        compact ? "border-neutral-950/15 dark:border-white/15" : "border-neutral-950/10 dark:border-white/10",
      ].join(" ")}
      onKeyDown={(event) => {
        if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
          event.preventDefault()
          void submit()
        }
      }}
    >
      <LexicalEditor
        key={editorKey}
        namespace={`CommentEditor-${editorKey}-${size}`}
        initialMarkdown=""
        onChange={handleChange}
        placeholder={placeholder}
        shellClassName={compact ? "min-h-14 px-3 py-2.5" : "min-h-18 px-3 py-3"}
        editorClassName={compact ? "min-h-14 text-sm" : "min-h-18 text-sm"}
        placeholderClassName={compact ? "left-3 top-2.5 text-sm" : "left-3 top-3 text-sm"}
        toolbarVariant="comment"
        toolbarPlacement="bottom"
        toolbarTrailingContent={submitButton}
        imageUploadEndpoint="/api/comments/media"
        allowImageAssetLibrary={false}
        allowImages={allowImageUpload}
        onChangeDelayMs={120}
        editorRef={editorRef}
      />
    </div>
  )
}
