"use client"

import { useEffect, useRef, useState } from "react"
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext"
import { $getSelection, $setSelection, $isRangeSelection, $isElementNode, $isParagraphNode, type RangeSelection, type ElementNode, type ElementFormatType } from "lexical"
import { $isHeadingNode, $isQuoteNode } from "@lexical/rich-text"
import { Bars3BottomLeftIcon, Bars3BottomRightIcon, Bars3Icon, Bars2Icon, ArrowsUpDownIcon, PaintBrushIcon, BackspaceIcon, ChevronDownIcon } from "@heroicons/react/24/outline"
import { ToolbarButton } from "./ToolbarButton"
import { DEFAULT_EDITORIAL_TEXT, TEXT_SIZES, TEXT_LEADING, TEXT_SPACING, editorialTextFromStyle, editorialTextStyle, type EditorialText } from "@/lib/editorial-text"

function selectedBlocks(selection: RangeSelection): ElementNode[] {
  const found = new Map<string, ElementNode>()
  for (const selected of [...selection.getNodes(), selection.anchor.getNode()]) {
    let node = $isElementNode(selected) ? selected : selected.getParent()
    while (node && !$isParagraphNode(node) && !$isHeadingNode(node) && !$isQuoteNode(node)) node = node.getParent()
    if (node) found.set(node.getKey(), node)
  }
  return [...found.values()]
}

export function EditorialControls({ variant = "default" }: { variant?: "default" | "compact" | "comment" }) {
  const [editor] = useLexicalComposerContext()
  const [value, setValue] = useState(DEFAULT_EDITORIAL_TEXT)
  const selectionRef = useRef<RangeSelection | null>(null)

  useEffect(() => editor.registerUpdateListener(({ editorState }) => {
    editorState.read(() => {
      const selection = $getSelection()
      if (!$isRangeSelection(selection)) return
      selectionRef.current = selection.clone()
      const first = selectedBlocks(selection)[0]
      if (first) setValue(editorialTextFromStyle(first.getStyle(), first.getFormatType()))
    })
  }), [editor])

  function update(patch: Partial<EditorialText>) {
    editor.update(() => {
      const current = $getSelection()
      const selection = $isRangeSelection(current) ? current : selectionRef.current
      if (!selection) return
      $setSelection(selection.clone())
      for (const block of selectedBlocks(selection)) {
        const next = { ...editorialTextFromStyle(block.getStyle(), block.getFormatType()), ...patch }
        block.setFormat(next.align as ElementFormatType)
        block.setStyle(editorialTextStyle(next))
        setValue(next)
      }
    })
  }

  const AlignmentIcon = value.align === "right" ? Bars3BottomRightIcon : value.align === "center" ? Bars2Icon : value.align === "justify" ? Bars3Icon : Bars3BottomLeftIcon
  const choices = (values: readonly string[], unit: string) => values.map(n => <option key={n} value={n}>{n === "auto" ? "Padrão" : `${n}${unit}`}</option>)

  return <div className={`editorial-toolbar-group editorial-toolbar-${variant}`} role="group" aria-label="Formatação de parágrafo">
    <span className="editorial-toolbar-divider" aria-hidden />
    <label className="editorial-toolbar-size" title="Tamanho do texto">
      <span className="sr-only">Tamanho do texto</span>
      <select value={value.size} onChange={e => update({ size: e.target.value })}>
        <option value="auto">Auto</option>{TEXT_SIZES.filter(n => n !== "auto").map(n => <option key={n} value={n}>{n}</option>)}
      </select>
      <ChevronDownIcon className="size-3" aria-hidden />
    </label>
    <label className="editorial-toolbar-select" title="Alinhamento do texto">
      <AlignmentIcon className="size-4" aria-hidden />
      <span className="sr-only">Alinhamento do texto</span>
      <select value={value.align} onChange={e => update({ align: e.target.value })}>
        <option value="left">Esquerda</option><option value="center">Centralizado</option><option value="right">Direita</option><option value="justify">Justificado</option>
      </select>
    </label>
    <label className="editorial-toolbar-select" title="Entrelinha">
      <ArrowsUpDownIcon className="size-4" aria-hidden />
      <span className="sr-only">Entrelinha</span>
      <select value={value.leading} onChange={e => update({ leading: e.target.value })}>{choices(TEXT_LEADING, "")}</select>
    </label>
    <label className="editorial-toolbar-select" title="Espaço após o parágrafo">
      <Bars3Icon className="size-4" aria-hidden />
      <span className="sr-only">Espaço após o parágrafo</span>
      <select value={value.spacing} onChange={e => update({ spacing: e.target.value })}>{choices(TEXT_SPACING, " px")}</select>
    </label>
    <label className="editorial-toolbar-select" title="Cor de fundo do parágrafo">
      <PaintBrushIcon className="size-4" aria-hidden />
      <span className="editorial-toolbar-swatch" style={{ backgroundColor: value.tone === "none" ? "currentColor" : `var(--editorial-tone-${value.tone})` }} aria-hidden />
      <span className="sr-only">Cor de fundo do parágrafo</span>
      <select value={value.tone} onChange={e => update({ tone: e.target.value })}>
        <option value="none">Sem fundo</option><option value="neutral">Neutro</option><option value="sand">Areia</option><option value="rose">Rosa</option><option value="blue">Azul</option>
      </select>
    </label>
    <ToolbarButton variant={variant} title="Restaurar formatação do parágrafo" onClick={() => update(DEFAULT_EDITORIAL_TEXT)}>
      <BackspaceIcon className="size-4" aria-hidden />
    </ToolbarButton>
  </div>
}
