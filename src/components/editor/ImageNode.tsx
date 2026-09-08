"use client"

import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext"
import { useLexicalNodeSelection } from "@lexical/react/useLexicalNodeSelection"
import type { ElementTransformer } from "@lexical/markdown"
import {
  $getNodeByKey, $isParagraphNode, DecoratorNode,
  HISTORY_PUSH_TAG, SKIP_DOM_SELECTION_TAG, UNDO_COMMAND, REDO_COMMAND,
  type LexicalNode, type NodeKey, type SerializedLexicalNode, type Spread,
  type DOMConversionMap, type DOMExportOutput,
} from "lexical"
import { fromHtml } from "hast-util-from-html"
import type { Element } from "hast"
import { imageClasses, imageDefaults, imageNumber, safeImageStyle } from "@/lib/content-images"

export type ImageLayout = "block" | "flow-left" | "flow-right"
export type ImageFlowWidth = number
export type ImageThemeMode = "original" | "adaptive-monochrome"
type ImageFormatting = {
  width?: number
  unit?: "%" | "px"
  gap?: number
  figureClass?: string
  figureStyle?: string
  imageClass?: string
  imageStyle?: string
  captionClass?: string
  captionStyle?: string
}
type SerializedImageNode = Spread<{
  src: string
  alt?: string
  layout?: ImageLayout
  flowWidth?: number
  themeMode?: ImageThemeMode
  blockWidth?: number
  alignment?: "left" | "center" | "right"
  caption?: string
  formatting?: ImageFormatting
  type: "image"
  version: number
}, SerializedLexicalNode>
const DEFAULT_FLOW_WIDTH = 42
function normalizeLayout(value: unknown): ImageLayout {
  return value === "flow-left" || value === "flow-right" ? value : "block"
}
function normalizeFlowWidth(value: unknown) { return imageNumber(value, 42, 100) }
function normalizeThemeMode(value: unknown): ImageThemeMode {
  return value === "adaptive-monochrome" ? value : "original"
}
function escapeHtmlAttribute(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}
function decodeHtmlAttribute(value: string): string {
  return value.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&")
}

function ImageComponent({ nodeKey, data }: { nodeKey: NodeKey; data: SerializedImageNode }) {
  const [editor] = useLexicalComposerContext()
  const [nodeSelected, setNodeSelected, clearSelection] = useLexicalNodeSelection(nodeKey)
  const [controlsOpen, setControlsOpen] = useState(false)
  const selected = nodeSelected || controlsOpen
  const panel = useRef<HTMLDivElement>(null)
  const f = data.formatting ?? {}
  const width = f.width ?? (data.layout === "block" ? data.blockWidth : data.flowWidth) ?? 100
  function updateImage(update: (node: ImageNode) => void) {
    editor.update(() => {
      const node = $getNodeByKey(nodeKey)
      if ($isImageNode(node)) update(node)
    }, { tag: [HISTORY_PUSH_TAG, SKIP_DOM_SELECTION_TAG] })
  }
  function close() {
    setControlsOpen(false)
    setNodeSelected(false)
    editor.getElementByKey(nodeKey)?.querySelector<HTMLImageElement>(":scope > img")?.focus()
  }
  function selectImage() {
    clearSelection()
    setNodeSelected(true)
    setControlsOpen(true)
    requestAnimationFrame(() => panel.current?.querySelector<HTMLButtonElement>("button")?.focus())
  }
  function removeImage() {
    editor.update(() => {
      const node = $getNodeByKey(nodeKey)
      node?.selectNext()
      node?.remove()
    }, { tag: HISTORY_PUSH_TAG })
  }
  function move(direction: "up" | "down") {
    updateImage(node => {
      const sibling = direction === "up" ? node.getPreviousSibling() : node.getNextSibling()
      if (!sibling) return
      if (direction === "up") sibling.insertBefore(node)
      else sibling.insertAfter(node)
    })
  }
  useEffect(() => {
    editor.getElementByKey(nodeKey)?.toggleAttribute("data-image-selected", selected)
    if (!selected) return
    const dismiss = (event: PointerEvent) => {
      if (!panel.current?.contains(event.target as Node) && !editor.getElementByKey(nodeKey)?.contains(event.target as Node)) {
        setControlsOpen(false)
        setNodeSelected(false)
      }
    }
    document.addEventListener("pointerdown", dismiss)
    return () => document.removeEventListener("pointerdown", dismiss)
  }, [editor, nodeKey, selected, setNodeSelected])

  return <>
    <img
      src={data.src}
      alt={data.alt ?? ""}
      className={f.imageClass || undefined}
      style={undefined}
      ref={element => { if (element) element.setAttribute("style", f.imageStyle ?? "") }}
      role="button"
      tabIndex={0}
      aria-label={data.alt ? `Editar imagem: ${data.alt}` : "Editar imagem"}
      onClick={selectImage}
      onKeyDown={event => {
        if (event.key === "Enter" || event.key === " ") { event.preventDefault(); selectImage() }
        if (event.key === "Delete" || event.key === "Backspace") { event.preventDefault(); removeImage() }
      }}
    />
    {data.caption && <figcaption className={f.captionClass || undefined} ref={element => { if (element) element.setAttribute("style", f.captionStyle ?? "") }}>{data.caption}</figcaption>}
    {controlsOpen && createPortal(<div ref={panel} className="image-properties-panel" role="dialog" aria-label="Composição da imagem" onKeyDown={event => {
      if (event.key === "Escape") { event.preventDefault(); close() }
    }}>
      <div className="image-properties-heading"><strong>Imagem</strong><button type="button" onClick={close}>Fechar</button></div>
      <label>Composição<select value={data.layout} onChange={e => updateImage(node => node.setLayout(e.target.value as ImageLayout))}>
        <option value="block">Imagem normal</option><option value="flow-left">Imagem à esquerda, texto ao redor</option><option value="flow-right">Imagem à direita, texto ao redor</option>
      </select></label>
      <div className="image-properties-row">
        <label>Largura<input type="number" min="1" max={f.unit === "px" ? 4000 : 100} value={width} onChange={e => updateImage(node => node.setWidth(Number(e.target.value), f.unit ?? "%"))} /></label>
        <label>Unidade<select value={f.unit ?? "%"} onChange={e => updateImage(node => node.setWidth(width, e.target.value as "%" | "px"))}><option value="%">%</option><option value="px">px</option></select></label>
        <label>Distância (px)<input type="number" min="0" max="256" value={f.gap ?? 16} onChange={e => updateImage(node => node.setFormatting({ gap: imageNumber(e.target.value, 16, 256) }))} /></label>
      </div>
      <label>Alinhamento<select value={data.alignment} onChange={e => updateImage(node => node.setAlignment(e.target.value as "left" | "center" | "right"))}><option value="left">Esquerda</option><option value="center">Centro</option><option value="right">Direita</option></select></label>
      <label>Legenda<input value={data.caption ?? ""} maxLength={300} onChange={e => updateImage(node => node.setCaption(e.target.value))} /></label>
      <label>Descrição alternativa<input value={data.alt ?? ""} maxLength={500} onChange={e => updateImage(node => node.setAlt(e.target.value))} /></label>
      <label className="image-properties-checkbox"><input type="checkbox" checked={data.themeMode === "adaptive-monochrome"} onChange={e => updateImage(node => node.setThemeMode(e.target.checked ? "adaptive-monochrome" : "original"))} />Adaptar ao tema</label>
      <div className="image-properties-actions">
        <button type="button" onClick={() => move("up")}>Mover acima</button><button type="button" onClick={() => move("down")}>Mover abaixo</button>
        <button type="button" onClick={() => editor.dispatchCommand(UNDO_COMMAND, undefined)}>Desfazer</button><button type="button" onClick={() => editor.dispatchCommand(REDO_COMMAND, undefined)}>Refazer</button>
        <button type="button" onClick={() => { removeImage(); editor.focus() }}>Excluir imagem</button>
      </div>
    </div>, document.body)}
  </>
}

export class ImageNode extends DecoratorNode<React.ReactNode> {
  __formatting: ImageFormatting = {}
  __src: string
  __alt: string
  __layout: ImageLayout
  __flowWidth: ImageFlowWidth
  __themeMode: ImageThemeMode
  __blockWidth: number
  __alignment: "left" | "center" | "right"
  __caption: string

  static getType() { return "image" }

  static clone(node: ImageNode) {
    const clone = new ImageNode(
      node.__src,
      node.__alt,
      node.__layout,
      node.__flowWidth,
      node.__themeMode,
      node.__blockWidth, node.__alignment, node.__caption,
      node.__key
    )
    clone.__formatting = { ...node.__formatting }
    return clone
  }

  constructor(
    src: string,
    alt = "",
    layout: ImageLayout = "block",
    flowWidth: ImageFlowWidth = DEFAULT_FLOW_WIDTH,
    themeMode: ImageThemeMode = "original",
    blockWidth = 100,
    alignment: "left" | "center" | "right" = "center",
    caption = "",
    key?: NodeKey
  ) {
    super(key)
    this.__src = src
    this.__alt = alt
    this.__layout = normalizeLayout(layout)
    this.__flowWidth = normalizeFlowWidth(flowWidth)
    this.__themeMode = normalizeThemeMode(themeMode)
    this.__blockWidth = imageNumber(blockWidth, 100, 100)
    this.__alignment = alignment === "left" || alignment === "right" ? alignment : "center"
    this.__caption = caption.slice(0, 300)
  }

  isInline() { return false }

  applyFigureDOM(figure: HTMLElement, editing = false) {
    for (const name of ["data-flow-image", "data-flow-width", "data-editor-image", "data-editor-width", "data-image-theme"]) figure.removeAttribute(name)
    if (this.__layout === "block") {
      figure.dataset.editorImage = this.__alignment
      figure.dataset.editorWidth = String(this.__blockWidth)
    } else {
      figure.dataset.flowImage = this.__layout === "flow-left" ? "left" : "right"
      figure.dataset.flowWidth = String(this.__flowWidth)
    }
    if (this.__themeMode === "adaptive-monochrome") figure.dataset.imageTheme = "adaptive"
    const f = this.__formatting
    const width = f.width ?? (this.__layout === "block" ? this.__blockWidth : this.__flowWidth)
    figure.dataset.imageWidth = String(width)
    figure.dataset.imageUnit = f.unit ?? "%"
    figure.dataset.imageGap = String(f.gap ?? 16)
    figure.className = f.figureClass ?? ""
    figure.setAttribute("style", `${editing ? imageDefaults(this.__src, width, f.unit, f.gap) + ";" : ""}${f.figureStyle ?? ""}`)
    figure.removeAttribute("tabindex")
    figure.removeAttribute("aria-label")
    if (editing) figure.contentEditable = "false"
  }
  createDOM() {
    const figure = document.createElement("figure")
    this.applyFigureDOM(figure, true)
    return figure
  }
  updateDOM(_previous: ImageNode, figure: HTMLElement) { this.applyFigureDOM(figure, true); return false }

  exportDOM(): DOMExportOutput {
    const figure = document.createElement("figure")
    this.applyFigureDOM(figure)
    const image = document.createElement("img")
    image.src = this.__src
    image.alt = this.__alt
    image.className = this.__formatting.imageClass ?? ""
    image.setAttribute("style", this.__formatting.imageStyle ?? "")
    figure.append(image)
    if (this.__caption) {
      const caption = document.createElement("figcaption")
      caption.textContent = this.__caption
      caption.className = this.__formatting.captionClass ?? ""
      caption.setAttribute("style", this.__formatting.captionStyle ?? "")
      figure.append(caption)
    }
    return { element: figure }
  }

  static importDOM(): DOMConversionMap {
    return {
      figure: element => element.querySelector("img") ? {
        priority: 4,
        conversion: dom => {
          const img = dom.querySelector("img")!
          const side = dom.dataset.flowImage
          const node = new ImageNode(
            img.getAttribute("src") ?? "", img.alt,
            side === "left" ? "flow-left" : side === "right" ? "flow-right" : "block",
            normalizeFlowWidth(Number(dom.dataset.flowWidth)),
            dom.dataset.imageTheme === "adaptive" ? "adaptive-monochrome" : "original",
            dom.dataset.editorWidth ? Number(dom.dataset.editorWidth) : 100,
            dom.dataset.editorImage as "left" | "center" | "right",
            dom.querySelector("figcaption")?.textContent ?? "",
          )
          const caption = dom.querySelector("figcaption")
          node.setFormatting({
            width: imageNumber(dom.dataset.imageWidth ?? (side ? dom.dataset.flowWidth : dom.dataset.editorWidth), side ? 42 : 100),
            unit: dom.dataset.imageUnit === "px" ? "px" : "%", gap: imageNumber(dom.dataset.imageGap, 16, 256),
            figureClass: dom.className, figureStyle: dom.getAttribute("style") ?? "",
            imageClass: img.className, imageStyle: `${img.getAttribute("width") ? `width:${img.getAttribute("width")}px;` : ""}${img.getAttribute("height") ? `height:${img.getAttribute("height")}px;` : ""}${img.getAttribute("style") ?? ""}`,
            captionClass: caption?.className, captionStyle: caption?.getAttribute("style") ?? "",
          })
          return { node, forChild: () => null }
        },
      } : null,
      img: () => ({ priority: 1, conversion: dom => {
        const node = $createImageNode(dom.getAttribute("src") ?? "", dom.getAttribute("alt") ?? "")
        node.setFormatting({ imageClass: dom.className, imageStyle: `${dom.getAttribute("width") ? `width:${dom.getAttribute("width")}px;` : ""}${dom.getAttribute("height") ? `height:${dom.getAttribute("height")}px;` : ""}${dom.getAttribute("style") ?? ""}` })
        return { node }
      } }),
    }
  }

  static importJSON(serialized: SerializedImageNode): ImageNode {
    const node = new ImageNode(
      serialized.src,
      serialized.alt,
      normalizeLayout(serialized.layout),
      normalizeFlowWidth(serialized.flowWidth),
      normalizeThemeMode(serialized.themeMode),
      serialized.blockWidth, serialized.alignment, serialized.caption
    )
    node.setFormatting(serialized.formatting ?? {})
    return node
  }

  exportJSON(): SerializedImageNode {
    return {
      src: this.__src,
      alt: this.__alt,
      layout: this.__layout,
      flowWidth: this.__flowWidth,
      themeMode: this.__themeMode,
      type: "image",
      version: 5,
      formatting: { ...this.__formatting },
      blockWidth: this.__blockWidth, alignment: this.__alignment, caption: this.__caption,
    }
  }

  decorate() { return <ImageComponent nodeKey={this.__key} data={this.exportJSON()} /> }

  setFormatting(value: ImageFormatting) {
    const writable = this.getWritable()
    const f = { ...writable.__formatting, ...value }
    for (const key of ["figureClass", "imageClass", "captionClass"] as const) if (f[key]) f[key] = imageClasses(f[key])
    for (const key of ["figureStyle", "imageStyle", "captionStyle"] as const) if (f[key]) f[key] = safeImageStyle(f[key])
    if (f.width !== undefined) f.width = Math.max(1, imageNumber(f.width, 100, f.unit === "px" ? 4000 : 100))
    if (f.gap !== undefined) f.gap = imageNumber(f.gap, 16, 256)
    writable.__formatting = f
  }
  setWidth(width: number, unit: "%" | "px") { this.setFormatting({ width, unit }) }

  getBlockWidth() { return this.__blockWidth }
  getAlignment() { return this.__alignment }
  getCaption() { return this.__caption }
  setBlockWidth(width: number) { this.getWritable().__blockWidth = imageNumber(width, 100, 100) }
  setAlignment(value: "left" | "center" | "right") { this.getWritable().__alignment = value === "left" || value === "right" ? value : "center" }
  setCaption(value: string) { this.getWritable().__caption = value.slice(0, 300) }
  setAlt(value: string) { this.getWritable().__alt = value.slice(0, 500) }

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
    writable.__formatting = { ...writable.__formatting, width: layout === "block" ? writable.__blockWidth : writable.__flowWidth, unit: "%" }
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
  parentNode.replace($createImageNode(src, alt, layout, flowWidth, themeMode))
}

export const FLOW_IMAGE_TRANSFORMER: ElementTransformer = {
  dependencies: [ImageNode],
  export: (node) => {
    const image = imageNodeFromTransformerTarget(node)
    if (!image || image.getLayout() === "block") return null
    if (Object.keys(image.__formatting).length || image.getCaption()) return HTML_IMAGE_TRANSFORMER.export(image, () => "")

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
    if (Object.keys(image.__formatting).length) return HTML_IMAGE_TRANSFORMER.export(image, () => "")
    return `![${image.getAlt()}](${image.getSrc()})`
  },
  regExp: /^!\[([^\]]*)\]\(([^)]+)\)$/,
  replace: (parentNode, _children, match) => {
    const [, alt, src] = match
    replaceWithImage(parentNode, src, alt)
  },
  type: "element",
}

export const POSITIONED_IMAGE_TRANSFORMER: ElementTransformer = {
  type: "element",
  dependencies: [ImageNode],
  export(node) {
    const image = imageNodeFromTransformerTarget(node)
    if (!image || image.getLayout() !== "block") return null
    if (Object.keys(image.__formatting).length) return HTML_IMAGE_TRANSFORMER.export(image, () => "")
    if (image.getBlockWidth() === 100 && image.getAlignment() === "center" && !image.getCaption() && image.getThemeMode() === "original") return null
    const theme = image.getThemeMode() === "adaptive-monochrome" ? ' data-image-theme="adaptive"' : ""
    return `<figure data-editor-image="${image.getAlignment()}" data-editor-width="${image.getBlockWidth()}"${theme}><img src="${escapeHtmlAttribute(image.getSrc())}" alt="${escapeHtmlAttribute(image.getAlt())}"><figcaption>${escapeHtmlAttribute(image.getCaption())}</figcaption></figure>`
  },
  regExp: /^<figure data-editor-image="(left|center|right)" data-editor-width="(\d+)"(?: data-image-theme="(adaptive)")?><img src="([^"]+)" alt="([^"]*)"><figcaption>(.*?)<\/figcaption><\/figure>$/,
  replace(parent, _children, match) {
    const [, alignment, width, theme, src, alt, caption] = match
    const image = $createImageNode(decodeHtmlAttribute(src), decodeHtmlAttribute(alt))
    image.setBlockWidth(Number(width))
    image.setAlignment(alignment as "left" | "center" | "right")
    image.setCaption(decodeHtmlAttribute(caption))
    image.setThemeMode(theme === "adaptive" ? "adaptive-monochrome" : "original")
    parent.replace(image)
  },
}

/** Full-fidelity Markdown representation for the v5 image model. */
export const HTML_IMAGE_TRANSFORMER: ElementTransformer = {
  type: "element",
  dependencies: [ImageNode],
  regExp: /^<figure\b.*<\/figure>$/,
  export(node) {
    const image = imageNodeFromTransformerTarget(node)
    if (!image) return null
    const d = image.exportJSON()
    const f = d.formatting ?? {}
    if (!Object.keys(f).length && !(d.layout !== "block" && d.caption)) return null
    const attr = (name: string, value: string | number | undefined) => value === undefined || value === "" ? "" : ` ${name}="${escapeHtmlAttribute(String(value))}"`
    const width = f.width ?? (d.layout === "block" ? d.blockWidth : d.flowWidth)
    const layout = d.layout === "block" ? attr("data-editor-image", d.alignment) : attr("data-flow-image", d.layout === "flow-left" ? "left" : "right")
    return `<figure${layout}${attr("data-image-width", width)}${attr("data-image-unit", f.unit ?? "%")}${attr("data-image-gap", f.gap ?? 16)}${attr("data-image-theme", d.themeMode === "adaptive-monochrome" ? "adaptive" : undefined)}${attr("class", f.figureClass)}${attr("style", f.figureStyle)}><img${attr("src", d.src)} alt="${escapeHtmlAttribute(d.alt ?? "")}"${attr("class", f.imageClass)}${attr("style", f.imageStyle)}>${d.caption ? `<figcaption${attr("class", f.captionClass)}${attr("style", f.captionStyle)}>${escapeHtmlAttribute(d.caption)}</figcaption>` : ""}</figure>`
  },
  replace(parent, _children, match) {
    const tree = fromHtml(match[0], { fragment: true })
    const figure = tree.children.find((node): node is Element => node.type === "element" && node.tagName === "figure")
    const img = figure?.children.find((node): node is Element => node.type === "element" && node.tagName === "img")
    if (!figure || !img) return false
    const caption = figure.children.find((node): node is Element => node.type === "element" && node.tagName === "figcaption")
    const p = figure.properties
    const side = p.dataFlowImage
    const node = $createImageNode(String(img.properties.src ?? ""), String(img.properties.alt ?? ""), side === "left" ? "flow-left" : side === "right" ? "flow-right" : "block", normalizeFlowWidth(p.dataFlowWidth), p.dataImageTheme === "adaptive" ? "adaptive-monochrome" : "original")
    node.setBlockWidth(imageNumber(p.dataEditorWidth, 100, 100))
    node.setAlignment(p.dataEditorImage as "left" | "center" | "right")
    node.setCaption(caption?.children.map(child => child.type === "text" ? child.value : "").join("") ?? "")
    const classes = (element?: Element) => Array.isArray(element?.properties.className) ? element.properties.className.join(" ") : String(element?.properties.className ?? "")
    node.setFormatting({
      width: imageNumber(p.dataImageWidth ?? (side ? p.dataFlowWidth : p.dataEditorWidth), side ? 42 : 100),
      unit: p.dataImageUnit === "px" ? "px" : "%", gap: imageNumber(p.dataImageGap, 16, 256),
      figureClass: classes(figure), figureStyle: String(p.style ?? ""),
      imageClass: classes(img), imageStyle: String(img.properties.style ?? ""),
      captionClass: classes(caption), captionStyle: String(caption?.properties.style ?? ""),
    })
    parent.replace(node)
  },
}
