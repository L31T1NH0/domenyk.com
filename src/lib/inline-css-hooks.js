const INLINE_CSS_HOOK_PATTERN = /::([^:\n]+?)::/g

/** @param {string} value */
export function cssHookSlug(value) {
  const slug = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
  return slug || "trecho"
}

/**
 * `::texto::` derives its hook from the text. `::nome|texto::` keeps a stable
 * hook even when the visible words change.
 * @param {string} inner
 */
export function inlineCssHookValue(inner) {
  const separator = inner.indexOf("|")
  const explicitName = separator > 0 ? inner.slice(0, separator).trim() : ""
  const text = (separator > 0 ? inner.slice(separator + 1) : inner).trim()
  if (!text) return null
  return {
    id: cssHookSlug(explicitName || text),
    label: explicitName || text,
    text,
  }
}

/**
 * @param {string} value
 * @param {Map<string, number>} [occurrences]
 * @returns {Array<{type:"text",value:string}|{type:"hook",id:string,label:string,text:string,source:string}>}
 */
export function splitInlineCssHooks(value, occurrences = new Map()) {
  const parts = []
  let cursor = 0
  let match
  const matcher = new RegExp(INLINE_CSS_HOOK_PATTERN.source, INLINE_CSS_HOOK_PATTERN.flags)

  while ((match = matcher.exec(value)) !== null) {
    const hook = inlineCssHookValue(match[1])
    if (!hook) continue
    if (match.index > cursor) parts.push({ type: "text", value: value.slice(cursor, match.index) })

    const count = (occurrences.get(hook.id) ?? 0) + 1
    occurrences.set(hook.id, count)
    parts.push({
      type: "hook",
      id: count === 1 ? hook.id : `${hook.id}-${count}`,
      label: hook.label,
      text: hook.text,
      source: match[0],
    })
    cursor = match.index + match[0].length
  }

  if (cursor === 0) return [{ type: "text", value }]
  if (cursor < value.length) parts.push({ type: "text", value: value.slice(cursor) })
  return parts
}

/** @param {string} value */
export function stripInlineCssHookSyntax(value) {
  return splitInlineCssHooks(value)
    .map(part => part.type === "hook" ? part.text : part.value)
    .join("")
}
