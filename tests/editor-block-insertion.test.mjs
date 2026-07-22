import assert from "node:assert/strict"
import test from "node:test"

import {
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  createEditor,
} from "lexical"
import { $insertEditorBlock } from "../src/components/editor/insert-editor-block.ts"

test("keeps an inserted media block separate from the paragraph at the selection", () => {
  const editor = createEditor({
    namespace: "editor-block-insertion-test",
    onError: (error) => { throw error },
  })

  editor.update(() => {
    const paragraph = $createParagraphNode().append($createTextNode("Texto existente."))
    $getRoot().append(paragraph)
    paragraph.selectEnd()

    $insertEditorBlock($createParagraphNode().append($createTextNode("MEDIA_BLOCK")))
  }, { discrete: true })

  const root = editor.getEditorState().toJSON().root
  assert.equal(root.children.length, 3)
  assert.equal(root.children[0].children[0].text, "Texto existente.")
  assert.equal(root.children[1].children[0].text, "MEDIA_BLOCK")
  assert.equal(root.children[2].children.length, 0)
})
