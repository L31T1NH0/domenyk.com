import assert from "node:assert/strict"
import test from "node:test"
import { registerHooks } from "node:module"
const hooks = registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) return nextResolve(new URL("../src/" + specifier.slice(2) + ".ts", import.meta.url).href, context)
  if (specifier.startsWith(".") && !/\.(ts|mjs|js)$/.test(specifier)) return nextResolve(specifier + ".ts", context)
  return nextResolve(specifier, context)
} })
const { QUESTIONS } = await import("../src/lib/quiz/questions.ts")
const { DIMENSIONS, QUIZ_VERSION, SCHEMA_VERSION } = await import("../src/lib/quiz/types.ts")
const { WEIGHTS } = await import("../src/lib/quiz/weights.server.ts")
const { IDEOLOGIES, profileDistance } = await import("../src/lib/quiz/ideologies.ts")
const { calculate, validateAnswers } = await import("../src/lib/quiz/calculate.server.ts")
const { STORAGE_KEY, LEGACY_STORAGE_KEY, isDraftAnswers, isStoredResult } = await import("../src/lib/quiz/storage.ts")
const { POST } = await import("../src/app/api/quiz/route.ts")
hooks.deregister()
const filled = value => Object.fromEntries(QUESTIONS.map(q => [q.id, value]))
const payload = answers => ({ quiz_version: QUIZ_VERSION, schema_version: SCHEMA_VERSION, answers })
const request = body => new Request("http://localhost/api/quiz", { method: "POST", headers: { Origin: "http://localhost", "Content-Type": "application/json" }, body })

test("stable IDs bind every question to its weights; all enunciados are questions", () => {
  assert.equal(QUESTIONS.length, 60)
  assert.equal(new Set(QUESTIONS.map(q => q.id)).size, 60)
  assert.equal(Object.keys(WEIGHTS).length, 60)
  assert.equal(QUESTIONS.filter(q => q.kind === "positional").length, 52)
  for (const q of QUESTIONS) {
    assert.match(q.id, /^q_[a-z_]+$/)
    assert.ok(q.text.endsWith("?"))
    assert.ok(Object.hasOwn(WEIGHTS, q.id))
    if (q.kind === "diagnostic") assert.deepEqual(WEIGHTS[q.id], {})
  }
  for (const key of Object.keys(DIMENSIONS)) assert.ok(Object.values(WEIGHTS).some(w => w[key]))
})

test("neutral, conditional and unknown retain distinct meanings", () => {
  const neutral = calculate(filled(0))
  assert.equal(neutral.x, 0); assert.equal(neutral.y, 0); assert.equal(neutral.coverage, 100)
  assert.equal(neutral.symmetry, 50)
  for (const answer of ["depends", "unknown"]) {
    const result = calculate(filled(answer))
    assert.equal(result.x, null); assert.equal(result.y, null); assert.equal(result.coverage, 0)
    assert.equal(result.consistency, null); assert.equal(result.symmetry, null)
    assert.equal(result.closest_profile, "Dados insuficientes")
    assert.equal(result.conditional, answer === "depends" ? 60 : 0)
    assert.ok(Object.values(result.dimensionReliability).every(n => n === 0))
  }
})

test("axes normalize absolute weights and reverse oppositely worded questions", () => {
  const answers = filled("unknown")
  answers.q_contract_minimum_wage = 3
  assert.equal(calculate(answers).x, 10)
  assert.equal(calculate(answers).y, null)
  answers.q_contract_minimum_wage = -3
  assert.equal(calculate(answers).x, -10)
  const proMarket = Object.fromEntries(QUESTIONS.map(q => [q.id, Math.sign(WEIGHTS[q.id].x ?? 0) * 3]))
  assert.equal(calculate(proMarket).x, 10)
  assert.equal(calculate(Object.fromEntries(Object.entries(proMarket).map(([id, a]) => [id, -a]))).x, -10)
})

test("reordering questions or answer keys cannot change the profile", () => {
  const answers = Object.fromEntries(QUESTIONS.map((q, i) => [q.id, (i % 7) - 3]))
  const before = calculate(answers)
  QUESTIONS.reverse()
  try {
    const after = calculate(Object.fromEntries(Object.entries(answers).reverse()))
    for (const key of ["x", "y", "dimensions", "dimensionReliability", "consistency", "symmetry", "coverage", "closest_profile", "nearby_profiles"]) assert.deepEqual(after[key], before[key])
  } finally { QUESTIONS.reverse() }
})

test("diagnostics do not move axes; constitutional rules do not imply civil liberty", () => {
  const a = filled(1), b = { ...a }
  for (const q of QUESTIONS.filter(q => q.kind === "diagnostic")) b[q.id] = -3
  const ra = calculate(a), rb = calculate(b)
  assert.equal(ra.x, rb.x); assert.equal(ra.y, rb.y); assert.deepEqual(ra.dimensions, rb.dimensions)
  for (const id of ["q_constitutional_review", "q_local_policies", "q_national_curriculum", "q_family_traditions", "q_fetal_rights", "q_early_abortion"]) assert.equal(WEIGHTS[id].y, undefined)
  const single = filled("unknown"); single.q_constitutional_review = 3
  assert.equal(calculate(single).y, null); assert.equal(calculate(single).dimensions.IN, 10)
})

test("poorly observed dimensions have less influence on reference distances", () => {
  const full = calculate(filled(0))
  assert.ok(full.dimensionReliability.RR < full.dimensionReliability.AE)
  const sparse = filled("unknown"); sparse.q_offensive_expression = 3
  assert.ok(calculate(sparse).dimensionReliability.LC < full.dimensionReliability.LC)
  assert.ok(Object.values(full.dimensionReliability).every(n => n >= 0 && n <= 1))
  const profile = IDEOLOGIES[0]
  const values = { AE: profile.dimensions.AE, RR: profile.dimensions.RR - 8 }
  assert.ok(profileDistance(profile, values, { AE: 1, RR: .1 }) < profileDistance(profile, values, { AE: 1, RR: 1 }))
  assert.equal(profileDistance(profile, values, { AE: 1, RR: 0 }), 0)
  assert.equal(profileDistance(profile, { AE: null }, { AE: 1 }), Infinity)
})

test("contextual differences allow limits and symmetry inverts ally exception", () => {
  const answers = filled("unknown")
  Object.assign(answers, { q_voluntary_contracts: 3, q_contract_minimum_wage: 0, q_free_prices: 3, q_disaster_prices: 0 })
  assert.equal(calculate(answers).consistency, 100)
  Object.assign(answers, { q_symmetric_power_risk: 3, q_allied_rule_bending: -3, q_equal_political_powers: 3 })
  assert.equal(calculate(answers).symmetry, 100)
  answers.q_allied_rule_bending = 3
  assert.ok(calculate(answers).consistency < 100)
})

test("rejects positional arrays, unknown IDs, missing IDs and invalid answers", () => {
  const missing = filled(0); delete missing.q_contract_minimum_wage
  for (const input of [null, {}, Array(60).fill(0), filled(4), filled("0"), filled(null), missing, { ...filled(0), q_invalid: 0 }]) assert.equal(validateAnswers(input), false)
  assert.throws(() => calculate(filled(99)))
  assert.equal(isDraftAnswers({ q_contract_minimum_wage: 0 }), true)
  assert.equal(isDraftAnswers({ q_invalid: 0 }), false)
})

test("results stay bounded and require both model and schema versions in storage", () => {
  for (let n = 0; n < 20; n++) {
    const answers = Object.fromEntries(QUESTIONS.map((q, i) => [q.id, (i * 7 + n * 3) % 9 < 7 ? ((i * 7 + n * 3) % 9) - 3 : (i + n) % 2 ? "depends" : "unknown"]))
    const result = calculate(answers)
    for (const value of [result.x, result.y, ...Object.values(result.dimensions)]) assert.ok(value === null || (value >= -10 && value <= 10))
    assert.equal(result.quiz_version, "v0.2"); assert.equal(result.schema_version, 2)
    assert.deepEqual(result.answers, answers); assert.equal(isStoredResult(result), true)
    assert.equal(isStoredResult({ ...result, schema_version: 1 }), false)
    assert.equal(isStoredResult({ ...result, quiz_version: "v0.1" }), false)
    assert.equal(isStoredResult({ ...result, dimensionReliability: {} }), false)
  }
  assert.notEqual(STORAGE_KEY, LEGACY_STORAGE_KEY)
})

test("API validates model/schema, answer IDs, input size and no-store", async () => {
  const wrongSchema = { ...payload(filled(0)), schema_version: 1 }
  const wrongModel = { ...payload(filled(0)), quiz_version: "v0.1" }
  for (const body of ["{", "null", JSON.stringify(wrongSchema), JSON.stringify(wrongModel), JSON.stringify(payload(Array(60).fill(0)))]) assert.equal((await POST(request(body))).status, 400)
  assert.equal((await POST(request("x".repeat(8193)))).status, 413)
  const response = await POST(request(JSON.stringify(payload(filled(0)))))
  assert.equal(response.status, 200); assert.equal(response.headers.get("Cache-Control"), "no-store")
  const result = await response.json()
  assert.equal(result.schema_version, 2); assert.equal(result.coverage, 100)
})

test("API blocks missing and foreign origins in production", { skip: process.env.NODE_ENV !== "production" }, async () => {
  const body = JSON.stringify(payload(filled(0)))
  for (const headers of [{}, { Origin: "https://example.com" }, { Origin: "http://localhost", "Sec-Fetch-Site": "cross-site" }]) assert.equal((await POST(new Request("http://localhost/api/quiz", { method: "POST", headers, body }))).status, 403)
})
