export const HTML_DOCUMENT_ATTRIBUTE = 'data-editor-document'
export const MAX_RICH_CONTENT_LENGTH = 300_000
export const SAFE_PUBLICATION_HTML_TAGS = [
  'a', 'abbr', 'article', 'aside', 'b', 'blockquote', 'br', 'cite', 'code',
  'dd', 'del', 'details', 'div', 'dl', 'dt', 'em', 'figcaption', 'figure',
  'footer', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'header', 'hr', 'i', 'img',
  'iframe', 'ins', 'kbd', 'li', 'main', 'mark', 'nav', 'ol', 'p', 'picture', 'pre', 'q',
  'rp', 'rt', 'ruby', 's', 'samp', 'section', 'small', 'source', 'span',
  'strike', 'strong', 'sub', 'summary', 'sup', 'table', 'tbody', 'td', 'tfoot',
  'th', 'thead', 'time', 'tr', 'tt', 'ul', 'var',
]
const SAFE_PUBLICATION_HTML_START = new RegExp(
  `^\\s*<(?:${SAFE_PUBLICATION_HTML_TAGS.join('|')})(?=[\\s/>])`,
  'i'
)

/** @param {string} content */
export function looksLikePublicationHtml(content) {
  return SAFE_PUBLICATION_HTML_START.test(content)
}

/** @param {string} content */
export function isHtmlContent(content) {
  return /^\s*<div\b(?=[^>]*\bdata-editor-document=["']html["'])[^>]*>/i.test(content)
}

/** @param {string} content */
export function isHtmlSourceContent(content) {
  return /^\s*<div\b(?=[^>]*\bdata-editor-document=["']html["'])(?=[^>]*\bdata-editor-source=["']raw["'])[^>]*>/i.test(content)
}

/** Only editorial CSS is retained. Layout, URL and arbitrary CSS are rejected.
 * @param {string} style
 */
export function safeEditorialStyle(style) {
  const rules = {
    'text-align': /^(left|center|right|justify|start|end)$/,
    'font-size': /^(?:min\((?:14|16|18|20|24|28|32|40)px,\s*8vw\)|(?:1[0-9]|[2-6][0-9]|7[0-2])px)$/,
    'line-height': /^(?:1(?:\.\d{1,2})?|2(?:\.\d{1,2})?|3)$/,
    'margin-bottom': /^(?:0|[1-5]?[0-9]|6[0-4])px$/,
    'padding': /^1em$/,
    'font-weight': /^(?:normal|bold|[1-9]00)$/,
    'font-style': /^(?:normal|italic)$/,
    'text-decoration': /^(?:none|underline|line-through|underline line-through)$/,
    'white-space': /^(?:normal|pre-wrap)$/,
    'color': /^(?:#[a-f\d]{3,8}|rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\))$/i,
    'background-color': /^(?:var\(--editorial-tone-(?:neutral|sand|rose|blue)\)|#[a-f\d]{3,8}|rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\))$/i,
  }
  return style.split(';').flatMap(declaration => {
    const separator = declaration.indexOf(':')
    const key = declaration.slice(0, separator).trim().toLowerCase()
    const value = declaration.slice(separator + 1).trim()
    const rule = Object.hasOwn(rules, key) ? rules[/** @type {keyof typeof rules} */ (key)] : null
    return separator > 0 && rule?.test(value) ? [`${key}: ${value}`] : []
  }).join('; ')
}
