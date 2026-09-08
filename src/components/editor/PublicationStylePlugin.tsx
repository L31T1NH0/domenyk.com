"use client"

import { useEffect, useId, useState } from "react"
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext"
import { $getRoot, $getState } from "lexical"
import { publicationCssState } from "./html-content"
import { compilePublicationCss } from "@/lib/publication-css"

export function PublicationStylePlugin() {
  const [editor] = useLexicalComposerContext()
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "")
  const [css, setCss] = useState("")
  useEffect(() => {
    const refresh = () => editor.getEditorState().read(() => {
      try { setCss(compilePublicationCss($getState($getRoot(), publicationCssState), `[data-visual-publication="${id}"]`)) }
      catch { setCss("") }
    })
    refresh()
    const unregisterUpdate = editor.registerUpdateListener(refresh)
    const unregisterRoot = editor.registerRootListener((root, previous) => {
      previous?.removeAttribute("data-visual-publication")
      root?.setAttribute("data-visual-publication", id)
    })
    return () => { unregisterUpdate(); unregisterRoot() }
  }, [editor, id])
  return css ? <style>{css}</style> : null
}
