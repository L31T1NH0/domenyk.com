"use client"

import { useId, useRef, useState } from "react"
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext"
import { $getSelection, $setSelection, type BaseSelection } from "lexical"
import { LinkIcon } from "@heroicons/react/24/outline"
import { ToolbarButton } from "./ToolbarButton"
import { $insertEditorBlock } from "./insert-editor-block"
import { $createReadAlsoParagraph, readAlsoUrl } from "./read-also"

export function ReadAlsoPlugin({ variant }: { variant: "default" | "compact" | "comment" }) {
  const [editor] = useLexicalComposerContext()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const selectionRef = useRef<BaseSelection | null>(null)
  const headingId = useId()
  const [url, setUrl] = useState("")
  const [title, setTitle] = useState("")
  const [error, setError] = useState("")

  function open() {
    editor.getEditorState().read(() => { selectionRef.current = $getSelection()?.clone() ?? null })
    setError("")
    dialogRef.current?.showModal()
  }

  function insert() {
    const href = readAlsoUrl(url)
    if (!href || !title.trim()) {
      setError("Preencha o título e um link válido (https://… ou /caminho).")
      return
    }
    dialogRef.current?.close()
    editor.update(() => {
      $setSelection(selectionRef.current)
      $insertEditorBlock($createReadAlsoParagraph(href, title))
    })
    setUrl("")
    setTitle("")
    editor.focus()
  }

  return <>
    <ToolbarButton variant={variant} title="Inserir Leia também" onClick={open}><LinkIcon className="size-4" aria-hidden /></ToolbarButton>
    <dialog ref={dialogRef} aria-labelledby={headingId} className="read-also-dialog m-auto w-[calc(100%-2rem)] max-w-sm rounded-lg border border-neutral-300 bg-white p-5 text-sm text-neutral-900 shadow-xl backdrop:bg-black/40 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100" onKeyDown={event => {
      event.stopPropagation()
      if (event.key === "Enter" && event.target instanceof HTMLInputElement && !event.nativeEvent.isComposing) { event.preventDefault(); insert() }
    }}>
      <h2 id={headingId} className="mb-4 font-semibold">Leia também</h2>
      <label className="mb-3 block">Link do texto
        <input autoFocus type="text" inputMode="url" value={url} onChange={event => setUrl(event.target.value)} placeholder="https://domenyk.com/…" className="mt-1 block w-full rounded border border-neutral-400 bg-transparent p-2" />
      </label>
      <label className="mb-3 block">Título que vai aparecer
        <input type="text" value={title} onChange={event => setTitle(event.target.value)} placeholder="37 anos de silêncio sobre Tiananmen" className="mt-1 block w-full rounded border border-neutral-400 bg-transparent p-2" />
      </label>
      {error && <p role="alert" className="mb-3 text-red-700 dark:text-red-300">{error}</p>}
      <div className="flex justify-end gap-3">
        <button type="button" onClick={() => dialogRef.current?.close()} className="rounded px-3 py-2">Cancelar</button>
        <button type="button" onClick={insert} className="rounded bg-neutral-900 px-3 py-2 text-white dark:bg-neutral-100 dark:text-neutral-900">Inserir</button>
      </div>
    </dialog>
  </>
}
