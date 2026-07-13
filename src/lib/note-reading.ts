export type NoteReadingEstimate = {
  wordCount: number
  sentenceCount: number
  effectiveWordsPerMinute: number
  estimatedReadingSeconds: number
  directViewThresholdMs: number
  impressionThresholdMs: number
  impressionVisibleRatio: number
  complexity: "leve" | "moderada" | "densa"
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value))
}

function plainText(markdown: string) {
  return markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)]\([^)]*\)/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[*_~`>#|]/g, " ")
}

export function estimateNoteReading(markdown: string, galleryImages = 0): NoteReadingEstimate {
  const text = plainText(markdown)
  const words = text.match(/[\p{L}\p{N}]+(?:[-’'][\p{L}\p{N}]+)*/gu) ?? []
  const sentences = text.split(/[.!?]+(?:\s|$)/).map((sentence) => sentence.trim()).filter(Boolean)
  const wordCount = words.length
  const sentenceCount = sentences.length
  const averageSentenceWords = wordCount / Math.max(1, sentenceCount)
  const longWordRatio = words.filter((word) => word.replace(/[^\p{L}]/gu, "").length >= 9).length / Math.max(1, wordCount)
  const structuralMarkers = (markdown.match(/^(?:\s*[-*+]\s+|\s*\d+\.\s+|\s*>\s+|#{1,6}\s+)/gm) ?? []).length
  const markdownImages = (markdown.match(/!\[[^\]]*]\([^)]*\)/g) ?? []).length
  const imageCount = markdownImages + Math.max(0, galleryImages)

  const sentencePenalty = clamp((averageSentenceWords - 14) * 0.012, 0, 0.22)
  const lexicalPenalty = clamp((longWordRatio - 0.1) * 1.5, 0, 0.22)
  const structurePenalty = clamp(structuralMarkers / Math.max(8, wordCount) * 1.8, 0, 0.12)
  const effectiveWordsPerMinute = Math.round(clamp(225 / (1 + sentencePenalty + lexicalPenalty + structurePenalty), 150, 225))
  const estimatedReadingSeconds = Math.max(4, Math.ceil(wordCount / effectiveWordsPerMinute * 60 + imageCount * 4))
  const directViewThresholdMs = clamp(Math.round(estimatedReadingSeconds * 0.35), 7, 45) * 1000
  const impressionThresholdMs = clamp(Math.round(estimatedReadingSeconds * 0.25), 7, 32) * 1000
  const impressionVisibleRatio = wordCount <= 90 ? 0.7 : wordCount <= 200 ? 0.55 : wordCount <= 350 ? 0.4 : 0.3
  const complexityScore = sentencePenalty + lexicalPenalty + structurePenalty
  const complexity = complexityScore >= 0.24 ? "densa" : complexityScore >= 0.1 ? "moderada" : "leve"

  return {
    wordCount,
    sentenceCount,
    effectiveWordsPerMinute,
    estimatedReadingSeconds,
    directViewThresholdMs,
    impressionThresholdMs,
    impressionVisibleRatio,
    complexity,
  }
}
