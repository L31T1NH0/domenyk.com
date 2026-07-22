"use client"

import { useState } from "react"
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext"
import type { ElementTransformer } from "@lexical/markdown"
import {
  $createParagraphNode,
  $getNodeByKey,
  $isParagraphNode,
  $nodesOfType,
  DecoratorNode,
  type LexicalNode,
  type NodeKey,
  type SerializedLexicalNode,
  type Spread,
} from "lexical"
import {
  Bars3BottomLeftIcon,
  Bars3BottomRightIcon,
  RectangleStackIcon,
} from "@heroicons/react/24/outline"

export type ImageLayout = "block" | "flow-left" | "flow-right"
export type ImageFlowWidth = 32 | 42 | 52
export type ImageThemeMode = "original" | "adaptive-monochrome"

type SerializedImageNode = Spread<
  {
    src: string
    alt?: string
    layout?: ImageLayout
    flowWidth?: ImageFlowWidth
    themeMode?: ImageThemeMode
    type: "image"
    version: 3
  },
  SerializedLexicalNode
>

const DEFAULT_FLOW_WIDTH: ImageFlowWidth = 42
const FLOW_WIDTHS: readonly ImageFlowWidth[] = [32, 42, 52]

function normalizeLayout(value: unknown): ImageLayout {
  return value === "flow-left" || value === "flow-right" ? value : "block"
}

function normalizeFlowWidth(value: unknown): ImageFlowWidth {
  return FLOW_WIDTHS.includes(value as ImageFlowWidth)
    ? value as ImageFlowWidth
    : DEFAULT_FLOW_WIDTH
}

function normalizeThemeMode(value: unknown): ImageThemeMode {
  return value === "adaptive-monochrome" ? value : "original"
}

function escapeHtmlAttribute(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
}

function decodeHtmlAttribute(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
}

function ImageComponent({
  nodeKey,
  src,
  alt,
  layout,
  flowWidth,
  themeMode,
}: {
  nodeKey: NodeKey
  src: string
  alt: string
  layout: ImageLayout
  flowWidth: ImageFlowWidth
  themeMode: ImageThemeMode
}) {
  const [editor] = useLexicalComposerContext()
  const isFlow = layout !== "block"
  const [layoutError, setLayoutError] = useState("")

  function updateImage(update: (node: ImageNode) => void) {
    editor.update(() => {
      const node = $getNodeByKey(nodeKey)
      if ($isImageNode(node)) update(node)
    })
  }

  function selectLayout(nextLayout: ImageLayout) {
    let blocked = false
    editor.update(() => {
      if (nextLayout !== "block") {
        blocked = $nodesOfType(ImageNode).some((node) => (
          node.getKey() !== nodeKey && node.getLayout() !== "block"
        ))
      }
      if (blocked) return
      const node = $getNodeByKey(nodeKey)
      if ($isImageNode(node)) node.setLayout(nextLayout)
    }, {
      onUpdate: () => setLayoutError(blocked
        ? "Este conteúdo já possui uma figura de contorno. Use layout normal nesta imagem."
        : ""),
    })
  }

  const layoutOptions: Array<{
    value: ImageLayout
    label: string
    icon: typeof RectangleStackIcon
  }> = [
    { value: "block", label: "Imagem normal", icon: RectangleStackIcon },
    { value: "flow-left", label: "Contorno à esquerda", icon: Bars3BottomLeftIcon },
    { value: "flow-right", label: "Contorno à direita", icon: Bars3BottomRightIcon },
  ]

  return (
    <span
      contentEditable={false}
      className="group relative my-3 block max-w-full rounded-lg border border-neutral-200 bg-neutral-50/70 p-2 dark:border-white/10 dark:bg-white/[0.03]"
    >
      <img
        src={src}
        alt={alt}
        className={[
          "h-auto rounded-md object-contain",
          isFlow ? "mx-auto" : "w-full",
        ].join(" ")}
        style={{
          filter: "none",
          width: isFlow ? `${flowWidth}%` : undefined,
        }}
      />
      <span
        role="toolbar"
        aria-label="Composição da imagem"
        className="mt-2 flex flex-wrap items-center gap-1 border-t border-neutral-200/80 pt-2 dark:border-white/10"
      >
        {layoutOptions.map((option) => {
          const Icon = option.icon
          const active = layout === option.value
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => selectLayout(option.value)}
              title={option.label}
              aria-label={option.label}
              aria-pressed={active}
              className={[
                "grid size-11 place-items-center rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500/60",
                active
                  ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-950"
                  : "text-neutral-500 hover:bg-neutral-200/70 hover:text-neutral-950 dark:text-neutral-400 dark:hover:bg-white/10 dark:hover:text-white",
              ].join(" ")}
            >
              <Icon className="size-4" aria-hidden />
            </button>
          )
        })}

        {isFlow && (
          <span className="ml-auto flex items-center gap-1" role="group" aria-label="Largura do recorte">
            {FLOW_WIDTHS.map((width) => (
              <button
                key={width}
                type="button"
                onClick={() => updateImage((node) => node.setFlowWidth(width))}
                aria-pressed={flowWidth === width}
                className={[
                  "min-h-11 rounded-md px-2 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500/60",
                  flowWidth === width
                    ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-950"
                    : "text-neutral-500 hover:bg-neutral-200/70 hover:text-neutral-950 dark:text-neutral-400 dark:hover:bg-white/10 dark:hover:text-white",
                ].join(" ")}
              >
                {width}%
              </button>
            ))}
          </span>
        )}
        <label className="ml-auto inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-md px-2 text-xs text-neutral-600 focus-within:ring-2 focus-within:ring-neutral-500/60 dark:text-neutral-300">
          <input
            type="checkbox"
            checked={themeMode === "adaptive-monochrome"}
            onChange={(event) => updateImage((node) => node.setThemeMode(
              event.target.checked ? "adaptive-monochrome" : "original"
            ))}
            className="size-4 accent-neutral-900 dark:accent-white"
          />
          Adaptar ao tema
        </label>
      </span>
      {layoutError && (
        <span role="alert" className="mt-2 block text-xs text-red-600 dark:text-red-400">
          {layoutError}
        </span>
      )}
    </span>
  )
}

export class ImageNode extends DecoratorNode<React.ReactNode> {
  __src: string
  __alt: string
  __layout: ImageLayout
  __flowWidth: ImageFlowWidth
  __themeMode: ImageThemeMode

  static getType() { return "image" }

  static clone(node: ImageNode) {
    return new ImageNode(
      node.__src,
      node.__alt,
      node.__layout,
      node.__flowWidth,
      node.__themeMode,
      node.__key
    )
  }

  constructor(
    src: string,
    alt = "",
    layout: ImageLayout = "block",
    flowWidth: ImageFlowWidth = DEFAULT_FLOW_WIDTH,
    themeMode: ImageThemeMode = "original",
    key?: NodeKey
  ) {
    super(key)
    this.__src = src
    this.__alt = alt
    this.__layout = normalizeLayout(layout)
    this.__flowWidth = normalizeFlowWidth(flowWidth)
    this.__themeMode = normalizeThemeMode(themeMode)
  }

  createDOM() {
    return document.createElement("span")
  }

  updateDOM() { return false }

  static importJSON(serialized: SerializedImageNode): ImageNode {
    return new ImageNode(
      serialized.src,
      serialized.alt,
      normalizeLayout(serialized.layout),
      normalizeFlowWidth(serialized.flowWidth),
      normalizeThemeMode(serialized.themeMode)
    )
  }

  exportJSON(): SerializedImageNode {
    return {
      src: this.__src,
      alt: this.__alt,
      layout: this.__layout,
      flowWidth: this.__flowWidth,
      themeMode: this.__themeMode,
      type: "image",
      version: 3,
    }
  }

  decorate() {
    return (
      <ImageComponent
        nodeKey={this.__key}
        src={this.__src}
        alt={this.__alt}
        layout={this.__layout}
        flowWidth={this.__flowWidth}
        themeMode={this.__themeMode}
      />
    )
  }

  getSrc() {
    return this.__src
  }

  getAlt() {
    return this.__alt
  }

  getLayout() {
    return this.__layout
  }

  getFlowWidth() {
    return this.__flowWidth
  }

  getThemeMode() {
    return this.__themeMode
  }

  setLayout(layout: ImageLayout) {
    const writable = this.getWritable()
    writable.__layout = normalizeLayout(layout)
  }

  setFlowWidth(flowWidth: ImageFlowWidth) {
    const writable = this.getWritable()
    writable.__flowWidth = normalizeFlowWidth(flowWidth)
  }

  setThemeMode(themeMode: ImageThemeMode) {
    const writable = this.getWritable()
    writable.__themeMode = normalizeThemeMode(themeMode)
  }
}

export function $createImageNode(
  src: string,
  alt?: string,
  layout: ImageLayout = "block",
  flowWidth: ImageFlowWidth = DEFAULT_FLOW_WIDTH,
  themeMode: ImageThemeMode = "original"
): ImageNode {
  return new ImageNode(src, alt, layout, flowWidth, themeMode)
}

export function $isImageNode(node: LexicalNode | null | undefined): node is ImageNode {
  return node instanceof ImageNode
}

function imageNodeFromTransformerTarget(node: LexicalNode): ImageNode | null {
  if ($isImageNode(node)) return node
  if (!$isParagraphNode(node) || node.getChildrenSize() !== 1) return null
  const child = node.getFirstChild()
  return $isImageNode(child) ? child : null
}

function replaceWithImage(
  parentNode: LexicalNode,
  src: string,
  alt: string,
  layout: ImageLayout = "block",
  flowWidth: ImageFlowWidth = DEFAULT_FLOW_WIDTH,
  themeMode: ImageThemeMode = "original"
) {
  const paragraph = $createParagraphNode()
  paragraph.append($createImageNode(src, alt, layout, flowWidth, themeMode))
  parentNode.replace(paragraph)
}

export const FLOW_IMAGE_TRANSFORMER: ElementTransformer = {
  dependencies: [ImageNode],
  export: (node) => {
    const image = imageNodeFromTransformerTarget(node)
    if (!image || image.getLayout() === "block") return null

    const side = image.getLayout() === "flow-right" ? "right" : "left"
    const theme = image.getThemeMode() === "adaptive-monochrome"
      ? ' data-image-theme="adaptive"'
      : ""
    return `<figure data-flow-image="${side}" data-flow-width="${image.getFlowWidth()}"${theme}><img src="${escapeHtmlAttribute(image.getSrc())}" alt="${escapeHtmlAttribute(image.getAlt())}"></figure>`
  },
  regExp: /^<figure data-flow-image="(left|right)" data-flow-width="(32|42|52)"(?: data-image-theme="(adaptive)")?><img src="([^"]+)" alt="([^"]*)"><\/figure>$/,
  replace: (parentNode, _children, match) => {
    const [, side, width, theme, src, alt] = match
    replaceWithImage(
      parentNode,
      decodeHtmlAttribute(src),
      decodeHtmlAttribute(alt),
      side === "right" ? "flow-right" : "flow-left",
      normalizeFlowWidth(Number(width)),
      theme === "adaptive" ? "adaptive-monochrome" : "original"
    )
  },
  type: "element",
}

export const IMAGE_TRANSFORMER: ElementTransformer = {
  dependencies: [ImageNode],
  export: (node) => {
    const image = imageNodeFromTransformerTarget(node)
    if (!image || image.getLayout() !== "block") return null
    return `![${image.getAlt()}](${image.getSrc()})`
  },
  regExp: /^!\[([^\]]*)\]\(([^)]+)\)$/,
  replace: (parentNode, _children, match) => {
    const [, alt, src] = match
    replaceWithImage(parentNode, src, alt)
  },
  type: "element",
}
