import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import ts from 'typescript'
const require = createRequire(import.meta.url)
const cache = new Map()
function load(filename) {
  const absolute = path.resolve(filename)
  if (cache.has(absolute)) return cache.get(absolute).exports
  const loadedModule = { exports: {} }; cache.set(absolute, loadedModule)
  const source = ts.transpileModule(fs.readFileSync(absolute, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText
  const resolve = name => {
    // Node serialization tests do not mount the React decorator.
    if (name.startsWith('@lexical/react/') || name.startsWith('@heroicons/')) return {}
    if (!name.startsWith('.') && !name.startsWith('@/')) return require(name)
    const base = name.startsWith('@/') ? path.resolve('src', name.slice(2)) : path.resolve(path.dirname(absolute), name)
    const file = [base, base+'.ts', base+'.tsx', base+'.js'].find(file => fs.existsSync(file) && fs.statSync(file).isFile())
    if (!file) throw Error(name)
    return load(file)
  }
  new Function('require', 'module', 'exports', source)(resolve, loadedModule, loadedModule.exports)
  return loadedModule.exports
}
const lexical = require('lexical')
const md = require('@lexical/markdown')
const rich = require('@lexical/rich-text')
const lists = require('@lexical/list')
const { CodeNode } = require('@lexical/code')
const { LinkNode } = require('@lexical/link')
const images = load('src/components/editor/ImageNode.tsx')
const { createEditorialTextTransformer } = load('src/components/editor/editorial-transformer.ts')
const base = [images.POSITIONED_IMAGE_TRANSFORMER, images.FLOW_IMAGE_TRANSFORMER, images.HTML_IMAGE_TRANSFORMER, images.IMAGE_TRANSFORMER, ...md.TRANSFORMERS]
const transformers = [createEditorialTextTransformer(base), ...base]
function roundtrip(markdown) {
  const editor = lexical.createEditor({ namespace:'roundtrip', nodes:[rich.HeadingNode, rich.QuoteNode, lists.ListNode, lists.ListItemNode, CodeNode, LinkNode, images.ImageNode], onError(error) { throw error } })
  editor.update(() => md.$convertFromMarkdownString(markdown, transformers), { discrete:true })
  return editor.getEditorState().read(() => md.$convertToMarkdownString(transformers))
}

test('paragraph composition survives save, reopen and another save', () => {
  for (const body of ['**Texto** com *ênfase*.', '## Um título', '> Uma citação']) {
    const content = `:::editor center 24 1.8 16 sand\n\n${body}\n\n:::`
    assert.equal(roundtrip(content), content)
    assert.equal(roundtrip(roundtrip(content)), content)
  }
})

test('image positioning, escaped caption and theme survive reopening', () => {
  const content = '<figure data-editor-image="right" data-editor-width="60" data-image-theme="adaptive"><img src="https://example.com/photo.png" alt="Foto"><figcaption>Uma &quot;legenda&quot;</figcaption></figure>'
  assert.equal(roundtrip(content), content)
})

test('old markdown images and unstyled text retain their format', () => {
  const content = 'Um texto **forte**.\n\n![Foto](https://example.com/photo.png)'
  assert.equal(roundtrip(content), content)
})

test('neighboring styled paragraphs remain separate after reopening', () => {
  const parts = ['center auto auto auto none','right auto auto 16 rose','right auto auto auto none']
  const content = parts.map((format, i) => `:::editor ${format}\n\nteste ${i}\n\n:::`).join('\n\n')
  assert.equal(roundtrip(content), content)
  assert.equal(roundtrip(roundtrip(content)), content)
})

test('empty styled paragraphs cannot join closing and opening markers', async () => {
  const { renderMarkdownSync } = await import('../src/lib/mdx.ts')
  const editor = lexical.createEditor({ namespace:'empty-paragraphs', nodes:[rich.HeadingNode, rich.QuoteNode], onError(error) { throw error } })
  editor.update(() => {
    for (const text of ['teste', '', '', 'eba']) {
      const paragraph = lexical.$createParagraphNode().setFormat('center')
      if (text) paragraph.append(lexical.$createTextNode(text))
      lexical.$getRoot().append(paragraph)
    }
  }, { discrete:true })
  const markdown = editor.getEditorState().read(() => md.$convertToMarkdownString(transformers))
  assert.doesNotMatch(renderMarkdownSync(markdown), /:::editor/)
  assert.doesNotMatch(renderMarkdownSync(roundtrip(markdown)), /:::editor/)
})

test('v5 image dimensions, classes, styles and caption survive Markdown and JSON reopening', () => {
  const editor = lexical.createEditor({ namespace: 'v5-images', nodes: [images.ImageNode], onError(error) { throw error } })
  editor.update(() => {
    const node = images.$createImageNode('/images/person.webp', 'Pessoa', 'flow-right')
    node.setCaption('Crédito & contexto')
    node.setFormatting({ width: 260, unit: 'px', gap: 24, figureClass: 'portrait', figureStyle: 'margin-left: 12px', imageClass: 'cutout', imageStyle: 'object-fit: contain', captionClass: 'credit', captionStyle: 'text-align: right' })
    lexical.$getRoot().append(node)
  }, { discrete: true })
  const saved = editor.getEditorState().toJSON()
  assert.equal(saved.root.children[0].type, 'image')
  assert.equal(saved.root.children[0].version, 5)
  const markdown = editor.getEditorState().read(() => md.$convertToMarkdownString(transformers))
  assert.match(markdown, /data-image-width="260" data-image-unit="px" data-image-gap="24"/)
  assert.equal(roundtrip(markdown), markdown)
  assert.equal(roundtrip(roundtrip(markdown)), markdown)
  editor.setEditorState(editor.parseEditorState(saved))
  assert.deepEqual(editor.getEditorState().toJSON(), saved)
})

test('old serialized images acquire v5 defaults without changing stored layout', () => {
  for (const version of [1, 2, 3, 4]) {
    const editor = lexical.createEditor({ namespace: `legacy-${version}`, nodes: [images.ImageNode], onError(error) { throw error } })
    editor.update(() => lexical.$getRoot().append(images.ImageNode.importJSON({ type: 'image', version, src: '/images/old.png', layout: 'flow-left', flowWidth: 32 })), { discrete: true })
    const node = editor.getEditorState().toJSON().root.children[0]
    assert.equal(node.version, 5)
    assert.equal(node.layout, 'flow-left')
    assert.equal(node.flowWidth, 32)
    assert.equal(node.blockWidth, 100)
  }
})

test('image insertion splits paragraphs at start, middle and end using a saved selection', () => {
  const { $insertEditorBlock } = load('src/components/editor/insert-editor-block.ts')
  for (const offset of [0, 6, 12]) {
    const editor = lexical.createEditor({ namespace: `insert-${offset}`, nodes: [images.ImageNode], onError(error) { throw error } })
    let selection
    editor.update(() => {
      const text = lexical.$createTextNode('Antes Depois')
      lexical.$getRoot().append(lexical.$createParagraphNode().append(text))
      text.select(offset, offset)
      selection = lexical.$getSelection().clone()
    }, { discrete: true })
    // A library/upload temporarily removes the editor's selection.
    editor.update(() => lexical.$setSelection(null), { discrete: true })
    editor.update(() => {
      lexical.$setSelection(selection.clone())
      $insertEditorBlock(images.$createImageNode('/images/new.png', '', 'flow-left'))
    }, { discrete: true })
    const children = editor.getEditorState().toJSON().root.children
    const figure = children.findIndex(node => node.type === 'image')
    const textOf = nodes => nodes.flatMap(node => node.children ?? []).map(node => node.text ?? '').join('')
    assert.equal(textOf(children.slice(0, figure)), 'Antes Depois'.slice(0, offset))
    assert.equal(textOf(children.slice(figure + 1)), 'Antes Depois'.slice(offset))
    assert.equal(children.filter(node => node.type === 'image').length, 1)
  }
})
