import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import ts from 'typescript'

const require = createRequire(import.meta.url)
const source = ts.transpileModule(fs.readFileSync('src/components/notes/NoteShareButton.tsx', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText

function mount(writeText) {
  const state = [false, '']
  const timers = []
  let index = 0
  const loadedModule = { exports: {} }
  const mockRequire = name => {
    if (name === 'react') return { useState: () => {
      const slot = index++
      return [state[slot], value => { state[slot] = value }]
    } }
    if (name.startsWith('@heroicons/')) return { ShareIcon: () => null }
    return require(name)
  }
  new Function('require', 'module', 'exports', 'navigator', 'window', source)(
    mockRequire, loadedModule, loadedModule.exports,
    { clipboard: { writeText } },
    { location: { origin: 'https://domenyk.com', href: 'https://domenyk.com/?feed=1' }, setTimeout: callback => timers.push(callback) },
  )
  return {
    state, timers,
    render() {
      index = 0
      return loadedModule.exports.NoteShareButton({ noteId: 'nota-123' })
    },
  }
}

test('sharing from a feed copies the selected note permalink and confirms only after success', async () => {
  const copiedUrls = []
  const component = mount(async url => copiedUrls.push(url))
  const button = component.render().props.children[0]
  await button.props.onClick()
  assert.deepEqual(copiedUrls, ['https://domenyk.com/notes/nota-123'])
  assert.equal(component.render().props.children[0].props['aria-label'], 'Link copiado')
  component.timers[0]()
  assert.equal(component.render().props.children[0].props['aria-label'], 'Compartilhar nota')
})

test('clipboard failure is reported without a false copied confirmation', async () => {
  const component = mount(async () => { throw new Error('Permission denied') })
  await component.render().props.children[0].props.onClick()
  const rendered = component.render()
  assert.equal(rendered.props.children[0].props['aria-label'], 'Compartilhar nota')
  assert.equal(rendered.props.children[1].props.role, 'alert')
  assert.equal(component.timers.length, 0)
})
