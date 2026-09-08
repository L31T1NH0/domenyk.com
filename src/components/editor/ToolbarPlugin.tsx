"use client"

import { useState } from "react"
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext"
import { FORMAT_TEXT_COMMAND, $getRoot, $getSelection, $isRangeSelection, type LexicalNode } from "lexical"
import { $setBlocksType } from "@lexical/selection"
import { $createHeadingNode, $createQuoteNode } from "@lexical/rich-text"
import { $isMarkNode, $unwrapMarkNode, $wrapSelectionInMarkNode } from "@lexical/mark"
import { EllipsisHorizontalIcon } from "@heroicons/react/24/outline"
import { ImagePlugin } from "./ImagePlugin"
import { EditorialControls } from "./EditorialControls"
import { PublicationCssControls } from "./PublicationCssControls"
import { applyHtmlSourceToVisualEditor, beginHtmlSourceMode } from "./html-content"

import { ToolbarButton } from "./ToolbarButton"
import { cssHookSlug } from "@/lib/inline-css-hooks"

function markAncestor(node: LexicalNode) {
  let current: LexicalNode | null = node
  while (current) {
    if ($isMarkNode(current)) return current
    current = current.getParent()
  }
  return null
}

type Props = {
  allowDocumentCss?: boolean
  htmlSourceMode?: boolean
  onHtmlSourceModeChange?: (active: boolean) => void
  variant?: "default" | "compact" | "comment"
  placement?: "top" | "bottom"
  imageUploadEndpoint?: string
  imageAssetsEndpoint?: string
  allowImageAssetLibrary?: boolean
  allowImages?: boolean
  trailingContent?: React.ReactNode
}

export function ToolbarPlugin({
  allowDocumentCss = false,
  htmlSourceMode = false,
  onHtmlSourceModeChange,
  variant = "default",
  placement = "top",
  imageUploadEndpoint,
  imageAssetsEndpoint,
  allowImageAssetLibrary,
  allowImages = true,
  trailingContent,
}: Props) {
  const [editor] = useLexicalComposerContext()
  const [showAdvanced, setShowAdvanced] = useState(false)
  const compact = variant === "compact"
  const comment = variant === "comment"

  function formatHeading(level: "h1" | "h2" | "h3") {
    editor.update(() => {
      const selection = $getSelection()
      if ($isRangeSelection(selection)) {
        $setBlocksType(selection, () => $createHeadingNode(level))
      }
    })
    if (comment) setShowAdvanced(false)
  }

  function formatQuote() {
    editor.update(() => {
      const selection = $getSelection()
      if ($isRangeSelection(selection)) {
        $setBlocksType(selection, () => $createQuoteNode())
      }
    })
    if (comment) setShowAdvanced(false)
  }

  function markCssHook() {
    editor.update(() => {
      const selection = $getSelection()
      if (!$isRangeSelection(selection)) return
      const anchorMark = markAncestor(selection.anchor.getNode())
      const focusMark = markAncestor(selection.focus.getNode())
      if (anchorMark && focusMark?.is(anchorMark)) {
        $unwrapMarkNode(anchorMark)
        return
      }
      if (selection.isCollapsed()) return

      const used = new Set<string>()
      for (const text of $getRoot().getAllTextNodes()) {
        markAncestor(text)?.getIDs().forEach(id => used.add(id))
      }
      const base = cssHookSlug(selection.getTextContent())
      let id = base
      let suffix = 2
      while (used.has(id)) id = `${base}-${suffix++}`
      $wrapSelectionInMarkNode(selection, selection.isBackward(), id)
    })
  }

  const [sourceError, setSourceError] = useState("")
  function toggleHtmlSource() {
    setSourceError("")
    if (htmlSourceMode) {
      try { applyHtmlSourceToVisualEditor(editor) } catch (error) {
        setSourceError(error instanceof Error ? error.message : "Continue no modo código.")
        return
      }
      onHtmlSourceModeChange?.(false)
      return
    }
    beginHtmlSourceMode(editor)
    onHtmlSourceModeChange?.(true)
  }

  return (
    <div
      className={
        compact
          ? "flex flex-wrap items-center gap-0.5 border-t border-white/10 px-1.5 py-1.5"
          : comment
            ? "relative flex min-h-13 flex-wrap items-center gap-0.5 border-t border-neutral-950/[0.08] px-1.5 py-1 dark:border-white/10 sm:min-h-11"
          : "flex items-center gap-1 px-3 py-2 border-b border-neutral-200 dark:border-neutral-800 flex-wrap"
      }
    >
      {allowDocumentCss && <ToolbarButton variant={variant} title={htmlSourceMode ? "Voltar ao editor visual" : "Editar o código HTML"} expanded={htmlSourceMode} onClick={toggleHtmlSource}><span className="text-[9px] font-bold tracking-tight">HTML</span></ToolbarButton>}
      {sourceError && <p role="alert" className="publication-css-error">{sourceError}</p>}
      {!htmlSourceMode && <>
      <ToolbarButton variant={variant} onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "bold")} title="Negrito">
        <b>B</b>
      </ToolbarButton>
      <ToolbarButton variant={variant} onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "italic")} title="Itálico">
        <i>I</i>
      </ToolbarButton>
      <ToolbarButton variant={variant} onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "code")} title="Código inline">
        {"<>"}
      </ToolbarButton>

      {comment ? (
        <>
          <ToolbarButton
            variant="comment"
            onClick={() => setShowAdvanced((visible) => !visible)}
            title={showAdvanced ? "Ocultar formatação avançada" : "Mais opções de formatação"}
            expanded={showAdvanced}
          >
            <EllipsisHorizontalIcon className="size-4" aria-hidden />
          </ToolbarButton>
          {showAdvanced && (
            <div className="flex items-center gap-0.5" role="group" aria-label="Formatação avançada">
              <span className="mx-0.5 h-4 w-px bg-neutral-950/10 dark:bg-white/10" aria-hidden />
              <ToolbarButton variant="comment" onClick={() => formatHeading("h1")} title="Título 1">H1</ToolbarButton>
              <ToolbarButton variant="comment" onClick={() => formatHeading("h2")} title="Título 2">H2</ToolbarButton>
              <ToolbarButton variant="comment" onClick={() => formatHeading("h3")} title="Título 3">H3</ToolbarButton>
              <ToolbarButton variant="comment" onClick={formatQuote} title="Citação">&quot;</ToolbarButton>
            </div>
          )}
        </>
      ) : (
        <>
          <span className={compact ? "mx-0.5 h-4 w-px bg-white/10" : "mx-1 h-4 w-px bg-neutral-200 dark:bg-neutral-700"} aria-hidden />
          <ToolbarButton variant={variant} onClick={() => formatHeading("h1")} title="Título 1">H1</ToolbarButton>
          <ToolbarButton variant={variant} onClick={() => formatHeading("h2")} title="Título 2">H2</ToolbarButton>
          <ToolbarButton variant={variant} onClick={() => formatHeading("h3")} title="Título 3">H3</ToolbarButton>
          <ToolbarButton variant={variant} onClick={formatQuote} title="Citação">&quot;</ToolbarButton>
        </>
      )}
      {(!comment || showAdvanced) && <EditorialControls variant={variant} />}
      {allowImages && (
        <ImagePlugin
          compact={compact}
          menuPlacement={placement === "bottom" ? "above" : "below"}
          uploadEndpoint={imageUploadEndpoint}
          assetsEndpoint={imageAssetsEndpoint}
          allowAssetLibrary={allowImageAssetLibrary}
        />
      )}
      {allowDocumentCss && <ToolbarButton variant={variant} title="Criar ou remover seletor CSS no trecho selecionado" onClick={markCssHook}><span className="text-xs font-semibold">::</span></ToolbarButton>}
      </>}
      {allowDocumentCss && <PublicationCssControls variant={variant} />}
      {trailingContent && (
        <div className="ml-auto shrink-0">{trailingContent}</div>
      )}
    </div>
  )
}
