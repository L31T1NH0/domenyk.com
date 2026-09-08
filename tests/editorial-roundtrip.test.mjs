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
  const module = { exports: {} }; cache.set(absolute, module)
  const source = ts.transpileModule(fs.readFileSync(absolute, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText
  const resolve = name => {
    // Node serialization tests do not mount the React decorator.
    if (name === '@lexical/react/LexicalComposerContext' || name.startsWith('@heroicons/')) return {}
    if (!name.startsWith('.') && !name.startsWith('@/')) return require(name)
    const base = name.startsWith('@/') ? path.resolve('src', name.slice(2)) : path.resolve(path.dirname(absolute), name)
    const file = [base, base+'.ts', base+'.tsx', base+'.js'].find(file => fs.existsSync(file) && fs.statSync(file).isFile())
    if (!file) throw Error(name)
    return load(file)
  }
  new Function('require', 'module', 'exports', source)(resolve, module, module.exports)
  return module.exports
}
const lexical = require('lexical')
const md = require('@lexical/markdown')
const rich = require('@lexical/rich-text')
const lists = require('@lexical/list')
const { CodeNode } = require('@lexical/code')
const { LinkNode } = require('@lexical/link')
const images = load('src/components/editor/ImageNode.tsx')
const { createEditorialTextTransformer } = load('src/components/editor/editorial-transformer.ts')
const base = [images.POSITIONED_IMAGE_TRANSFORMER, images.FLOW_IMAGE_TRANSFORMER, images.IMAGE_TRANSFORMER, ...md.TRANSFORMERS]
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
