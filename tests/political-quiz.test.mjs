import assert from "node:assert/strict"
import test from "node:test"
import { registerHooks } from "node:module"
const hooks = registerHooks({resolve(specifier,context,nextResolve){
  if(specifier.startsWith("@/")) return nextResolve(new URL("../src/"+specifier.slice(2)+".ts",import.meta.url).href,context)
  if(specifier.startsWith(".") && !/\.(ts|mjs|js)$/.test(specifier)) return nextResolve(specifier+".ts",context)
  return nextResolve(specifier,context)
}})
const { QUESTIONS } = await import("../src/lib/quiz/questions.ts")
const { DIMENSIONS } = await import("../src/lib/quiz/types.ts")
const { WEIGHTS } = await import("../src/lib/quiz/weights.server.ts")
const { calculate, validateAnswers } = await import("../src/lib/quiz/calculate.server.ts")
const { POST } = await import("../src/app/api/quiz/route.ts")
hooks.deregister()

test("matrix covers 52 positional questions and eight non-positional diagnostics",()=>{
  assert.equal(QUESTIONS.length,60)
  assert.equal(WEIGHTS.length,60)
  assert.equal(QUESTIONS.filter(q=>q.kind==="positional").length,52)
  assert.ok(WEIGHTS.slice(52).every(w=>Object.keys(w).length===0))
  for(const key of Object.keys(DIMENSIONS)) assert.ok(WEIGHTS.some(w=>w[key]))
  assert.equal(WEIGHTS[33].y,undefined)
  assert.equal(WEIGHTS[50].y,undefined)
  assert.equal(WEIGHTS[51].y,undefined)
})
test("neutral, conditional and unknown answers have distinct meanings",()=>{
  const neutral=calculate(Array(60).fill(0))
  assert.equal(neutral.x,0);assert.equal(neutral.y,0);assert.equal(neutral.coverage,100)
  assert.equal(neutral.symmetry,50)
  for(const answer of ["depends","unknown"]){
    const result=calculate(Array(60).fill(answer))
    assert.equal(result.x,null);assert.equal(result.y,null);assert.equal(result.coverage,0)
    assert.equal(result.consistency,null);assert.equal(result.symmetry,null)
    assert.equal(result.closest_profile,"Dados insuficientes")
    assert.equal(result.conditional,answer==="depends"?60:0)
  }
})
test("axes normalize by answered absolute weights, with reversed wording",()=>{
  const answers=Array(60).fill("unknown");answers[0]=3
  const result=calculate(answers)
  assert.equal(result.x,10);assert.equal(result.y,-10)
  answers[0]=-3
  assert.equal(calculate(answers).x,-10)
  const proMarket=WEIGHTS.map(w=>(w.x??0)>0?3:(w.x??0)<0?-3:0)
  assert.equal(calculate(proMarket).x,10)
  assert.equal(calculate(proMarket.map(a=>-a)).x,-10)
})
test("diagnostics never move axes or dimensions",()=>{
  const a=Array(60).fill(1), b=[...a.slice(0,52),...Array(8).fill(-3)]
  const ra=calculate(a),rb=calculate(b)
  assert.equal(ra.x,rb.x);assert.equal(ra.y,rb.y);assert.deepEqual(ra.dimensions,rb.dimensions)
})
test("contextual differences tolerate limits; symmetry uses inverted ally wording",()=>{
  const answers=Array(60).fill("unknown")
  answers[1]=3;answers[0]=0;answers[48]=3;answers[49]=0
  assert.equal(calculate(answers).consistency,100)
  answers[56]=3;answers[57]=-3;answers[58]=3
  assert.equal(calculate(answers).symmetry,100)
  answers[57]=3
  assert.ok(calculate(answers).consistency<100)
})
test("invalid answers, omitted answers and unsupported values are rejected",()=>{
  for(const input of [null,{},Array(59).fill(0),Array(60).fill(4),Array(60).fill("0"),Array(60).fill(null)]) assert.equal(validateAnswers(input),false)
  assert.throws(()=>calculate(Array(60).fill(99)))
})
test("extreme and mixed answers stay bounded, and preserve result version",()=>{
  for(let n=0;n<25;n++){
    const answers=QUESTIONS.map((_,i)=>(i*7+n*3)%9<7?((i*7+n*3)%9)-3:(i+n)%2?"depends":"unknown")
    const result=calculate(answers)
    for(const value of [result.x,result.y,...Object.values(result.dimensions)]) assert.ok(value===null||(value>=-10&&value<=10))
    assert.equal(result.quiz_version,"v0.1");assert.deepEqual(result.answers,answers)
    assert.ok(!Number.isNaN(Date.parse(result.created_at)))
  }
})

test("API rejects malformed, incomplete, unsupported-version and oversized requests",async()=>{
  const request=body=>new Request("http://localhost/api/quiz",{method:"POST",body})
  for(const body of ["{", "null", JSON.stringify({quiz_version:"v9",answers:Array(60).fill(0)}), JSON.stringify({quiz_version:"v0.1",answers:Array(59).fill(0)})]) assert.equal((await POST(request(body))).status,400)
  assert.equal((await POST(request("x".repeat(4097)))).status,413)
  const response=await POST(request(JSON.stringify({quiz_version:"v0.1",answers:Array(60).fill(0)})))
  assert.equal(response.status,200);assert.equal(response.headers.get("Cache-Control"),"no-store")
  assert.equal((await response.json()).coverage,100)
})
