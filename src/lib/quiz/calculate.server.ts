import "server-only"
import { DIMENSIONS, QUIZ_VERSION, SCHEMA_VERSION, type Answers, type Dimension, type QuizResult } from "./types"
import { QUESTIONS, isAnswer } from "./questions"
import { WEIGHTS } from "./weights.server"
import { IDEOLOGIES, profileDistance } from "./ideologies"
import { compareAnswers } from "./consistency"
const round = (n: number) => Math.round(n * 10) / 10
export function validateAnswers(input: unknown): input is Answers {
  if (!input || typeof input !== "object" || Array.isArray(input)) return false
  const entries = input as Record<string, unknown>
  return Object.keys(entries).length === QUESTIONS.length && QUESTIONS.every(q => Object.hasOwn(entries, q.id) && isAnswer(entries[q.id]))
}
export function calculate(answers: Answers): QuizResult {
  if (!validateAnswers(answers)) throw new Error("Responda às 60 perguntas com uma resposta válida.")
  const dimensionKeys = Object.keys(DIMENSIONS) as Dimension[]
  function score(key: Dimension | "x" | "y") {
    let numerator = 0, used = 0, total = 0, squaredWeights = 0
    for (const question of QUESTIONS) {
      const weight = WEIGHTS[question.id][key] ?? 0
      total += Math.abs(weight)
      const answer = answers[question.id]
      if (typeof answer === "number") {
        numerator += answer / 3 * weight
        used += Math.abs(weight)
        squaredWeights += weight ** 2
      }
    }
    const coverage = total ? used / total : 0
    // Quatro observações efetivas completam o suporte; concentração de pesos reduz esse número.
    const effectiveCount = squaredWeights ? used ** 2 / squaredWeights : 0
    return {
      value: used ? round(10 * numerator / used) : null,
      coverage: Math.round(100 * coverage),
      reliability: Math.round(coverage * Math.min(1, effectiveCount / 4) * 1e6) / 1e6,
    }
  }
  const sx = score("x"), sy = score("y")
  const dimensionScores = Object.fromEntries(dimensionKeys.map(key => [key, score(key)])) as Record<Dimension, ReturnType<typeof score>>
  const dimensions = Object.fromEntries(dimensionKeys.map(key => [key, dimensionScores[key].value])) as QuizResult["dimensions"]
  const dimensionReliability = Object.fromEntries(dimensionKeys.map(key => [key, dimensionScores[key].reliability])) as QuizResult["dimensionReliability"]
  const positional = QUESTIONS.filter(q => q.kind === "positional")
  const diagnostic = QUESTIONS.filter(q => q.kind === "diagnostic")
  const coverage = Math.round(100 * positional.filter(q => typeof answers[q.id] === "number").length / positional.length)
  const enough = sx.coverage >= 50 && sy.coverage >= 50 && coverage >= 60
  const distances = IDEOLOGIES.map(profile => ({
    name: profile.name,
    distance: profileDistance(profile, { ...dimensions, x: sx.value, y: sy.value }, { ...dimensionReliability, x: sx.reliability, y: sy.reliability }),
  })).sort((a,b) => a.distance - b.distance)
  const symmetryAnswers = [answers.q_symmetric_power_risk, answers.q_allied_rule_bending, answers.q_equal_political_powers]
  const symmetryMeasured = symmetryAnswers.flatMap((a,i) => typeof a === "number" ? [(a * (i === 1 ? -1 : 1) + 3) / 6 * 100] : [])
  const {consistency,comparisons} = compareAnswers(answers)
  const x = sx.value, y = sy.value
  const quadrant = x === null || y === null ? "Dados insuficientes" : Math.abs(x)<1 && Math.abs(y)<1 ? "Região central" : `${Math.abs(x)<1 ? "Economia mista" : x>0 ? "Direita econômica" : "Esquerda econômica"} · ${Math.abs(y)<1 ? "posição intermediária em autoridade" : y>0 ? "inclinação à autoridade" : "inclinação à liberdade"}`
  const statements = [
    !enough ? "Há poucas respostas posicionais para uma comparação confiável com os perfis de referência." : "Seu resultado combina preferências econômicas, liberdades civis e escolhas institucionais; o quadrante não determina uma ideologia.",
    x === null ? "O eixo econômico não pôde ser calculado." : x>3 ? "Você tende a preferir autonomia privada e coordenação por mercado." : x< -3 ? "Você tende a preferir coordenação política da economia e redistribuição." : "Suas posições econômicas são intermediárias ou combinam os dois polos.",
    y === null ? "O eixo de autoridade não pôde ser calculado." : y< -3 ? "Você tende a limitar a coerção e preservar a autonomia individual." : y>3 ? "Você aceita mais instrumentos de coerção e concentração de poder." : "Suas respostas sobre autoridade variam entre autonomia e controle.",
    dimensions.PU !== null && dimensions.PU > 3 && y !== null && y < -2 ? "Na segurança, suas respostas são mais punitivas que sua preferência geral por liberdade." : "",
    "Os pesos e perfis da v0.2 são hipóteses editoriais, ainda sem validação empírica. Os indicadores não medem inteligência, mérito ou correção política.",
  ].filter(Boolean)
  return {quiz_version:QUIZ_VERSION,schema_version:SCHEMA_VERSION,answers:{...answers},x,y,dimensions,dimensionReliability,consistency,symmetry:symmetryMeasured.length < 2 ? null : Math.round(symmetryMeasured.reduce((s,n)=>s+n,0)/symmetryMeasured.length),coverage,conditional:Object.values(answers).filter(a=>a==="depends").length,diagnosticCoverage:Math.round(100*diagnostic.filter(q=>typeof answers[q.id]==="number").length/diagnostic.length),axisCoverage:{x:sx.coverage,y:sy.coverage},comparisons,closest_profile:!enough ? "Dados insuficientes" : distances[0].distance>4 ? "Híbrido" : distances[0].name,nearby_profiles:enough ? distances.slice(0,3).map(p=>p.name) : [],quadrant,description:statements.join(" "),created_at:new Date().toISOString()}
}
