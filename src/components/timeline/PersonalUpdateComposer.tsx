"use client"

import { useRef, useState } from "react"
import type { LexicalEditor as EditorInstance } from "lexical"
import { assertPublicationCssIsValid, LexicalEditor, readHtmlFromEditor } from "@/components/editor/LexicalEditor"
import { RICH_COMPOSER_FRAME_CLASS_NAME, RICH_COMPOSER_DEFAULT_BORDER_CLASS_NAME, RICH_COMPOSER_SUBMIT_CLASS_NAME } from "@/components/editor/composerStyles"
import type { PersonalUpdate } from "@/lib/personal-timeline"
import { MAX_RICH_CONTENT_LENGTH } from "@/lib/content-format"

export default function PersonalUpdateComposer({ item, onSaved, onCancel }: {
  item?: PersonalUpdate
  onSaved: (item: PersonalUpdate) => void
  onCancel?: () => void
}) {
  const editor = useRef<EditorInstance | null>(null)
  const [content, setContent] = useState(item?.content ?? "")
  const [version, setVersion] = useState(0)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")

  async function submit() {
    if (pending) return
    setError("")
    try {
      if (editor.current) assertPublicationCssIsValid(editor.current)
      const nextContent = editor.current ? readHtmlFromEditor(editor.current).trim() : content.trim()
      if (!nextContent || nextContent.length > MAX_RICH_CONTENT_LENGTH) {
        setError("A publicação ultrapassou o limite de 300.000 caracteres.")
        return
      }
      setPending(true)
      editor.current?.setEditable(false)
      const response = await fetch(item ? `/api/mural/${item._id}` : "/api/mural", {
        method: item ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: nextContent }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(data?.error ?? "Não foi possível publicar. Tente novamente.")
      onSaved(data)
      setContent("")
      setVersion(value => value + 1)
    } catch (error) {
      setError(error instanceof Error ? error.message : "Não foi possível publicar.")
    } finally {
      editor.current?.setEditable(true)
      setPending(false)
    }
  }

  return (
    <div>
      <div className={`${RICH_COMPOSER_FRAME_CLASS_NAME} ${RICH_COMPOSER_DEFAULT_BORDER_CLASS_NAME}`} onKeyDown={event => {
        if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
          event.preventDefault()
          void submit()
        }
      }}>
        <fieldset disabled={pending} className="min-w-0" aria-label={item ? "Editar publicação" : "Nova publicação"}>
          <LexicalEditor
            key={version}
            namespace={`Mural-${item?._id ?? "new"}`}
            initialMarkdown={item?.content ?? ""}
            onChange={setContent}
            editorRef={editor}
            placeholder="O que você quer compartilhar?"
            shellClassName="min-h-28 px-3 py-3"
            editorClassName="min-h-28 text-sm"
            placeholderClassName="left-3 top-3 text-sm"
            toolbarVariant="comment"
            toolbarPlacement="bottom"
            imageUploadEndpoint="/api/mural/media"
            toolbarTrailingContent={(
              <button type="button" disabled={pending || !content.trim()} className={RICH_COMPOSER_SUBMIT_CLASS_NAME} onClick={() => void submit()}>
                {pending ? "Salvando…" : item ? "Salvar" : "Publicar"}
              </button>
            )}
          />
        </fieldset>
      </div>
      {onCancel && <button type="button" disabled={pending} onClick={onCancel} className="personal-timeline-action mt-2">Cancelar edição</button>}
      {error && <p role="alert" className="mt-2 text-sm text-red-700 dark:text-red-300">{error}</p>}
    </div>
  )
}
