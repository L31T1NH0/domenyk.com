"use client"

import { PaperAirplaneIcon } from "@heroicons/react/24/outline"
import { useCallback, useRef, useState } from "react"
import type { LexicalEditor as LexicalEditorInstance } from "lexical"
import { LexicalEditor, readMarkdownFromEditor } from "@/components/editor/LexicalEditor"
import type { SerializedNote } from "@/lib/db/notes"

type Props = {
  onPosted: (note: SerializedNote) => void
  submitEndpoint?: string
}

export function NoteComposer({
  onPosted,
  submitEndpoint = "/api/admin/notes",
}: Props) {
  const [content, setContent] = useState("")
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
        body: JSON.stringify({ content: currentContent }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error ?? "Não foi possível postar a nota.")
      }
      const note = await res.json()
      onPosted(note)
      setContent("")
      setEditorKey((key) => key + 1)
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
          <div
            className="rounded-2xl border border-neutral-200 bg-white shadow-[0_1px_0_rgba(0,0,0,0.04)_inset] transition-colors focus-within:border-neutral-400 focus-within:bg-white dark:border-white/10 dark:bg-white/[0.03] dark:shadow-[0_1px_0_rgba(255,255,255,0.05)_inset] dark:focus-within:border-[#A8A095]/45 dark:focus-within:bg-white/[0.045]"
            onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit() }}
          >
            <LexicalEditor
              key={editorKey}
              namespace="NoteEditor"
              initialMarkdown=""
              onChange={handleContentChange}
              placeholder="O que está acontecendo?"
              shellClassName="min-h-28 px-4 py-3"
              editorClassName="min-h-28 text-[15px]"
              toolbarVariant="compact"
              toolbarPlacement="bottom"
              onChangeDelayMs={160}
              editorRef={lexicalEditorRef}
            />
          </div>

          <div className="mt-3 flex items-center justify-end">
            <button
              type="button"
              onClick={submit}
              disabled={submitting || !content.trim()}
              className="inline-flex h-9 items-center gap-2 rounded-full bg-neutral-950 px-4 text-sm font-semibold text-white transition-colors hover:bg-neutral-700 disabled:cursor-not-allowed disabled:bg-neutral-200 disabled:text-neutral-400 dark:bg-[#f1f1f1] dark:text-[#040404] dark:hover:bg-[#A8A095] dark:disabled:bg-white/25 dark:disabled:text-white/50"
            >
              <PaperAirplaneIcon className="size-4" aria-hidden />
              {submitting ? "Postando" : "Postar"}
            </button>
          </div>

          {error && <p role="alert" className="mt-2 text-xs text-red-700 dark:text-red-300">{error}</p>}
        </div>
      </div>
    </div>
  )
}
