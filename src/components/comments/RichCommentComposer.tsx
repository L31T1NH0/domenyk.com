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

  return (
    <div
      className={[
        "overflow-hidden rounded-lg border transition-colors focus-within:ring-1",
        compact
          ? "border-neutral-950/15 bg-white/70 focus-within:border-[#E00070]/60 focus-within:ring-[#E00070]/20 dark:border-white/15 dark:bg-white/[0.04]"
          : "border-neutral-200 bg-transparent focus-within:border-neutral-300 focus-within:ring-neutral-300 dark:border-white/10 dark:focus-within:ring-[#A8A095]/40",
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
        shellClassName={compact ? "min-h-16 px-2 py-2" : "min-h-20 px-3 py-2"}
        editorClassName={compact ? "min-h-16 text-xs" : "min-h-20 text-xs"}
        toolbarVariant="compact"
        toolbarPlacement="bottom"
        imageUploadEndpoint="/api/comments/media"
        allowImageAssetLibrary={false}
        onChangeDelayMs={120}
        editorRef={editorRef}
      />
      <div className={compact ? "flex justify-end px-2 pb-2" : "flex justify-end px-2 pb-2"}>
        <button
          type="button"
          onClick={() => void submit()}
          disabled={submitting || !draft.trim()}
          className={[
            "inline-flex items-center gap-1.5 rounded-full font-medium transition disabled:cursor-not-allowed disabled:opacity-40",
            compact
              ? "bg-neutral-950 px-3 py-1.5 text-xs text-white hover:bg-[#E00070] dark:bg-[#f1f1f1] dark:text-[#040404] dark:hover:bg-[#E00070] dark:hover:text-white"
              : "bg-neutral-950 px-3 py-1.5 text-xs text-white dark:bg-[#f1f1f1] dark:text-[#080808]",
          ].join(" ")}
        >
          <PaperAirplaneIcon className="size-3.5" aria-hidden />
          {submitting ? submittingLabel : submitLabel}
        </button>
      </div>
    </div>
  )
}
