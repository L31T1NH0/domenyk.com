"use client"

import { PaperAirplaneIcon } from "@heroicons/react/24/outline"
import { useCallback, useEffect, useRef, useState } from "react"
import type { LexicalEditor as LexicalEditorInstance } from "lexical"
import { LexicalEditor, readMarkdownFromEditor } from "@/components/editor/LexicalEditor"
import {
  RICH_COMPOSER_DEFAULT_BORDER_CLASS_NAME,
  RICH_COMPOSER_FRAME_CLASS_NAME,
  RICH_COMPOSER_SUBMIT_CLASS_NAME,
} from "@/components/editor/composerStyles"

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
      className={RICH_COMPOSER_SUBMIT_CLASS_NAME}
    >
      <PaperAirplaneIcon className="size-3.5" aria-hidden />
      {submitting ? submittingLabel : submitLabel}
    </button>
  )

  return (
    <div
      className={[
        RICH_COMPOSER_FRAME_CLASS_NAME,
        compact ? "border-neutral-950/15 dark:border-white/15" : RICH_COMPOSER_DEFAULT_BORDER_CLASS_NAME,
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
