import "server-only"

import { SaxesParser } from "saxes"

const SVG_NAMESPACE = "http://www.w3.org/2000/svg"
const MAX_ELEMENTS = 5_000
const MAX_DEPTH = 64
const MAX_ATTRIBUTES_PER_ELEMENT = 64
const MAX_SANITIZED_SVG_BYTES = 1024 * 1024

const ALLOWED_ELEMENTS = new Set([
  "svg",
  "g",
  "path",
  "rect",
  "circle",
  "ellipse",
  "line",
  "polyline",
  "polygon",
  "defs",
  "clipPath",
  "mask",
  "linearGradient",
  "radialGradient",
  "stop",
  "title",
  "desc",
])

const ALLOWED_ATTRIBUTES = new Set([
  "xmlns",
  "viewBox",
  "width",
  "height",
  "preserveAspectRatio",
  "id",
  "class",
  "transform",
  "transform-origin",
  "d",
  "x",
  "y",
  "x1",
  "x2",
  "y1",
  "y2",
  "cx",
  "cy",
  "r",
  "rx",
  "ry",
  "points",
  "pathLength",
  "fill",
  "fill-opacity",
  "fill-rule",
  "stroke",
  "stroke-width",
  "stroke-opacity",
  "stroke-linecap",
  "stroke-linejoin",
  "stroke-miterlimit",
  "stroke-dasharray",
  "stroke-dashoffset",
  "opacity",
  "clip-path",
  "clip-rule",
  "mask",
  "gradientUnits",
  "gradientTransform",
  "offset",
  "stop-color",
  "stop-opacity",
  "vector-effect",
  "color",
  "color-interpolation",
])

function escapeAttribute(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
}

function escapeText(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
}

function safeAttributeValue(name: string, value: string) {
  if (/[^\t\n\r\x20-\uFFFF]/u.test(value)) return false
  if (/javascript:|data:|https?:|\/\//i.test(value)) return false
  if (/url\s*\(/i.test(value) && !/^url\(#[A-Za-z_][\w:.-]*\)$/i.test(value.trim())) return false
  if (name === "xmlns" && value !== SVG_NAMESPACE) return false
  if (name === "id" && !/^[A-Za-z_][\w:.-]*$/.test(value)) return false
  return true
}

export function sanitizeSvg(data: Buffer): Buffer {
  if (data.length === 0 || data.length > MAX_SANITIZED_SVG_BYTES * 4) {
    throw new Error("Invalid SVG size")
  }

  const source = data.toString("utf8")
  if (source.includes("\uFFFD")) throw new Error("Invalid SVG encoding")

  const parser = new SaxesParser({ xmlns: false })
  const output: string[] = ['<?xml version="1.0" encoding="UTF-8"?>']
  const stack: string[] = []
  let failed: Error | null = null
  let elementCount = 0
  let sawRoot = false

  const reject = (message: string) => {
    if (!failed) failed = new Error(message)
  }

  parser.on("doctype", () => reject("SVG doctypes are not allowed"))
  parser.on("processinginstruction", () => reject("SVG processing instructions are not allowed"))
  parser.on("cdata", () => reject("SVG CDATA is not allowed"))
  parser.on("error", (error) => reject(error.message))
  parser.on("opentag", (tag) => {
    if (failed) return
    const name = tag.name
    elementCount += 1
    if (elementCount > MAX_ELEMENTS || stack.length >= MAX_DEPTH) {
      reject("SVG is too complex")
      return
    }
    if (!ALLOWED_ELEMENTS.has(name)) {
      reject(`SVG element ${name} is not allowed`)
      return
    }
    if (!sawRoot) {
      if (name !== "svg") {
        reject("SVG root element is required")
        return
      }
      sawRoot = true
    } else if (stack.length === 0 || name === "svg") {
      reject("Nested or multiple SVG roots are not allowed")
      return
    }

    const entries = Object.entries(tag.attributes)
    if (entries.length > MAX_ATTRIBUTES_PER_ELEMENT) {
      reject("SVG element has too many attributes")
      return
    }

    const attributes: string[] = []
    for (const [attributeName, value] of entries) {
      if (
        !ALLOWED_ATTRIBUTES.has(attributeName) ||
        /^on/i.test(attributeName) ||
        attributeName.includes(":") ||
        !safeAttributeValue(attributeName, value)
      ) {
        reject(`SVG attribute ${attributeName} is not allowed`)
        return
      }
      attributes.push(`${attributeName}="${escapeAttribute(value)}"`)
    }
    if (name === "svg" && !entries.some(([attributeName]) => attributeName === "xmlns")) {
      attributes.unshift(`xmlns="${SVG_NAMESPACE}"`)
    }

    output.push(`<${name}${attributes.length > 0 ? ` ${attributes.join(" ")}` : ""}>`)
    stack.push(name)
  })
  parser.on("text", (value) => {
    if (failed || value.length === 0) return
    const parent = stack.at(-1)
    if (parent === "title" || parent === "desc") output.push(escapeText(value))
    else if (value.trim().length > 0) reject("Text is only allowed in SVG title and description")
  })
  parser.on("closetag", (tag) => {
    if (failed) return
    const expected = stack.pop()
    if (expected !== tag.name) {
      reject("Malformed SVG nesting")
      return
    }
    output.push(`</${tag.name}>`)
  })

  parser.write(source).close()
  if (failed) throw failed
  if (!sawRoot || stack.length !== 0) throw new Error("Malformed SVG")

  const sanitized = Buffer.from(output.join(""), "utf8")
  if (sanitized.length > MAX_SANITIZED_SVG_BYTES) throw new Error("Sanitized SVG is too large")
  return sanitized
}
