"use client"
import { startTransition, useEffect, useRef, useState } from "react"
import { QUESTIONS, type Question } from "@/lib/quiz/questions"
import { DIMENSIONS, QUIZ_VERSION, SCHEMA_VERSION, type Answer, type DraftAnswers, type Dimension, type QuizResult } from "@/lib/quiz/types"
import styles from "./quiz.module.css"
import { STORAGE_KEY, LEGACY_STORAGE_KEY, isDraftAnswers, isStoredResult } from "@/lib/quiz/storage"
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
    const link = document.createElement("a");link.href=url;link.download=`mapa-politico-${result.quiz_version}-schema-${result.schema_version}.json`;link.click();URL.revokeObjectURL(url)
  }
  return <>
    <h1>Seu mapa político</h1>
    <p className={styles.muted}>Modelo {result.quiz_version} · esquema {result.schema_version} · {new Date(result.created_at).toLocaleDateString("pt-BR")}</p>
    <Compass x={result.x} y={result.y} />
    <h2>{result.quadrant}</h2>
    <p className={styles.profile}>Perfil mais próximo: <strong>{result.closest_profile}</strong></p>
    {result.nearby_profiles.length>0&&<p className={styles.muted}>Referências próximas: {result.nearby_profiles.filter(p=>p!==result.closest_profile).join(" · ")}</p>}
    <p className={styles.description}>{result.description}</p>
    <h2>Como sua posição se forma</h2>
    <p className={styles.muted}>Cada dimensão vai de −10 a +10. O suporte indica quanto ela foi observada nas respostas e influencia a comparação com perfis. Não é uma medida de precisão científica.</p>
    <dl className={styles.dimensions}>{(Object.keys(DIMENSIONS) as Dimension[]).map(key=>{
      const value=result.dimensions[key], [label,low,high]=DIMENSIONS[key]
      return <div key={key}><dt>{label}</dt><dd><strong>{format(value)}</strong><span className={styles.support}>Suporte: {Math.round(result.dimensionReliability[key]*100)}%</span></dd><div className={styles.track} aria-hidden><span style={{left:value!==null&&value<0?`${50+value*5}%`:"50%",width:`${Math.abs(value??0)*5}%`}} /></div><small>{low}<span>{high}</span></small></div>
    })}</dl>
    <h2>Diagnósticos</h2>
    <dl className={styles.diagnostics}>{[["Consistência interna",result.consistency],["Simetria institucional",result.symmetry],["Cobertura posicional",result.coverage],["Cobertura dos diagnósticos",result.diagnosticCoverage],["Cobertura econômica",result.axisCoverage.x],["Cobertura de autoridade",result.axisCoverage.y]].map(([label,value])=><div key={String(label)}><dt>{label}</dt><dd>{value===null?"Dados insuficientes":`${value}/100`}</dd></div>)}</dl>
    <p className={styles.muted}>“Depende” foi escolhido {result.conditional} {result.conditional===1?"vez":"vezes"}. Respostas condicionais e “Não sei” não entram nas médias. Neutralidade entra como zero. Cobertura mede respostas numéricas, não precisão científica.</p>
    <details className={styles.details}><summary>Princípios e aplicações concretas</summary><p>Diferença de 0 a 6 entre respostas relacionadas, ajustada pela relação esperada. Uma diferença pode indicar um limite contextual, sem ser uma contradição. A consistência usa tolerâncias editoriais; exige ao menos duas comparações.</p><ul>{result.comparisons.map(pair=><li key={pair.label}>{pair.label}: <strong>{pair.gap===null?"sem dados":`${pair.gap}/6`}</strong><small>{pair.relationship}</small></li>)}</ul></details>
    <details className={styles.details}><summary>Rever suas 60 respostas</summary><ol>{QUESTIONS.map(q=><li key={q.id}>{q.text}<strong>{OPTIONS.find(o=>o.value===result.answers[q.id])?.label}</strong></li>)}</ol></details>
    <div className={styles.actions}><button onClick={download}>Baixar resultado</button><button onClick={onReview}>Editar respostas</button><button onClick={onReset}>Novo teste</button></div>
  </>
}
export function PoliticalQuiz() {
  const [answers, setAnswers] = useState<DraftAnswers>({})
  const [index, setIndex] = useState(0)
  const [started, setStarted] = useState(false)
  const [ready, setReady] = useState(false)
  const [result, setResult] = useState<QuizResult | null>(null)
  const [legacyResult, setLegacyResult] = useState<object | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [storageError, setStorageError] = useState(false)
  const questionRef = useRef<HTMLFieldSetElement>(null)

  useEffect(() => {
    startTransition(() => {
      try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (raw) {
          const saved = JSON.parse(raw)
          if (saved?.quiz_version === QUIZ_VERSION && saved.schema_version === SCHEMA_VERSION && isDraftAnswers(saved.answers)) {
            setAnswers(saved.answers)
            const missing = QUESTIONS.findIndex(q => saved.answers[q.id] === undefined)
            setIndex(missing === -1 ? QUESTIONS.length - 1 : missing)
            if (isStoredResult(saved.result) && QUESTIONS.every(q => saved.result.answers[q.id] === saved.answers[q.id])) setResult(saved.result)
          }
        }
        const old = localStorage.getItem(LEGACY_STORAGE_KEY)
        if (old) {
          const saved = JSON.parse(old)
          if (saved?.quiz_version === "v0.1" && saved.result?.quiz_version === "v0.1") setLegacyResult(saved.result)
        }
      } catch { setStorageError(true) }
      setReady(true)
    })
  }, [])

  useEffect(() => {
    if (!ready) return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ quiz_version: QUIZ_VERSION, schema_version: SCHEMA_VERSION, answers, result }))
    } catch { startTransition(() => setStorageError(true)) }
  }, [answers, result, ready])

  useEffect(() => {
    if (started && !result) questionRef.current?.focus()
  }, [index, started, result])

  const count = Object.keys(answers).length
  const question: Question = QUESTIONS[index]
  const selected = answers[question.id]

  async function finish() {
    const missing = QUESTIONS.findIndex(q => answers[q.id] === undefined)
    if (missing !== -1) {
      setIndex(missing)
      setError("Responda esta pergunta antes de calcular o resultado.")
      return
    }
    setBusy(true)
    setError("")
    try {
      const response = await fetch("/api/quiz", {
        signal: AbortSignal.timeout(20000),
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quiz_version: QUIZ_VERSION, schema_version: SCHEMA_VERSION, answers }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error ?? "Não foi possível calcular o resultado.")
      if (!isStoredResult(payload)) throw new Error("O resultado chegou em um formato inesperado. Tente novamente.")
      setResult(payload)
      window.scrollTo({ top: 0, behavior: "instant" })
    } catch (err) {
      setError(err instanceof Error && err.name === "Error" ? err.message : "Falha de conexão. Tente novamente; suas respostas estão preservadas.")
    } finally { setBusy(false) }
  }

  function reset() {
    setAnswers({})
    setIndex(0)
    setResult(null)
    setStarted(false)
    setError("")
  }

  function downloadLegacy() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(legacyResult, null, 2)], { type: "application/json" }))
    const link = document.createElement("a")
    link.href = url
    link.download = "mapa-politico-v0.1.json"
    link.click()
    URL.revokeObjectURL(url)
  }

  return <div className={styles.quiz}>
    {storageError && <p role="status" className={styles.notice}>O navegador não permitiu salvar o progresso. Mantenha esta página aberta até concluir e baixe seu resultado.</p>}
    {result ? <Result result={result} onReview={() => { setResult(null); setStarted(true); setIndex(0) }} onReset={reset} /> : !started ? <>
      <h1>Teste de posicionamento político</h1>
      <p className={styles.intro}>Entenda sua posição entre esquerda e direita econômica, liberdade e autoridade.</p>
      <p>{QUESTIONS.length} perguntas, uma por vez. No final, veja seu mapa político e as dimensões que formam seu resultado. Sem precisar criar uma conta.</p>
      <p className={styles.muted}>Você pode voltar e revisar qualquer resposta. O progresso fica salvo neste navegador.</p>
      <p className={styles.muted}>Modelo experimental {QUIZ_VERSION}. O resultado é uma aproximação, não uma definição da sua identidade política.</p>
      <button className={styles.primary} disabled={!ready} onClick={() => setStarted(true)}>{count ? `Continuar teste · ${count}/${QUESTIONS.length}` : "Começar o teste"}</button>
      {count > 0 && <button className={styles.textButton} onClick={reset}>Descartar progresso e começar de novo</button>}
      {legacyResult && <div className={styles.legacy}>
        <p>Você tem um resultado da v0.1 salvo. Ele foi preservado. Como as perguntas e o modelo mudaram, faça um novo teste para obter um resultado da {QUIZ_VERSION}.</p>
        <button onClick={downloadLegacy}>Baixar meu resultado anterior</button>
      </div>}
      <details className={styles.details}>
        <summary>Como responder e como calculamos</summary>
        <p>Em cada pergunta, marque quanto você concorda ou discorda da ideia apresentada. Escolher uma opção não avança a pergunta: confira sua escolha e toque em “Confirmar e continuar”.</p>
        <p>“Neutro” significa que você fica no meio. “Depende” significa que sua resposta mudaria conforme a situação. “Não sei” significa que você ainda não tem informações para responder.</p>
        <p>As perguntas sobre decisões políticas ajudam a calcular os eixos e as dimensões. As oito perguntas sobre como você avalia regras e decisões não movem o ponto no mapa. A comparação com perfis dá menos peso a dimensões observadas por poucas perguntas.</p>
        <p>As respostas são enviadas para calcular o resultado, mas não são gravadas no banco. O progresso e o resultado ficam neste navegador. Você pode baixar uma cópia ao concluir.</p>
      </details>
    </> : <>
      <h1>Teste de posicionamento político</h1>
      <div className={styles.progressHeading} aria-live="polite"><span>Pergunta {index + 1} de {QUESTIONS.length}</span><span>{count} respondidas</span></div>
      <progress value={count} max={QUESTIONS.length} aria-label="Perguntas respondidas" />
      <fieldset ref={questionRef} tabIndex={-1} className={styles.question} disabled={busy} aria-describedby={`question-help-${question.id}`}>
        <legend><span className={styles.topic}>{question.topic}</span>{question.text}</legend>
        <div id={`question-help-${question.id}`} className={styles.questionHelp}>
          {question.help && <p>{question.help}</p>}
          <p>Quanto você concorda ou discorda dessa ideia?</p>
        </div>
        <div className={styles.options}>
          {OPTIONS.map(option => <label key={String(option.value)} className={selected === option.value ? styles.selected : undefined}>
            <input type="radio" name={question.id} value={option.value} checked={selected === option.value} onChange={() => { setAnswers(previous => ({ ...previous, [question.id]: option.value })); setError("") }} />
            <span>{option.label}</span>
          </label>)}
        </div>
      </fieldset>
      <p className={styles.hint}>Neutro: fico no meio. Depende: minha resposta muda conforme a situação. Não sei: preciso de mais informações.</p>
      {error && <p role="alert" className={styles.notice}>{error}</p>}
      <div className={styles.navigation}>
        <button disabled={index === 0 || busy} onClick={() => setIndex(index - 1)}>Anterior</button>
        {index < QUESTIONS.length - 1
          ? <button className={styles.primary} disabled={selected === undefined || busy} onClick={() => setIndex(index + 1)}>Confirmar e continuar</button>
          : <button className={styles.primary} disabled={selected === undefined || busy} onClick={finish}>{busy ? "Calculando…" : "Confirmar e ver resultado"}</button>}
      </div>
      <details className={styles.details}>
        <summary>Ir para uma pergunta</summary>
        <div className={styles.questionLinks}>{QUESTIONS.map((q, i) => <button key={q.id} disabled={busy} aria-label={`Pergunta ${i + 1}${answers[q.id] !== undefined ? ", respondida" : ""}`} aria-current={index === i ? "step" : undefined} className={answers[q.id] !== undefined ? styles.answered : undefined} onClick={() => setIndex(i)}>{i + 1}</button>)}</div>
      </details>
      <p className={styles.muted}>{storageError ? "Progresso disponível apenas nesta página" : "Progresso salvo neste navegador"} · {QUIZ_VERSION}</p>
    </>}
  </div>
}
