import { safeEditorialStyle } from './content-format.js'

/** @param {unknown} value @param {number} fallback @param {number} maximum */
export function imageNumber(value, fallback, maximum = 4000) {
  const number = Number(value)
  return value !== '' && value != null && Number.isFinite(number)
    ? Math.min(maximum, Math.max(0, number)) : fallback
}

/** Image URLs also become CSS shape sources. Never accept a second URL or declaration.
 * @param {string} source */
export function imageShape(source) {
  if (!/^(?:https?:\/\/|\/(?!\/))/i.test(source) || /[\u0000-\u0020]/.test(source)) return 'none'
  return `url("${source.replace(/[\\"<>;{}]/g, char => encodeURIComponent(char))}")`
}

/** Defaults use custom properties so authored width/margin/shape rules win.
 * @param {string} source @param {unknown} width @param {unknown} unit @param {unknown} gap */
export function imageDefaults(source, width, unit, gap) {
  const suffix = unit === 'px' ? 'px' : '%'
  return `--image-width:${imageNumber(width, 100, suffix === '%' ? 100 : 4000)}${suffix};--image-gap:${imageNumber(gap, 16, 256)}px;--image-shape:${imageShape(source)}`
}

/** Supported figure/image formatting; URLs are only derived from validated src.
 * @param {string} style */
export function safeImageStyle(style) {
  const length = '(?:0|(?:\\d{1,4}(?:\\.\\d{1,2})?)(?:px|%|em|rem))'
  const dimension = new RegExp(`^(?:auto|${length})$`)
  const margin = new RegExp(`^(?:auto|${length})(?:\\s+(?:auto|${length})){0,3}$`)
  const rules = {
    width: dimension, height: dimension, 'max-width': dimension, 'max-height': dimension,
    'min-width': dimension, 'min-height': dimension,
    margin, 'margin-inline': margin, 'margin-block': margin,
    'margin-left': dimension, 'margin-right': dimension, 'margin-top': dimension, 'margin-bottom': dimension,
    float: /^(none|left|right|inline-start|inline-end)$/,
    clear: /^(none|left|right|both|inline-start|inline-end)$/,
    'object-fit': /^(fill|contain|cover|none|scale-down)$/,
    'object-position': /^(?:(?:left|center|right|top|bottom|\d{1,3}(?:\.\d+)?%)(?:\s+|$)){1,2}$/,
    'aspect-ratio': /^(?:auto|\d{1,4}(?:\.\d+)?\s*\/\s*\d{1,4}(?:\.\d+)?)$/,
    'shape-margin': dimension,
    'shape-outside': /^(?:none|margin-box|border-box|padding-box|content-box|(?:inset|circle|ellipse|polygon)\([\d\s.,%pxemratoflighnbd-]+\))$/,
    'shape-image-threshold': /^(?:0(?:\.\d+)?|1(?:\.0+)?)$/,
    'border-radius': margin,
  }
  const image = style.split(';').flatMap(declaration => {
    const separator = declaration.indexOf(':')
    const key = declaration.slice(0, separator).trim().toLowerCase()
    const value = declaration.slice(separator + 1).trim()
    const rule = Object.hasOwn(rules, key) ? rules[/** @type {keyof typeof rules} */ (key)] : null
    return separator > 0 && rule?.test(value) ? [`${key}: ${value}`] : []
  })
  return [safeEditorialStyle(style), ...image].filter(Boolean).join('; ')
}

/** @param {string} value */
export function imageClasses(value) {
  return value.split(/\s+/).filter(token => /^[a-zA-Z_][a-zA-Z0-9_-]*$/.test(token)).join(' ')
}
