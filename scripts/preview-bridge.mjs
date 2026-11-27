import fs from "node:fs/promises"
import path from "node:path"
import os from "node:os"
import { createRequire } from "node:module"
import { fileURLToPath } from "node:url"
import { build } from "esbuild"
import postcss from "postcss"
import tailwind from "@tailwindcss/postcss"

const root = fileURLToPath(new URL("../", import.meta.url))
const temporary = await fs.mkdtemp(path.join(os.tmpdir(), "bridge-preview-"))
const output = path.join(root, "outputs/the-bridge-preview.html")
try {
  await build({
    stdin: {
      contents: `
        import React from 'react';
        import {renderToStaticMarkup} from 'react-dom/server';
        import {BridgeMatch} from './src/components/links/BridgeMatch';
        import '@astryxdesign/core/reset.css';
        import '@astryxdesign/core/astryx.css';
        export const markup = renderToStaticMarkup(<BridgeMatch red={{name:'Domenyk',score:3}} blue={{name:'Adversario',score:2}} elapsedSeconds={139}/>);
      `,
      resolveDir: root,
      sourcefile: "bridge-preview.tsx",
      loader: "tsx",
    },
    outfile: path.join(temporary, "render.cjs"),
    platform: "node",
    format: "cjs",
    bundle: true,
    jsx: "automatic",
    tsconfig: path.join(root, "tsconfig.json"),
    loader: { ".woff2": "dataurl", ".woff": "dataurl", ".ttf": "dataurl" },
    plugins: [{ name: "preview-font", setup(builder) {
      builder.onResolve({ filter: /^next\/font\/local$/ }, () => ({ path: "local-font", namespace: "preview" }))
      builder.onLoad({ filter: /.*/, namespace: "preview" }, () => ({ contents: `export default () => ({className:'bridge-pixel-font'})` }))
    } }],
  })
  const require = createRequire(import.meta.url)
  const { markup } = require(path.join(temporary, "render.cjs"))
  const compiled = await postcss([tailwind()]).process('@import "tailwindcss"; @import "@astryxdesign/core/tailwind-theme.css";', { from: path.join(root, "bridge-preview.css") })
  const css = await fs.readFile(path.join(temporary, "render.css"), "utf8")
  const layers = await fs.readFile(path.join(root, "src/app/layers.css"), "utf8")
  const font = (await fs.readFile(path.join(root, "public/fonts/monocraft/Monocraft.ttf"))).toString("base64")
  const geist = (await fs.readFile(path.join(root, "node_modules/next/dist/next-devtools/server/font/geist-latin.woff2"))).toString("base64")
  const icon = (await fs.readFile(path.join(root, "public/images/links/the-bridge.png"))).toString("base64")
  const html = `<!doctype html>
<html lang="pt-BR" class="dark-mode"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="dark"><title>The Bridge · Prévia</title>
<style>${layers}\n${css}\n${compiled.css}
@font-face{font-family:Monocraft;src:url(data:font/ttf;base64,${font}) format('truetype');font-display:swap}
@font-face{font-family:Geist;src:url(data:font/woff2;base64,${geist}) format('woff2');font-display:swap}
html{--font-text:Geist;--font-display:Geist;color-scheme:dark}
body{margin:0;background:#050505;color:#ebebeb;font-family:Geist,system-ui,sans-serif}
.preview-shell{width:100%;max-width:36rem;margin:0 auto;padding:2rem 1rem}
@media(min-width:40rem){.preview-shell{width:min(100%,34.5rem);max-width:100vw}}
.preview-note{margin:0;font:12px/1.5 Geist,sans-serif;color:#a3a3a3}
.bridge-pixel-font{font-family:Monocraft,monospace}
</style></head><body><main class="preview-shell"><p class="preview-note">Prévia · Nomes e placar de demonstração</p>${markup.replaceAll('/images/links/the-bridge.png', `data:image/png;base64,${icon}`)}</main></body></html>`
  await fs.mkdir(path.dirname(output), { recursive: true })
  await fs.writeFile(output, html)
  console.log(output)
} finally {
  await fs.rm(temporary, { recursive: true, force: true })
}
