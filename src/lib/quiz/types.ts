import type { QuestionId } from "./questions"

export const QUIZ_VERSION = "v0.2"
export const SCHEMA_VERSION = 2
export const DIMENSIONS = {
  AE: ["Autonomia econômica", "Tutela / regulação", "Liberdade contratual"],
  CP: ["Coordenação econômica", "Administração política", "Preços / concorrência"],
  IG: ["Igualitarismo", "Igualdade formal", "Redistribuição"],
  ES: ["Escopo estatal", "Estado limitado", "Estado abrangente"],
  LC: ["Liberdades civis", "Controle / proibição", "Autonomia individual"],
  TR: ["Tradicionalismo", "Permissividade social", "Normas tradicionais"],
  PU: ["Punitivismo", "Garantias / reabilitação", "Repressão / punição"],
  DE: ["Descentralização", "Centralização nacional", "Autonomia local"],
  IN: ["Institucionalismo", "Discricionariedade", "Limites e contrapesos"],
  AB: ["Abertura", "Protecionismo / nacionalismo", "Abertura econômica / social"],
  PR: ["Propriedade", "Função / coletivização", "Proteção da propriedade"],
  RR: ["Regra × resultado", "Decisão caso a caso", "Regras gerais"],
} as const
export type Dimension = keyof typeof DIMENSIONS
export type Answer = -3 | -2 | -1 | 0 | 1 | 2 | 3 | "depends" | "unknown"
export type Answers = Record<QuestionId, Answer>
export type DraftAnswers = Partial<Answers>
export type QuizResult = {
  quiz_version: string
  schema_version: number
  answers: Answers
  x: number | null
  y: number | null
  dimensions: Record<Dimension, number | null>
  dimensionReliability: Record<Dimension, number>
  consistency: number | null
  symmetry: number | null
  coverage: number
  conditional: number
  diagnosticCoverage: number
  axisCoverage: { x: number; y: number }
  comparisons: { label: string; gap: number | null; relationship: string }[]
  closest_profile: string
  nearby_profiles: string[]
  quadrant: string
  description: string
  created_at: string
}
