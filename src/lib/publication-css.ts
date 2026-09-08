import postcss from "postcss"

export const MAX_PUBLICATION_CSS = 12_000
const PUBLICATION_CSS_TEMPLATE = /<template\s+data-editor-css=(?:"([^"]*)"|'([^']*)')\s*>\s*<\/template>/i

export function extractPublicationCss(content: string): string {
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
export function compilePublicationCss(source: string, selector: string): string {
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
      if (authoredSelector.includes("&")) {
        throw new Error("Use seletores completos; o aninhamento com & não está disponível.")
      }
      return authoredSelector.includes(":scope")
        ? authoredSelector.replace(/:scope\b/g, selector)
        : `${selector} ${authoredSelector}`
    })
  })
  // The impossible double-id inside :not() gives the boundary enough cascade
  // weight to survive ordinary :scope selectors, including authored !important.
  const boundarySelector = `${selector}:not(#publication-css-boundary#publication-css-surface)`
  const boundaryRule = `${boundarySelector} { ${PUBLICATION_BOUNDARY_STYLE} }`
  return `${sheet.toString()}\n${boundaryRule}`.replace(/<\/style/gi, "\\3c /style")
}

// These belong to the existing reading surface, not to the authored stylesheet.
// Keep its typography and display mode intact while preventing authored layout
// from covering or repositioning the rest of the page.
export const PUBLICATION_BOUNDARY_STYLE = [
  "contain: paint style", "isolation: isolate", "overflow: clip",
  "position: relative", "float: none", "box-sizing: border-box",
  "max-width: 100%", "min-width: 0",
  "margin: 0",
  "inset: auto", "transform: none", "translate: none", "rotate: none", "scale: none",
  "z-index: auto", "filter: none", "backdrop-filter: none", "box-shadow: none", "outline: none",
].map(value => `${value} !important`).join("; ")
