"use client"

import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext"
import { FORMAT_TEXT_COMMAND, $getSelection, $isRangeSelection } from "lexical"
import { $setBlocksType } from "@lexical/selection"
import { $createHeadingNode, $createQuoteNode } from "@lexical/rich-text"
import { ImagePlugin } from "./ImagePlugin"

type ToolbarButtonProps = {
  onClick: () => void
  title: string
  compact?: boolean
  children: React.ReactNode
}

function ToolbarButton({ onClick, title, compact = false, children }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={
        compact
          ? "grid size-8 place-items-center rounded-full text-xs font-semibold text-[#A8A095] transition-colors hover:bg-white/10 hover:text-[#f1f1f1] disabled:opacity-40"
          : "px-2 py-1 text-xs rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-400 transition-colors"
      }
    >
      {children}
    </button>
  )
}

type Props = {
  variant?: "default" | "compact"
  placement?: "top" | "bottom"
  imageUploadEndpoint?: string
  imageAssetsEndpoint?: string
  allowImageAssetLibrary?: boolean
}

export function ToolbarPlugin({
  variant = "default",
  placement = "top",
  imageUploadEndpoint,
  imageAssetsEndpoint,
  allowImageAssetLibrary,
}: Props) {
  const [editor] = useLexicalComposerContext()
  const compact = variant === "compact"

  function formatHeading(level: "h1" | "h2" | "h3") {
    editor.update(() => {
      const selection = $getSelection()
      if ($isRangeSelection(selection)) {
        $setBlocksType(selection, () => $createHeadingNode(level))
      }
    })
  }

  function formatQuote() {
    editor.update(() => {
      const selection = $getSelection()
      if ($isRangeSelection(selection)) {
        $setBlocksType(selection, () => $createQuoteNode())
      }
    })
  }

  return (
    <div
      className={
        compact
          ? "flex items-center gap-0.5 border-t border-white/10 px-1.5 py-1.5"
          : "flex items-center gap-1 px-3 py-2 border-b border-neutral-200 dark:border-neutral-800 flex-wrap"
      }
    >
      <ToolbarButton compact={compact} onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "bold")} title="Negrito">
        <b>B</b>
      </ToolbarButton>
      <ToolbarButton compact={compact} onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "italic")} title="Itálico">
        <i>I</i>
      </ToolbarButton>
      <ToolbarButton compact={compact} onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "code")} title="Código inline">
        {"<>"}
      </ToolbarButton>
      <span className={compact ? "mx-0.5 h-4 w-px bg-white/10" : "mx-1 h-4 w-px bg-neutral-200 dark:bg-neutral-700"} />
      <ToolbarButton compact={compact} onClick={() => formatHeading("h1")} title="Título 1">H1</ToolbarButton>
      <ToolbarButton compact={compact} onClick={() => formatHeading("h2")} title="Título 2">H2</ToolbarButton>
      <ToolbarButton compact={compact} onClick={() => formatHeading("h3")} title="Título 3">H3</ToolbarButton>
      <ToolbarButton compact={compact} onClick={formatQuote} title="Citação">&quot;</ToolbarButton>
      <ImagePlugin
        compact={compact}
        menuPlacement={placement === "bottom" ? "above" : "below"}
        uploadEndpoint={imageUploadEndpoint}
        assetsEndpoint={imageAssetsEndpoint}
        allowAssetLibrary={allowImageAssetLibrary}
      />
    </div>
  )
}
