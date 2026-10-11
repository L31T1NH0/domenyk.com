import type { Answer } from "./types"
export const COMPARISONS = [
  {a:3,b:4,sign:-1,label:"Expressão e criminalização",relationship:"negativa",tolerance:2},
  {a:5,b:39,sign:-1,label:"Tarifas e importações",relationship:"negativa",tolerance:1},
  {a:2,b:1,sign:1,label:"Contratos: princípio e salário mínimo",relationship:"parcial / abstrato × concreto",tolerance:3},
  {a:49,b:50,sign:1,label:"Preços: princípio e desastre",relationship:"condicional / abstrato × concreto",tolerance:3},
  {a:57,b:58,sign:-1,label:"Limites para aliados e adversários",relationship:"negativa",tolerance:1},
  {a:57,b:59,sign:1,label:"Simetria de poderes",relationship:"positiva",tolerance:1},
] as const
export function compareAnswers(answers: Answer[]) {
  const comparisons = COMPARISONS.map(pair => {
    const a = answers[pair.a - 1], b = answers[pair.b - 1]
    const gap = typeof a === "number" && typeof b === "number" ? Math.abs(a - b * pair.sign) : null
    return {label:pair.label,relationship:pair.relationship,gap,penalty:gap === null ? null : Math.max(0,gap-pair.tolerance)/(6-pair.tolerance)}
  })
  const measured = comparisons.filter(p => p.penalty !== null)
  return { comparisons: comparisons.map(({label,relationship,gap}) => ({label,relationship,gap})), consistency: measured.length < 2 ? null : Math.round(100 * (1 - measured.reduce((sum,p) => sum + p.penalty!,0) / measured.length)) }
}
