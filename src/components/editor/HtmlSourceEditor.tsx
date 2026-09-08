"use client"

import { useEffect, useState } from "react"
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext"
import { readHtmlBodyFromEditor, readHtmlFromEditor, updateHtmlSource } from "./html-content"

import { PublicationPreview } from "./PublicationPreview"

export function HtmlSourceEditor({ className }: { className?: string }) {
  const [editor] = useLexicalComposerContext()
  const [source, setSource] = useState(() => readHtmlBodyFromEditor(editor))

  const [content, setContent] = useState(() => readHtmlFromEditor(editor))
  useEffect(() => editor.registerUpdateListener(() => {
    setSource(readHtmlBodyFromEditor(editor))
    setContent(readHtmlFromEditor(editor))
  }), [editor])

  return (
    <div className="html-source-workspace">
      <div className="html-source-heading">
        <span>HTML da publicação</span>
        <small>O CSS fica restrito ao espaço desta publicação.</small>
      </div>
      <textarea
        aria-label="Código HTML da publicação"
        value={source}
        onChange={event => {
          const value = event.target.value
          setSource(value)
          updateHtmlSource(editor, value)
        }}
        className={["html-source-editor", className].filter(Boolean).join(" ")}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
      />
      <PublicationPreview content={content} />
    </div>
  )
}
