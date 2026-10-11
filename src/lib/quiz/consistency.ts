import type { Answers } from "./types"
export const COMPARISONS = [
  {a:"q_offensive_expression",b:"q_racist_opinion_crime",sign:-1,label:"Expressão e criminalização",relationship:"negativa",tolerance:2},
  {a:"q_import_tariffs",b:"q_free_imports",sign:-1,label:"Tarifas e importações",relationship:"negativa",tolerance:1},
  {a:"q_voluntary_contracts",b:"q_contract_minimum_wage",sign:1,label:"Contratos: princípio e salário mínimo",relationship:"parcial / abstrato × concreto",tolerance:3},
  {a:"q_free_prices",b:"q_disaster_prices",sign:1,label:"Preços: princípio e desastre",relationship:"condicional / abstrato × concreto",tolerance:3},
  {a:"q_symmetric_power_risk",b:"q_allied_rule_bending",sign:-1,label:"Limites para aliados e adversários",relationship:"negativa",tolerance:1},
  {a:"q_symmetric_power_risk",b:"q_equal_political_powers",sign:1,label:"Simetria de poderes",relationship:"positiva",tolerance:1},
] as const
export function compareAnswers(answers: Answers) {
  const comparisons = COMPARISONS.map(pair => {
    const a = answers[pair.a], b = answers[pair.b]
    const gap = typeof a === "number" && typeof b === "number" ? Math.abs(a - b * pair.sign) : null
    return {label:pair.label,relationship:pair.relationship,gap,penalty:gap === null ? null : Math.max(0,gap-pair.tolerance)/(6-pair.tolerance)}
  })
  const measured = comparisons.filter(p => p.penalty !== null)
  return { comparisons: comparisons.map(({label,relationship,gap}) => ({label,relationship,gap})), consistency: measured.length < 2 ? null : Math.round(100 * (1 - measured.reduce((sum,p) => sum + p.penalty!,0) / measured.length)) }
}
