"use client"

import { useEffect, useId, useRef, useState } from "react"
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext"
import { $getRoot, $getState, $setState, type LexicalEditor } from "lexical"
import { ToolbarButton } from "./ToolbarButton"
import { publicationCssState, readHtmlFromEditor } from "./html-content"
import { compilePublicationCss, MAX_PUBLICATION_CSS } from "@/lib/publication-css"
import { PublicationPreview } from "./PublicationPreview"
import { splitInlineCssHooks } from "@/lib/inline-css-hooks"
import { SAFE_PUBLICATION_HTML_TAGS } from "@/lib/content-format"

type AvailableSelector = {
  selector: string
  label: string
  count: number
  kind: "root" | "tag" | "class" | "hook"
}

const SAFE_HTML_TAGS = new Set<string>(SAFE_PUBLICATION_HTML_TAGS)
const CSS_CLASS_PATTERN = /^[a-zA-Z_][a-zA-Z0-9_-]*$/

function selectorsFromEditor(editor: LexicalEditor): AvailableSelector[] {
  const html = readHtmlFromEditor(editor)
  if (!html) return [{ selector: ":scope", label: ":scope", count: 1, kind: "root" }]

  const document = new DOMParser().parseFromString(html, "text/html")
  const root = document.querySelector<HTMLElement>('[data-editor-document="html"]')
  if (!root) return []
  const counts = new Map<string, AvailableSelector>()
  const add = (selector: string, label: string, kind: AvailableSelector["kind"]) => {
    const current = counts.get(selector)
    if (current) {
      current.count += 1
      return
    }
    counts.set(selector, { selector, label, count: 1, kind })
  }

  root.querySelectorAll("*").forEach(element => {
    const tag = element.tagName.toLowerCase()
    if (!SAFE_HTML_TAGS.has(tag)) return
    add(tag, tag, "tag")
    element.classList.forEach(className => {
      if (CSS_CLASS_PATTERN.test(className)) add(`.${className}`, `.${className}`, "class")
    })
  })

  const selectors: AvailableSelector[] = [
    { selector: ":scope", label: ":scope", count: 1, kind: "root" },
    ...counts.values(),
  ]
  const knownHooks = new Set<string>()
  root.querySelectorAll<HTMLElement>("[data-css-hook]").forEach(element => {
    const hook = element.dataset.cssHook
    if (!hook || knownHooks.has(hook)) return
    knownHooks.add(hook)
    selectors.push({ selector: `[data-css-hook="${hook}"]`, label: `::${hook}::`, count: 1, kind: "hook" })
  })

  const occurrences = new Map<string, number>()
  for (const node of cssHookTextNodes(root)) {
    for (const part of splitInlineCssHooks(node.data, occurrences)) {
      if (part.type !== "hook" || knownHooks.has(part.id)) continue
      knownHooks.add(part.id)
      selectors.push({ selector: `[data-css-hook="${part.id}"]`, label: part.source, count: 1, kind: "hook" })
    }
  }
  return selectors
}

function cssHookTextNodes(root: HTMLElement) {
  const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const textNodes: Text[] = []
  let current = walker.nextNode()
  while (current) {
    if (!current.parentElement?.closest("code, pre, style")) textNodes.push(current as Text)
    current = walker.nextNode()
  }
  return textNodes
}

export function PublicationCssControls({ variant }: { variant?: "default" | "compact" | "comment" }) {
  const [editor] = useLexicalComposerContext()
  const [open, setOpen] = useState(false)
  const [css, setCss] = useState("")
  const [error, setError] = useState("")
  const [preview, setPreview] = useState("")
  const [selectors, setSelectors] = useState<AvailableSelector[]>([])
  const id = useId()
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    let active = true
    let timer: ReturnType<typeof setTimeout> | null = null
    const refresh = () => {
      if (!active) return
      setSelectors(selectorsFromEditor(editor))
    }
    refresh()
    const unregister = editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => setCss($getState($getRoot(), publicationCssState)))
      if (timer) clearTimeout(timer)
      timer = setTimeout(refresh, 120)
    })
    return () => {
      active = false
      if (timer) clearTimeout(timer)
      unregister()
    }
  }, [editor])

  function toggle() {
    editor.getEditorState().read(() => {
      const value = $getState($getRoot(), publicationCssState)
      setCss(value)
    })
    setOpen(value => !value)
  }

  function change(value: string) {
    setCss(value)
    setPreview("")
    setError("")
    // CSS incompleto faz parte do rascunho e só é validado ao publicar.
    editor.update(() => $setState($getRoot(), publicationCssState, value))
  }

  function showPreview() {
    try {
      compilePublicationCss(css, "[data-publication-preview]")
      setPreview(readHtmlFromEditor(editor))
      setError("")
    } catch (error) {
      setError(error instanceof Error ? error.message : "Confira o CSS.")
    }
  }

  function insertSelector(selector: string) {
    const existing = css.indexOf(`${selector} {`)
    if (existing >= 0) {
      textareaRef.current?.focus()
      textareaRef.current?.setSelectionRange(existing, existing + selector.length)
      return
    }

    const rule = `${selector} {\n  \n}`
    const next = css.trim() ? `${css.trimEnd()}\n\n${rule}` : rule
    if (next.length > MAX_PUBLICATION_CSS) {
      setError("O CSS deve ter até 12.000 caracteres.")
      return
    }
    change(next)
    requestAnimationFrame(() => {
      const cursor = next.length - 2
      textareaRef.current?.focus()
      textareaRef.current?.setSelectionRange(cursor, cursor)
    })
  }

  return <>
    <ToolbarButton variant={variant} title="CSS desta publicação" expanded={open} onClick={toggle}><span className="text-[10px] font-bold tracking-tight">CSS</span></ToolbarButton>
    {open && <div className="publication-css-panel" role="group" aria-label="CSS da publicação">
      <label htmlFor={id}>CSS desta publicação</label>
      <p id={`${id}-help`} className="publication-css-help">Use uma tag, classe ou seletor mais específico. <code>:scope</code> representa a área inteira desta publicação.</p>
      <div className="publication-css-selectors" aria-label="Seletores disponíveis no texto">
        <span>Disponíveis neste texto</span>
        <div>{selectors.map(item => <button key={item.selector} type="button" data-css-selector-kind={item.kind} title={`Inserir ${item.selector}`} onClick={() => insertSelector(item.selector)}><code>{item.label}</code>{item.kind !== "hook" && item.kind !== "root" && <small>{item.count}</small>}</button>)}</div>
      </div>
      <p className="publication-css-help">Para um trecho individual, escreva <code>::trecho::</code> ou selecione palavras e use o botão <code>::</code>; use o mesmo botão para remover a marca. Para um nome explícito: <code>::nome|trecho::</code>.</p>
      <textarea ref={textareaRef} id={id} aria-describedby={`${id}-help`} aria-invalid={Boolean(error)} value={css} onChange={event => change(event.target.value)} maxLength={MAX_PUBLICATION_CSS} spellCheck={false} rows={9} placeholder={"p { line-height: 1.8; }\n\n[data-css-hook=\"destaque\"] {\n  color: #e00070;\n}\n\n@media (max-width: 600px) {\n  p { font-size: 16px; }\n}"} />
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={showPreview} className="editorial-control-trigger">Pré-visualizar</button>
        <button type="button" onClick={() => change("")} className="editorial-control-trigger">Limpar CSS</button>
        <span className="ml-auto text-xs text-neutral-500 dark:text-neutral-400">{css.length.toLocaleString("pt-BR")} / 12.000</span>
      </div>
      {error && <p role="alert" className="publication-css-error">{error}</p>}
      {preview && <PublicationPreview content={preview} />}
    </div>}
  </>
}
