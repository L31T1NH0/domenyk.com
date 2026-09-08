export const TEXT_SIZES = ["auto", "14", "16", "18", "20", "24", "28", "32", "40"]
export const TEXT_LEADING = ["auto", "1.2", "1.4", "1.6", "1.8", "2"]
export const TEXT_SPACING = ["auto", "0", "8", "16", "24", "32"]
export const TEXT_TONES = ["none", "neutral", "sand", "rose", "blue"]
export const TEXT_ALIGN = ["left", "center", "right", "justify"]

/** @typedef {{ align: string, size: string, leading: string, spacing: string, tone: string }} EditorialText */
/** @type {EditorialText} */
export const DEFAULT_EDITORIAL_TEXT = { align: "left", size: "auto", leading: "auto", spacing: "auto", tone: "none" }

/** @param {Partial<EditorialText>} value @returns {EditorialText} */
export function normalizeEditorialText(value) {
  /** @param {readonly string[]} options @param {string | undefined} candidate @param {string} fallback */
  const allowed = (options, candidate, fallback) => candidate && options.includes(candidate) ? candidate : fallback
  return {
    align: allowed(TEXT_ALIGN, value.align, "left"),
    size: allowed(TEXT_SIZES, value.size, "auto"),
    leading: allowed(TEXT_LEADING, value.leading, "auto"),
    spacing: allowed(TEXT_SPACING, value.spacing, "auto"),
    tone: allowed(TEXT_TONES, value.tone, "none"),
  }
}

/** @param {Partial<EditorialText>} value */
export function editorialTextStyle(value) {
  const p = normalizeEditorialText(value)
  return [
    p.size !== "auto" && `font-size: min(${p.size}px, 8vw)`,
    p.leading !== "auto" && `line-height: ${p.leading}`,
    p.spacing !== "auto" && `margin-bottom: ${p.spacing}px`,
    p.tone !== "none" && `background-color: var(--editorial-tone-${p.tone})`,
    p.tone !== "none" && "padding: 1em",
  ].filter(Boolean).join("; ")
}

/** @param {string} style @param {string} align @returns {EditorialText} */
export function editorialTextFromStyle(style, align) {
  return normalizeEditorialText({
    align,
    size: style.match(/font-size:\s*min\((\d+)px/)?.[1],
    leading: style.match(/line-height:\s*([\d.]+)/)?.[1],
    spacing: style.match(/margin-bottom:\s*(\d+)px/)?.[1],
    tone: style.match(/--editorial-tone-(\w+)/)?.[1],
  })
}
