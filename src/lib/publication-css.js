import postcss from "postcss"

export const MAX_PUBLICATION_CSS = 12_000
const PUBLICATION_CSS_TEMPLATE = /<template\s+data-editor-css=(?:"([^"]*)"|'([^']*)')\s*>\s*<\/template>/i

/** @param {string} content */
export function extractPublicationCss(content) {
  const match = content.match(PUBLICATION_CSS_TEMPLATE)
  const encoded = match?.[1] ?? match?.[2] ?? ""
  if (!encoded) return ""

  try {
    return decodeURIComponent(encoded).slice(0, MAX_PUBLICATION_CSS)
  } catch {
    return ""
  }
}

/** Keep stylesheet rules local: global registries and external imports are not
 * part of a publication stylesheet. Every authored selector receives the
 * publication surface prefix before the stylesheet reaches the browser. */
/** @param {string} source @param {string} selector */
export function compilePublicationCss(source, selector) {
  if (!source.trim()) return ""
  if (source.length > MAX_PUBLICATION_CSS) throw new Error("O CSS deve ter até 12.000 caracteres.")
  let sheet
  try { sheet = postcss.parse(source) } catch {
    throw new Error("O CSS está incompleto. Confira as chaves e os valores.")
  }
  sheet.walkAtRules(rule => {
    if (!["media", "supports", "container"].includes(rule.name.toLowerCase())) {
      throw new Error(`@${rule.name} não está disponível no CSS da publicação.`)
    }
  })
  sheet.walkDecls(declaration => {
    const globalProperty = /^(?:behavior|-moz-binding|anchor-name|anchor-scope|view-transition-name|timeline-scope|scroll-timeline-name|view-timeline-name)$/i.test(declaration.prop)
    const externalValue = /url\s*\(|expression\s*\(/i.test(declaration.value)
    if (declaration.prop.toLowerCase() === "display" && /\bcontents\b/i.test(declaration.value)) {
      throw new Error("display: contents removeria o limite visual da publicação.")
    }
    if (globalProperty || externalValue) {
      throw new Error(`A propriedade ${declaration.prop} contém um recurso externo ou global.`)
    }
  })
  sheet.walkRules(rule => {
    rule.selectors = rule.selectors.map(authoredSelector => {
      const authored = authoredSelector.trim()
      if (authored.includes("&")) {
        throw new Error("Use seletores completos; o aninhamento com & não está disponível.")
      }
      if (authored === ":scope") return selector
      if (authored.startsWith(":scope")) {
        const descendant = authored.slice(6)
        if (/^(?:\s+|>)/.test(descendant)) return `${selector}${descendant}`
        throw new Error("Depois de :scope, use um espaço ou > para selecionar apenas conteúdo interno.")
      }
      if (authored.includes(":scope")) {
        throw new Error("Use :scope somente no início do seletor.")
      }
      return `${selector} ${authored}`
    })
  })
  // The impossible double-id inside :not() gives the boundary enough cascade
  // weight to survive ordinary :scope selectors, including authored !important.
  const boundarySelector = `${selector}:not(#publication-css-boundary#publication-css-surface)`
  const boundaryRule = `${boundarySelector} { ${PUBLICATION_BOUNDARY_STYLE} }`
  return `${sheet.toString()}\n${boundaryRule}`.replace(/<\/style/gi, "\\3c /style")
}

// These belong to the publication boundary, not to the authored stylesheet.
// Keep the boundary inside its column and clip authored layout to that box.
export const PUBLICATION_BOUNDARY_STYLE = [
  "contain: paint style", "isolation: isolate", "overflow: hidden", "overflow: clip",
  "position: relative", "float: none", "box-sizing: border-box",
  "max-width: 100%", "min-width: 0",
  "margin: 0",
  "inset: auto", "transform: none", "translate: none", "rotate: none", "scale: none",
  "z-index: auto", "filter: none", "backdrop-filter: none", "box-shadow: none", "outline: none",
].map(value => `${value} !important`).join("; ")
