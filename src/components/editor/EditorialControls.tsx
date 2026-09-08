"use client"

import { useEffect, useRef, useState } from "react"
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext"
import { $getSelection, $setSelection, $isRangeSelection, $isElementNode, $isParagraphNode, type RangeSelection, type ElementNode, type ElementFormatType } from "lexical"
import { $isHeadingNode, $isQuoteNode } from "@lexical/rich-text"
import { Bars3BottomLeftIcon, Bars3BottomRightIcon, Bars3Icon, Bars2Icon, ArrowsUpDownIcon, PaintBrushIcon, BackspaceIcon } from "@heroicons/react/24/outline"
import { ToolbarButton } from "./ToolbarButton"
import { EditorToolbarMenu } from "./EditorToolbarMenu"
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
  const choices = (values: readonly string[], unit: string) => values.map(n => ({ value: n, label: n === "auto" ? "Padrão" : `${n}${unit}` }))

  return <div className="editorial-toolbar-group editor-toolbar-section" role="group" aria-label="Formatação de parágrafo">
    <EditorToolbarMenu accessibleLabel="Tamanho do texto" label={value.size === "auto" ? "Tamanho" : `${value.size}px`} value={value.size} onChange={size => update({ size })} options={choices(TEXT_SIZES, " px")} variant={variant} />
    <EditorToolbarMenu accessibleLabel="Alinhamento do texto" icon={<AlignmentIcon className="size-4" />} label="Alinhar" value={value.align} onChange={align => update({ align })} options={[
      { value: "left", label: "Esquerda", icon: <Bars3BottomLeftIcon className="size-4" /> },
      { value: "center", label: "Centralizado", icon: <Bars2Icon className="size-4" /> },
      { value: "right", label: "Direita", icon: <Bars3BottomRightIcon className="size-4" /> },
      { value: "justify", label: "Justificado", icon: <Bars3Icon className="size-4" /> },
    ]} variant={variant} />
    <EditorToolbarMenu accessibleLabel="Entrelinha" icon={<ArrowsUpDownIcon className="size-4" />} label="Entrelinha" value={value.leading} onChange={leading => update({ leading })} options={choices(TEXT_LEADING, "")} variant={variant} />
    <EditorToolbarMenu accessibleLabel="Espaço após o parágrafo" icon={<Bars3Icon className="size-4" />} label="Espaço" value={value.spacing} onChange={spacing => update({ spacing })} options={choices(TEXT_SPACING, " px")} variant={variant} />
    <EditorToolbarMenu accessibleLabel="Cor de fundo do parágrafo" icon={<PaintBrushIcon className="size-4" />} label="Fundo" value={value.tone} onChange={tone => update({ tone })} options={[
      { value: "none", label: "Sem fundo" }, { value: "neutral", label: "Neutro" }, { value: "sand", label: "Areia" }, { value: "rose", label: "Rosa" }, { value: "blue", label: "Azul" },
    ]} variant={variant} />
    <ToolbarButton variant={variant} title="Restaurar formatação do parágrafo" onClick={() => update(DEFAULT_EDITORIAL_TEXT)}>
      <BackspaceIcon className="size-4" aria-hidden />
    </ToolbarButton>
  </div>
}
