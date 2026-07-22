import { $insertNodeToNearestRoot } from "@lexical/utils"
import type { LexicalNode } from "lexical"

/**
 * Inserts a block without letting Lexical merge its children into the
 * paragraph at the current selection.
 */
export function $insertEditorBlock<T extends LexicalNode>(node: T): T {
  return $insertNodeToNearestRoot(node)
}
