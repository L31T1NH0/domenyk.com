"use client"
import { startTransition, useEffect, useRef, useState } from "react"
import { QUESTIONS, isAnswer } from "@/lib/quiz/questions"
import { DIMENSIONS, QUIZ_VERSION, type Answer, type Dimension, type QuizResult } from "@/lib/quiz/types"
import styles from "./quiz.module.css"
const STORAGE_KEY = `political-quiz:${QUIZ_VERSION}`
const OPTIONS: {value:Answer;label:string}[] = [
  {value:-3,label:"Discordo totalmente"},{value:-2,label:"Discordo"},{value:-1,label:"Discordo um pouco"},
  {value:0,label:"Neutro"},{value:1,label:"Concordo um pouco"},{value:2,label:"Concordo"},{value:3,label:"Concordo totalmente"},
  {value:"depends",label:"Depende"},{value:"unknown",label:"Não sei"},
]
const format = (value:number|null) => value === null ? "Sem dados" : `${value>0?"+":""}${value.toFixed(1).replace(".",",")}`
function Compass({x,y}:{x:number|null;y:number|null}) {
  return <svg className={styles.compass} viewBox="0 0 360 330" role="img" aria-label={x === null || y === null ? "Mapa sem posição: faltam respostas." : `Mapa político: economia ${format(x)}, autoridade ${format(y)}.`}>
    <title>Posição econômica e relação com a autoridade</title>
    <rect x="65" y="35" width="230" height="230" fill="none" stroke="currentColor" opacity=".18" />
    {[-5,5].map(t=><g key={t} stroke="currentColor" opacity=".1"><path d={`M${180+t*11.5} 35V265`} /><path d={`M65 ${150+t*11.5}H295`} /></g>)}
    <g stroke="currentColor" opacity=".65"><path d="M65 150H295M180 35V265" /></g>
    <g fill="currentColor" fontSize="11" textAnchor="middle"><text x="180" y="20">Mais autoridade</text><text x="180" y="292">Mais liberdade</text><text x="33" y="144">Esquerda</text><text x="33" y="160">econômica</text><text x="327" y="144">Direita</text><text x="327" y="160">econômica</text><text x="75" y="166">−10</text><text x="285" y="166">+10</text><text x="193" y="49">+10</text><text x="194" y="258">−10</text><text x="190" y="166">0</text></g>
    {x!==null&&y!==null&&<g><circle cx={180+x*11.5} cy={150-y*11.5} r="8" fill="var(--quiz-accent)" stroke="var(--quiz-surface)" strokeWidth="3" /><text x="180" y="319" fill="currentColor" textAnchor="middle" fontSize="12">X {format(x)} · Y {format(y)}</text></g>}
  </svg>
}
function Result({result,onReview,onReset}:{result:QuizResult;onReview:()=>void;onReset:()=>void}) {
  function download() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(result,null,2)],{type:"application/json"}))
    const link = document.createElement("a");link.href=url;link.download=`mapa-politico-${result.quiz_version}.json`;link.click();URL.revokeObjectURL(url)
  }
  return <>
    <h1>Seu mapa político</h1>
    <p className={styles.muted}>Modelo {result.quiz_version} · {new Date(result.created_at).toLocaleDateString("pt-BR")}</p>
    <Compass x={result.x} y={result.y} />
    <h2>{result.quadrant}</h2>
    <p className={styles.profile}>Perfil mais próximo: <strong>{result.closest_profile}</strong></p>
    {result.nearby_profiles.length>0&&<p className={styles.muted}>Referências próximas: {result.nearby_profiles.filter(p=>p!==result.closest_profile).join(" · ")}</p>}
    <p className={styles.description}>{result.description}</p>
    <h2>Como sua posição se forma</h2>
    <p className={styles.muted}>Cada dimensão vai de −10 a +10. Os polos abaixo explicam o sinal.</p>
    <dl className={styles.dimensions}>{(Object.keys(DIMENSIONS) as Dimension[]).map(key=>{
      const value=result.dimensions[key], [label,low,high]=DIMENSIONS[key]
      return <div key={key}><dt>{label}</dt><dd><strong>{format(value)}</strong></dd><div className={styles.track} aria-hidden><span style={{left:value!==null&&value<0?`${50+value*5}%`:"50%",width:`${Math.abs(value??0)*5}%`}} /></div><small>{low}<span>{high}</span></small></div>
    })}</dl>
    <h2>Diagnósticos</h2>
    <dl className={styles.diagnostics}>{[["Consistência interna",result.consistency],["Simetria institucional",result.symmetry],["Cobertura posicional",result.coverage],["Cobertura dos diagnósticos",result.diagnosticCoverage],["Cobertura econômica",result.axisCoverage.x],["Cobertura de autoridade",result.axisCoverage.y]].map(([label,value])=><div key={String(label)}><dt>{label}</dt><dd>{value===null?"Dados insuficientes":`${value}/100`}</dd></div>)}</dl>
    <p className={styles.muted}>“Depende” foi escolhido {result.conditional} {result.conditional===1?"vez":"vezes"}. Respostas condicionais e “Não sei” não entram nas médias. Neutralidade entra como zero. Cobertura mede respostas numéricas, não precisão científica.</p>
    <details className={styles.details}><summary>Princípios e aplicações concretas</summary><p>Diferença de 0 a 6 entre respostas relacionadas, ajustada pela relação esperada. Uma diferença pode indicar um limite contextual, sem ser uma contradição. A consistência usa tolerâncias editoriais; exige ao menos duas comparações.</p><ul>{result.comparisons.map(pair=><li key={pair.label}>{pair.label}: <strong>{pair.gap===null?"sem dados":`${pair.gap}/6`}</strong><small>{pair.relationship}</small></li>)}</ul></details>
    <details className={styles.details}><summary>Rever suas 60 respostas</summary><ol>{QUESTIONS.map((q,i)=><li key={q.id}>{q.text}<strong>{OPTIONS.find(o=>o.value===result.answers[i])?.label}</strong></li>)}</ol></details>
    <div className={styles.actions}><button onClick={download}>Baixar resultado</button><button onClick={onReview}>Editar respostas</button><button onClick={onReset}>Novo teste</button></div>
  </>
}
export function PoliticalQuiz() {
  const [answers,setAnswers]=useState<(Answer|null)[]>(Array(60).fill(null))
  const [index,setIndex]=useState(0)
  const [started,setStarted]=useState(false)
  const [ready,setReady]=useState(false)
  const [result,setResult]=useState<QuizResult|null>(null)
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState("")
  const [storageError,setStorageError]=useState(false)
  const questionRef=useRef<HTMLFieldSetElement>(null)
  useEffect(()=>{
    startTransition(() => {
    try {
      const raw=localStorage.getItem(STORAGE_KEY)
      if(raw){
        const saved=JSON.parse(raw)
        if(saved && saved.quiz_version===QUIZ_VERSION&&Array.isArray(saved.answers)&&saved.answers.length===60&&saved.answers.every((a:unknown)=>a===null||isAnswer(a))){
          setAnswers(saved.answers)
          setIndex(Math.max(0,saved.answers.findIndex((a:unknown)=>a===null)))
          const snapshot = saved.result
          if (snapshot && snapshot.quiz_version === QUIZ_VERSION && JSON.stringify(snapshot.answers) === JSON.stringify(saved.answers)
            && typeof snapshot.description === "string" && typeof snapshot.quadrant === "string" && typeof snapshot.closest_profile === "string"
            && typeof snapshot.created_at === "string" && !Number.isNaN(Date.parse(snapshot.created_at))
            && [snapshot.x,snapshot.y,...Object.keys(DIMENSIONS).map(key=>snapshot.dimensions?.[key])].every(value=>value===null||(typeof value === "number"&&Number.isFinite(value)&&Math.abs(value)<=10))
            && [snapshot.consistency,snapshot.symmetry].every(value=>value===null||(typeof value === "number"&&value>=0&&value<=100))
            && [snapshot.coverage,snapshot.conditional,snapshot.diagnosticCoverage,snapshot.axisCoverage?.x,snapshot.axisCoverage?.y].every(value=>typeof value === "number"&&value>=0&&value<=100)
            && Array.isArray(snapshot.nearby_profiles) && snapshot.nearby_profiles.every((value:unknown)=>typeof value === "string")
            && Array.isArray(snapshot.comparisons) && snapshot.comparisons.every((pair: {label?:unknown;relationship?:unknown;gap?:unknown})=>pair&&typeof pair.label === "string"&&typeof pair.relationship === "string"&&(pair.gap===null||typeof pair.gap === "number"))) setResult(snapshot)
        }
      }
    } catch {setStorageError(true)}
    setReady(true)
    })
  },[])
  useEffect(()=>{
    if(!ready)return
    try {localStorage.setItem(STORAGE_KEY,JSON.stringify({quiz_version:QUIZ_VERSION,answers,result}))} catch {startTransition(()=>setStorageError(true))}
  },[answers,result,ready])
  useEffect(()=>{if(started&&!result)questionRef.current?.focus()},[index,started,result])
  const count=answers.filter(a=>a!==null).length
  const question=QUESTIONS[index]
  async function finish() {
    const missing=answers.findIndex(a=>a===null)
    if(missing!==-1){setIndex(missing);setError("Responda esta pergunta antes de calcular o resultado.");return}
    setBusy(true);setError("")
    try {
      const response=await fetch("/api/quiz",{signal:AbortSignal.timeout(20000),method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({quiz_version:QUIZ_VERSION,answers})})
      const payload=await response.json()
      if(!response.ok)throw new Error(payload.error??"Não foi possível calcular o resultado.")
      setResult(payload);window.scrollTo({top:0,behavior:"instant"})
    }catch(err){setError(err instanceof Error && err.name === "Error"?err.message:"Falha de conexão. Tente novamente; suas respostas estão preservadas.")}
    finally{setBusy(false)}
  }
  function reset(){setAnswers(Array(60).fill(null));setIndex(0);setResult(null);setStarted(false);setError("")}
  return <div className={styles.quiz}>
    {storageError&&<p role="status" className={styles.notice}>O navegador não permitiu salvar o progresso. Mantenha esta página aberta até concluir e baixe seu resultado.</p>}
    {result?<Result result={result} onReview={()=>{setResult(null);setStarted(true);setIndex(0)}} onReset={reset}/>:!started?<>
      <h1>Teste de posicionamento político</h1>
      <p className={styles.intro}>Entenda sua posição entre esquerda e direita econômica, liberdade e autoridade.</p>

      <p>60 perguntas, uma por vez. No final, veja seu mapa político e as dimensões que formam seu resultado. Sem precisar criar uma conta.</p>
      <p className={styles.muted}>Você pode voltar e revisar qualquer resposta. O progresso fica salvo neste navegador.</p>
      <p className={styles.muted}>Modelo experimental v0.1. O resultado é uma aproximação, não uma definição da sua identidade política.</p>
      <button className={styles.primary} disabled={!ready} onClick={()=>setStarted(true)}>{count?`Continuar teste · ${count}/60` : "Começar o teste"}</button>
      {count>0&&<button className={styles.textButton} onClick={reset}>Descartar progresso e começar de novo</button>}
      <details className={styles.details}><summary>Como responder e como calculamos</summary><p>Use sete níveis de discordância e concordância. “Neutro” representa uma posição intermediária; “Depende” registra uma condição ausente; “Não sei” indica falta de informação.</p><p>Perguntas posicionais recebem pesos nos eixos e dimensões. Cada média é normalizada pela soma dos pesos absolutos das respostas numéricas. Os oito diagnósticos não movem o ponto no mapa. Moralidade, coerção, propriedade e responsabilidade por dano são tratados separadamente.</p><p>O cálculo acontece no servidor. As respostas não são gravadas no banco; o progresso e o último resultado ficam neste navegador, com sua versão. Para guardar uma cópia durável, baixe o resultado ao concluir.</p></details>
    </>:<>
      <h1>Teste de posicionamento político</h1>
      <div className={styles.progressHeading}><span>Pergunta {index+1} de 60</span><span>{count} respondidas</span></div>
      <progress value={count} max={60} aria-label="Perguntas respondidas" />
      <fieldset ref={questionRef} tabIndex={-1} className={styles.question} disabled={busy}>
        <legend>{question.text}</legend>
        <div className={styles.options}>{OPTIONS.map(option=><label key={String(option.value)} className={answers[index]===option.value?styles.selected:undefined}><input type="radio" name={`question-${question.id}`} value={option.value} checked={answers[index]===option.value} onChange={()=>{setAnswers(previous=>previous.map((a,i)=>i===index?option.value:a));setError("")}}/><span>{option.label}</span></label>)}</div>
      </fieldset>
      <p className={styles.hint}>Neutro: posição intermediária. Depende: faltam condições. Não sei: faltam informações.</p>
      {error&&<p role="alert" className={styles.notice}>{error}</p>}
      <div className={styles.navigation}><button disabled={index===0||busy} onClick={()=>setIndex(index-1)}>Anterior</button>{index<59?<button className={styles.primary} disabled={answers[index]===null||busy} onClick={()=>setIndex(index+1)}>Próxima pergunta</button>:<button className={styles.primary} disabled={answers[index]===null||busy} onClick={finish}>{busy?"Calculando…":"Ver meu resultado"}</button>}</div>
      <details className={styles.details}><summary>Ir para uma pergunta</summary><div className={styles.questionLinks}>{QUESTIONS.map((q,i)=><button key={q.id} disabled={busy} aria-label={`Pergunta ${q.id}${answers[i]!==null?", respondida":""}`} aria-current={index===i?"step":undefined} className={answers[i]!==null?styles.answered:undefined} onClick={()=>setIndex(i)}>{q.id}</button>)}</div></details>
      <p className={styles.muted}>Progresso salvo neste navegador · {QUIZ_VERSION}</p>
    </>}
  </div>
}
