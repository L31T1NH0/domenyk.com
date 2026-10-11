import "server-only"
import { DIMENSIONS, QUIZ_VERSION, type Answer, type Dimension, type QuizResult } from "./types"
import { QUESTIONS, isAnswer } from "./questions"
import { WEIGHTS } from "./weights.server"
import { IDEOLOGIES } from "./ideologies"
import { compareAnswers } from "./consistency"
const round = (n: number) => Math.round(n * 10) / 10
export function validateAnswers(input: unknown): input is Answer[] {
  return Array.isArray(input) && input.length === QUESTIONS.length && input.every(isAnswer)
}
export function calculate(answers: Answer[]): QuizResult {
  if (!validateAnswers(answers)) throw new Error("Responda às 60 perguntas com uma resposta válida.")
  const dimensionKeys = Object.keys(DIMENSIONS) as Dimension[]
  function score(key: Dimension | "x" | "y") {
    let numerator = 0, used = 0, total = 0
    WEIGHTS.forEach((weights,i) => {
      const weight = weights[key] ?? 0
      total += Math.abs(weight)
      if (typeof answers[i] === "number") {
        numerator += (answers[i] as number) / 3 * weight
        used += Math.abs(weight)
      }
    })
    return {value:used ? round(10 * numerator / used) : null,coverage:total ? Math.round(100 * used / total) : 0}
  }
  const sx = score("x"), sy = score("y")
  const dimensions = Object.fromEntries(dimensionKeys.map(key => [key,score(key).value])) as QuizResult["dimensions"]
  const coverage = Math.round(100 * answers.slice(0,52).filter(a => typeof a === "number").length / 52)
  const enough = sx.coverage >= 50 && sy.coverage >= 50 && coverage >= 60
  const distances = IDEOLOGIES.map(profile => {
    const diffs = dimensionKeys.filter(key => dimensions[key] !== null).map(key => (dimensions[key]! - profile.dimensions[key]) ** 2)
    if (sx.value !== null) diffs.push((sx.value-profile.x)**2)
    if (sy.value !== null) diffs.push((sy.value-profile.y)**2)
    return { name:profile.name,distance:Math.sqrt(diffs.reduce((s,d)=>s+d,0)/Math.max(1,diffs.length)) }
  }).sort((a,b)=>a.distance-b.distance)
  const symmetryAnswers = [answers[56], answers[57], answers[58]]
  const symmetryMeasured = symmetryAnswers.flatMap((a,i) => typeof a === "number" ? [(a * (i === 1 ? -1 : 1) + 3) / 6 * 100] : [])
  const {consistency,comparisons} = compareAnswers(answers)
  const x = sx.value, y = sy.value
  const quadrant = x === null || y === null ? "Dados insuficientes" : Math.abs(x)<1 && Math.abs(y)<1 ? "Região central" : `${Math.abs(x)<1 ? "Economia mista" : x>0 ? "Direita econômica" : "Esquerda econômica"} · ${Math.abs(y)<1 ? "posição intermediária em autoridade" : y>0 ? "inclinação à autoridade" : "inclinação à liberdade"}`
  const statements = [
    !enough ? "Há poucas respostas posicionais para uma comparação confiável com os perfis de referência." : "Seu resultado combina preferências econômicas, liberdades civis e escolhas institucionais; o quadrante não determina uma ideologia.",
    x === null ? "O eixo econômico não pôde ser calculado." : x>3 ? "Você tende a preferir autonomia privada e coordenação por mercado." : x< -3 ? "Você tende a preferir coordenação política da economia e redistribuição." : "Suas posições econômicas são intermediárias ou combinam os dois polos.",
    y === null ? "O eixo de autoridade não pôde ser calculado." : y< -3 ? "Você tende a limitar a coerção e preservar a autonomia individual." : y>3 ? "Você aceita mais instrumentos de coerção e concentração de poder." : "Suas respostas sobre autoridade variam entre autonomia e controle.",
    dimensions.PU !== null && dimensions.PU > 3 && y !== null && y < -2 ? "Na segurança, suas respostas são mais punitivas que sua preferência geral por liberdade." : "",
    "Os pesos e perfis da v0.1 são hipóteses editoriais, ainda sem validação empírica. Os indicadores não medem inteligência, mérito ou correção política.",
  ].filter(Boolean)
  return {quiz_version:QUIZ_VERSION,answers:[...answers],x,y,dimensions,consistency,symmetry:symmetryMeasured.length < 2 ? null : Math.round(symmetryMeasured.reduce((s,n)=>s+n,0)/symmetryMeasured.length),coverage,conditional:answers.filter(a=>a==="depends").length,diagnosticCoverage:Math.round(100*answers.slice(52).filter(a=>typeof a==="number").length/8),axisCoverage:{x:sx.coverage,y:sy.coverage},comparisons,closest_profile:!enough ? "Dados insuficientes" : distances[0].distance>4 ? "Híbrido" : distances[0].name,nearby_profiles:enough ? distances.slice(0,3).map(p=>p.name) : [],quadrant,description:statements.join(" "),created_at:new Date().toISOString()}
}
