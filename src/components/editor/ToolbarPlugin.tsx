"use client"

import { useState } from "react"
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext"
import { FORMAT_TEXT_COMMAND, $createParagraphNode, $getRoot, $getSelection, $isRangeSelection, type LexicalEditor as LexicalEditorInstance, type LexicalNode } from "lexical"
import { $setBlocksType } from "@lexical/selection"
import { $createHeadingNode, $createQuoteNode } from "@lexical/rich-text"
import { $isMarkNode, $unwrapMarkNode, $wrapSelectionInMarkNode } from "@lexical/mark"
import { Bars3BottomLeftIcon, ChatBubbleBottomCenterTextIcon, CodeBracketIcon, CodeBracketSquareIcon, DocumentTextIcon, EllipsisHorizontalIcon } from "@heroicons/react/24/outline"
import { ImagePlugin } from "./ImagePlugin"
import { EditorialControls } from "./EditorialControls"
import { PublicationCssControls } from "./PublicationCssControls"
import { applyHtmlSourceToVisualEditor, beginHtmlSourceMode } from "./html-content"

import { ToolbarButton } from "./ToolbarButton"
import { cssHookSlug } from "@/lib/inline-css-hooks"
import type { ContentFormat } from "./LexicalEditor"
import { EditorToolbarMenu } from "./EditorToolbarMenu"

function markAncestor(node: LexicalNode) {
  let current: LexicalNode | null = node
  while (current) {
    if ($isMarkNode(current)) return current
    current = current.getParent()
  }
  return null
}

type Props = {
  allowContentFormatChoice?: boolean
  allowDocumentCss?: boolean
  contentFormat?: ContentFormat
  htmlSourceMode?: boolean
  onContentFormatChange?: (format: ContentFormat, editor: LexicalEditorInstance) => void
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
  allowContentFormatChoice = false,
  allowDocumentCss = false,
  contentFormat = "markdown",
  htmlSourceMode = false,
  onContentFormatChange,
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

  function formatBlock(level: "paragraph" | "h1" | "h2" | "h3" | "quote") {
    editor.update(() => {
      const selection = $getSelection()
      if ($isRangeSelection(selection)) {
        $setBlocksType(selection, () => level === "paragraph"
          ? $createParagraphNode()
          : level === "quote"
            ? $createQuoteNode()
            : $createHeadingNode(level))
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

  function changeContentFormat(format: ContentFormat) {
    setSourceError("")
    if (format === contentFormat) return
    if (htmlSourceMode) {
      try { applyHtmlSourceToVisualEditor(editor) } catch (error) {
        setSourceError(error instanceof Error ? error.message : "Este HTML precisa continuar no modo código.")
        return
      }
      onHtmlSourceModeChange?.(false)
    }
    onContentFormatChange?.(format, editor)
  }

  return <div className="editor-toolbar" data-editor-variant={variant} data-editor-placement={placement}>
    {allowContentFormatChoice && <EditorToolbarMenu
      accessibleLabel="Formato do conteúdo"
      icon={contentFormat === "markdown" ? <DocumentTextIcon className="size-4" /> : <CodeBracketSquareIcon className="size-4" />}
      label={contentFormat === "markdown" ? "Markdown" : "HTML"}
      value={contentFormat}
      onChange={changeContentFormat}
      options={[
        { value: "markdown", label: "Markdown", description: "Texto portátil e legível", icon: <DocumentTextIcon className="size-4" /> },
        { value: "html", label: "HTML", description: "Estrutura e CSS avançados", icon: <CodeBracketSquareIcon className="size-4" /> },
      ]}
      variant={variant}
    />}
    {allowDocumentCss && <ToolbarButton variant={variant} title={htmlSourceMode ? "Voltar ao editor visual" : "Editar código HTML"} expanded={htmlSourceMode} onClick={toggleHtmlSource}><CodeBracketSquareIcon className="size-4" aria-hidden /></ToolbarButton>}
    {sourceError && <p role="alert" className="publication-css-error">{sourceError}</p>}
    {!htmlSourceMode && <>
      <div className="editor-toolbar-section" role="group" aria-label="Formatação de texto">
        <ToolbarButton variant={variant} onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "bold")} title="Negrito"><b>B</b></ToolbarButton>
        <ToolbarButton variant={variant} onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "italic")} title="Itálico"><i>I</i></ToolbarButton>
        <ToolbarButton variant={variant} onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "code")} title="Código inline"><CodeBracketIcon className="size-4" aria-hidden /></ToolbarButton>
      </div>
      {comment ? <>
        <ToolbarButton variant="comment" onClick={() => setShowAdvanced(visible => !visible)} title={showAdvanced ? "Ocultar formatação avançada" : "Mais opções de formatação"} expanded={showAdvanced}><EllipsisHorizontalIcon className="size-4" aria-hidden /></ToolbarButton>
        {showAdvanced && <div className="editor-toolbar-section" role="group" aria-label="Formatação avançada">
          <ToolbarButton variant="comment" onClick={() => formatBlock("h1")} title="Título 1">H1</ToolbarButton>
          <ToolbarButton variant="comment" onClick={() => formatBlock("h2")} title="Título 2">H2</ToolbarButton>
          <ToolbarButton variant="comment" onClick={() => formatBlock("h3")} title="Título 3">H3</ToolbarButton>
          <ToolbarButton variant="comment" onClick={() => formatBlock("quote")} title="Citação"><ChatBubbleBottomCenterTextIcon className="size-4" aria-hidden /></ToolbarButton>
        </div>}
      </> : <EditorToolbarMenu
        accessibleLabel="Tipo de bloco"
        icon={<Bars3BottomLeftIcon className="size-4" />}
        label="Bloco"
        onChange={formatBlock}
        options={[
          { value: "paragraph", label: "Parágrafo", description: "Texto comum", icon: <span>P</span> },
          { value: "h1", label: "Título 1", description: "Título principal", icon: <span>H1</span> },
          { value: "h2", label: "Título 2", description: "Seção", icon: <span>H2</span> },
          { value: "h3", label: "Título 3", description: "Subseção", icon: <span>H3</span> },
          { value: "quote", label: "Citação", description: "Trecho destacado", icon: <ChatBubbleBottomCenterTextIcon className="size-4" /> },
        ]}
        variant={variant}
      />}
      {(!comment || showAdvanced) && <EditorialControls variant={variant} />}
      {allowImages && <ImagePlugin compact={compact} menuPlacement={placement === "bottom" ? "above" : "below"} uploadEndpoint={imageUploadEndpoint} assetsEndpoint={imageAssetsEndpoint} allowAssetLibrary={allowImageAssetLibrary} />}
      {allowDocumentCss && <div className="editor-toolbar-section" role="group" aria-label="Ferramentas de CSS">
        <ToolbarButton variant={variant} title="Criar ou remover seletor CSS no trecho selecionado" onClick={markCssHook}><span className="text-xs font-semibold">::</span></ToolbarButton>
      </div>}
    </>}
    {allowDocumentCss && <PublicationCssControls variant={variant} />}
    {trailingContent && <div className="editor-toolbar-trailing">{trailingContent}</div>}
  </div>
}
