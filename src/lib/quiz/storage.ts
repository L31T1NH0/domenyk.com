import { QUESTIONS, isAnswer } from "./questions"
import { DIMENSIONS, QUIZ_VERSION, SCHEMA_VERSION, type DraftAnswers, type QuizResult } from "./types"

export const STORAGE_KEY = `political-quiz:${QUIZ_VERSION}:schema-${SCHEMA_VERSION}`
export const LEGACY_STORAGE_KEY = "political-quiz:v0.1"

export function isDraftAnswers(value: unknown): value is DraftAnswers {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  const ids = new Set<string>(QUESTIONS.map(q => q.id))
  return Object.entries(value).every(([id, answer]) => ids.has(id) && isAnswer(answer))
}

export function isStoredResult(value: unknown): value is QuizResult {
  if (!value || typeof value !== "object") return false
  const result = value as QuizResult
  const finite = (n: unknown, min: number, max: number) => typeof n === "number" && Number.isFinite(n) && n >= min && n <= max
  return result.quiz_version === QUIZ_VERSION && result.schema_version === SCHEMA_VERSION
    && isDraftAnswers(result.answers) && Object.keys(result.answers).length === QUESTIONS.length
    && typeof result.description === "string" && typeof result.quadrant === "string" && typeof result.closest_profile === "string"
    && typeof result.created_at === "string" && !Number.isNaN(Date.parse(result.created_at))
    && [result.x, result.y, ...Object.keys(DIMENSIONS).map(key => result.dimensions?.[key as keyof typeof DIMENSIONS])].every(n => n === null || finite(n, -10, 10))
    && Object.keys(DIMENSIONS).every(key => finite(result.dimensionReliability?.[key as keyof typeof DIMENSIONS], 0, 1))
    && [result.consistency, result.symmetry].every(n => n === null || finite(n, 0, 100))
    && [result.coverage, result.diagnosticCoverage, result.axisCoverage?.x, result.axisCoverage?.y].every(n => finite(n, 0, 100))
    && finite(result.conditional, 0, QUESTIONS.length)
    && Array.isArray(result.nearby_profiles) && result.nearby_profiles.every(name => typeof name === "string")
    && Array.isArray(result.comparisons) && result.comparisons.every(pair => pair && typeof pair.label === "string" && typeof pair.relationship === "string" && (pair.gap === null || finite(pair.gap, 0, 6)))
}
