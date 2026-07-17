"use client"

import { useState } from "react"
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext"
import { FORMAT_TEXT_COMMAND, $getSelection, $isRangeSelection } from "lexical"
import { $setBlocksType } from "@lexical/selection"
import { $createHeadingNode, $createQuoteNode } from "@lexical/rich-text"
import { EllipsisHorizontalIcon } from "@heroicons/react/24/outline"
import { ImagePlugin } from "./ImagePlugin"

type ToolbarButtonProps = {
  onClick: () => void
  title: string
  variant?: "default" | "compact" | "comment"
  expanded?: boolean
  children: React.ReactNode
}

function ToolbarButton({ onClick, title, variant = "default", expanded, children }: ToolbarButtonProps) {
  const compact = variant === "compact"
  const comment = variant === "comment"

  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      aria-expanded={expanded}
      className={
        compact
          ? "grid size-8 place-items-center rounded-full text-xs font-semibold text-[#A8A095] transition-colors hover:bg-white/10 hover:text-[#f1f1f1] disabled:opacity-40"
          : comment
            ? "grid size-11 place-items-center rounded-md text-xs font-semibold text-neutral-500 transition-colors hover:bg-neutral-950/[0.06] hover:text-neutral-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400/60 dark:text-neutral-400 dark:hover:bg-white/10 dark:hover:text-neutral-100 sm:size-8"
          : "px-2 py-1 text-xs rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-400 transition-colors"
      }
    >
      {children}
    </button>
  )
}

type Props = {
  variant?: "default" | "compact" | "comment"
  placement?: "top" | "bottom"
  imageUploadEndpoint?: string
  imageAssetsEndpoint?: string
  allowImageAssetLibrary?: boolean
  allowImages?: boolean
  trailingContent?: React.ReactNode
}

export function ToolbarPlugin({
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

  return (
    <div
      className={
        compact
          ? "flex items-center gap-0.5 border-t border-white/10 px-1.5 py-1.5"
          : comment
            ? "relative flex min-h-13 flex-wrap items-center gap-0.5 border-t border-neutral-950/[0.08] px-1.5 py-1 dark:border-white/10 sm:min-h-11"
          : "flex items-center gap-1 px-3 py-2 border-b border-neutral-200 dark:border-neutral-800 flex-wrap"
      }
    >
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
      {allowImages && (
        <ImagePlugin
          compact={compact}
          comfortableOnMobile={comment}
          menuPlacement={placement === "bottom" ? "above" : "below"}
          uploadEndpoint={imageUploadEndpoint}
          assetsEndpoint={imageAssetsEndpoint}
          allowAssetLibrary={allowImageAssetLibrary}
        />
      )}
      {trailingContent && (
        <div className={allowImages ? "shrink-0" : "ml-auto shrink-0"}>{trailingContent}</div>
      )}
    </div>
  )
}
