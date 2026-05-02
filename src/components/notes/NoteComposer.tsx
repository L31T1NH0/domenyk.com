"use client"

import { PaperAirplaneIcon } from "@heroicons/react/24/outline"
import { useCallback, useState } from "react"
import { LexicalEditor } from "@/components/editor/LexicalEditor"
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

  const handleContentChange = useCallback((markdown: string) => {
    setContent(markdown)
  }, [])

  async function submit() {
    if (!content.trim() || submitting) return
    setSubmitting(true)
    setError("")
    const res = await fetch(submitEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: content.trim() }),
    })
    if (res.ok) {
      const note = await res.json()
      onPosted(note)
      setContent("")
      setEditorKey((key) => key + 1)
    } else {
      const data = await res.json().catch(() => null)
      setError(data?.error ?? "Não foi possível postar a nota.")
    }
    setSubmitting(false)
  }

  return (
    <div className="pb-3">
      <div className="flex">
        <div className="min-w-0 flex-1">
          <div
            className="rounded-2xl border border-white/10 bg-white/[0.03] shadow-[0_1px_0_rgba(255,255,255,0.05)_inset] transition-colors focus-within:border-[#A8A095]/45 focus-within:bg-white/[0.045]"
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
            />
          </div>

          <div className="mt-3 flex items-center justify-end">
            <button
              type="button"
              onClick={submit}
              disabled={submitting || !content.trim()}
              className="inline-flex h-9 items-center gap-2 rounded-full bg-[#f1f1f1] px-4 text-sm font-semibold text-[#040404] transition-colors hover:bg-[#A8A095] disabled:cursor-not-allowed disabled:bg-white/25 disabled:text-white/50"
            >
              <PaperAirplaneIcon className="size-4" aria-hidden />
              {submitting ? "Postando" : "Postar"}
            </button>
          </div>

          {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
        </div>
      </div>
    </div>
  )
}
