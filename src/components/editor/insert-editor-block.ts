import { $insertNodeToNearestRoot } from "@lexical/utils"
import { $getRoot, type LexicalNode } from "lexical"

/**
 * Inserts a block without letting Lexical merge its children into the
 * paragraph at the current selection.
 */
export function $insertEditorBlock<T extends LexicalNode>(node: T): T {
  return $insertNodeToNearestRoot(node)
}

/**
 * A contour image owns the flow at the start of the reading surface. Keeping
 * it as the first block guarantees that there is text after it for Pretext to
 * lay out, even when the toolbar was opened after the author finished typing.
 */
export function $insertEditorFlowBlock<T extends LexicalNode>(node: T): T {
  const root = $getRoot()
  const firstChild = root.getFirstChild()

  if (firstChild) firstChild.insertBefore(node)
  else root.append(node)

  return node
}
