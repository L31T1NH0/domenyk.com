"use client"

import {
  DecoratorNode,
  $createParagraphNode,
  type LexicalNode,
  type NodeKey,
  type SerializedLexicalNode,
  type Spread,
} from "lexical"
import type { ElementTransformer } from "@lexical/markdown"

type SerializedImageNode = Spread<
  { src: string; alt?: string; type: "image"; version: 1 },
  SerializedLexicalNode
>

export class ImageNode extends DecoratorNode<React.ReactNode> {
  __src: string
  __alt: string

  static getType() { return "image" }
  static clone(node: ImageNode) { return new ImageNode(node.__src, node.__alt, node.__key) }

  constructor(src: string, alt = "", key?: NodeKey) {
    super(key)
    this.__src = src
    this.__alt = alt
  }

  createDOM() {
    return document.createElement("span")
  }

  updateDOM() { return false }

  static importJSON(serialized: SerializedImageNode): ImageNode {
    return new ImageNode(serialized.src, serialized.alt)
  }

  exportJSON(): SerializedImageNode {
    return { src: this.__src, alt: this.__alt, type: "image", version: 1 }
  }

  decorate() {
    return <img src={this.__src} alt={this.__alt} className="max-w-full rounded-lg my-2" style={{ filter: "none" }} />
  }

  getSrc() {
    return this.__src
  }

  getAlt() {
    return this.__alt
  }
}

export function $createImageNode(src: string, alt?: string): ImageNode {
  return new ImageNode(src, alt)
}

export function $isImageNode(node: LexicalNode | null | undefined): node is ImageNode {
  return node instanceof ImageNode
}

export const IMAGE_TRANSFORMER: ElementTransformer = {
  dependencies: [ImageNode],
  export: (node) => {
    if (!$isImageNode(node)) return null
    return `![${node.getAlt()}](${node.getSrc()})`
  },
  regExp: /^!\[([^\]]*)\]\(([^)]+)\)$/,
  replace: (parentNode, _children, match) => {
    const [, alt, src] = match
    const paragraph = $createParagraphNode()
    paragraph.append($createImageNode(src, alt))
    parentNode.replace(paragraph)
  },
  type: "element",
}
