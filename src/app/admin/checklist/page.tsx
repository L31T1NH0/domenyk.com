"use client";

import { useState } from "react";
import type { ChecklistRespostas } from "../../../../types/ideas";

const CRITERIOS = [
  {
    id: "gatilho",
    label: "Gatilho concreto",
    inegociavel: false,
    pergunta:
      "O post parte de algo específico — um comentário, evento, notícia, experiência pessoal?",
    sim: "Bom. O leitor sabe o que provocou você. Isso ancora o argumento na realidade.",
    nao: "Post abstrato demais. Considere abrir com o que te fez escrever isso.",
    parcial:
      "Tem um gatilho, mas está implícito. Vale torná-lo explícito no primeiro parágrafo.",
    dica: "Seus melhores posts sempre começam com algo concreto.",
  },
  {
    id: "tese",
    label: "Tese em uma frase",
    inegociavel: false,
    pergunta:
      "Você consegue resumir a posição central do post em uma única frase direta?",
    sim: "Ótimo. Clareza de tese é clareza de argumento.",
    nao: "Se você não consegue resumir, o leitor também não vai conseguir. O post precisa de mais foco.",
    parcial: "A tese existe mas está difusa. Tente explicitá-la.",
    dica: "Uma frase. Sem subteses.",
  },
  {
    id: "contraponto",
    label: "Contraponto honesto",
    inegociavel: true,
    pergunta:
      "O argumento oposto foi apresentado de forma honesta — não como palha fácil — antes de ser refutado?",
    sim: "Excelente. Destruir o argumento real é muito mais convincente do que destruir espantalho.",
    nao: "Você está pregando para convertidos. Quem discorda vai achar que você não entendeu a posição dele.",
    parcial:
      "O contraponto aparece, mas está enfraquecido. Fortaleça-o antes de refutar.",
    dica: "A regra: o oponente precisaria reconhecer sua própria posição no que você descreve.",
  },
  {
    id: "evidencia",
    label: "Evidência histórica ou concreta",
    inegociavel: true,
    pergunta:
      "O argumento é sustentado por pelo menos um exemplo histórico, dado concreto ou caso real?",
    sim: "Bem. Argumento sem evidência é opinião. Com evidência, vira posição defensável.",
    nao: "Você está pedindo que o leitor confie na sua lógica sem verificar.",
    parcial:
      "Tem evidência, mas vaga. 'Países que adotaram o livre mercado cresceram' não é evidência — Chile em 1975 é.",
    dica: "Especificidade vence generalidade. Use nomes e datas.",
  },
  {
    id: "principio",
    label: "Conexão com princípio liberal",
    inegociavel: true,
    pergunta:
      "O post se conecta explicitamente a um princípio — propriedade, liberdade individual, limite do Estado, due process?",
    sim: "Bom. Você não está só comentando um evento — está mostrando o que ele revela sobre algo maior.",
    nao: "O post corre o risco de parecer reativo. Sem princípio explícito, parece que você é contra isso, não a favor de algo.",
    parcial: "O princípio está subentendido. Vale uma frase que o deixe claro.",
    dica: "Seu diferencial é conectar o concreto ao teórico. Não abra mão disso.",
  },
  {
    id: "falseavel",
    label: "Argumento falsificável",
    inegociavel: true,
    pergunta:
      "Sua conclusão poderia ser provada errada se um dado ou exemplo contrário aparecesse?",
    sim: "Ótimo. Argumento falsificável é argumento honesto.",
    nao: "Cuidado. Se nada pode provar que você está errado, você não está fazendo um argumento — está fazendo uma crença.",
    parcial:
      "A conclusão é parcialmente falsificável. Tente torná-la mais específica.",
    dica: "Ex ruim: 'O Estado sempre atrapalha.' Ex bom: 'Em economias com índice de liberdade acima de 7, o crescimento foi maior.'",
  },
  {
    id: "provocacao",
    label: "Provocação final",
    inegociavel: false,
    pergunta:
      "O post fecha com algo que o leitor não consegue ignorar — uma pergunta, uma implicação incômoda, uma inversão?",
    sim: "Perfeito. É o que faz o leitor compartilhar.",
    nao: "O post termina antes de acabar. Considere fechar com uma pergunta que o leitor vai carregar.",
    parcial:
      "Tem um fechamento, mas é conclusivo demais. Uma boa provocação deixa espaço para o leitor pensar.",
    dica: "Uma pergunta que o leitor vai carregar.",
  },
  {
    id: "audiencia",
    label: "Clareza de audiência",
    inegociavel: false,
    pergunta:
      "Você sabe para quem está escrevendo — iniciante no tema, já convencido, ou adversário ideológico?",
    sim: "Bem. Post que tenta falar com todo mundo não fala com ninguém.",
    nao: "Defina antes de publicar. Tom, profundidade e exemplos mudam completamente.",
    parcial:
      "Você tem uma audiência em mente, mas o texto oscila entre níveis. Escolha um.",
    dica: "Você não precisa sempre escrever para convertidos. Mas precisa saber quando está fazendo isso.",
  },
] as const;

type Resposta = "sim" | "parcial" | "não";
type Phase = "intro" | "checklist" | "result";

function calcularNota(respostas: Partial<ChecklistRespostas>) {
  let total = 0;
  let max = 0;
  CRITERIOS.forEach((c) => {
    const peso = c.inegociavel ? 3 : 1;
    max += peso * 2;
    const r = respostas[c.id as keyof ChecklistRespostas];
    if (r === "sim") total += peso * 2;
    if (r === "parcial") total += peso;
  });
  return Math.round((total / max) * 100);
}

function getVeredicto(nota: number, respostas: Partial<ChecklistRespostas>) {
  const falhouInegociavel = CRITERIOS.filter((c) => c.inegociavel).some(
    (c) => respostas[c.id as keyof ChecklistRespostas] === "não"
  );
  if (falhouInegociavel) return "Não está pronto";
  if (nota >= 85) return "Pronto para publicar";
  if (nota >= 65) return "Quase lá";
  return "Precisa de trabalho";
}

function getVeredictoColor(v: string) {
  if (v === "Pronto para publicar") return "#5a9e5a";
  if (v === "Quase lá") return "#E00070";
  return "#c86e6e";
}

export default function ChecklistPage() {
  const [phase, setPhase] = useState<Phase>("intro");
  const [postTitulo, setPostTitulo] = useState("");
  const [step, setStep] = useState(0);
  const [respostas, setRespostas] = useState<Partial<ChecklistRespostas>>({});

  const criterioAtual = CRITERIOS[step];
  const nota = calcularNota(respostas);
  const veredicto = getVeredicto(nota, respostas);
  const veredictoColor = getVeredictoColor(veredicto);

  function handleResposta(r: Resposta) {
    const novasRespostas = { ...respostas, [criterioAtual.id]: r };
    setRespostas(novasRespostas);
    if (step < CRITERIOS.length - 1) {
      setStep((p) => p + 1);
    } else {
      setPhase("result");
    }
  }

  function reiniciar() {
    setPhase("intro");
    setStep(0);
    setRespostas({});
    setPostTitulo("");
  }

  return (
    <div className="mx-auto min-h-screen max-w-2xl bg-[#040404] p-6 text-[#f1f1f1]">
      {phase === "intro" && (
        <div className="flex flex-col gap-6">
          <h1 className="text-2xl font-bold">Checklist Pré-Publicação</h1>
          <p className="text-sm text-[#A8A095]">
            8 critérios. Responda um por vez. O post ou está pronto ou não está.
          </p>

          <div className="rounded-md border border-white/10 bg-zinc-900/50 p-4">
            <p className="mb-3 text-xs font-bold uppercase tracking-widest text-[#A8A095]">
              Critérios inegociáveis
            </p>
            <div className="flex flex-col gap-1.5">
              {CRITERIOS.filter((c) => c.inegociavel).map((c) => (
                <div key={c.id} className="flex items-center gap-2 text-sm">
                  <span className="text-[#E00070]">⚑</span>
                  <span>{c.label}</span>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-[#A8A095]">
              Falhar em qualquer um desses bloqueia a publicação independente da nota.
            </p>
          </div>

          <input
            value={postTitulo}
            onChange={(e) => setPostTitulo(e.target.value)}
            placeholder="Título do post (opcional)"
            className="rounded-md border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-[#f1f1f1] placeholder:text-zinc-600 focus:border-[#E00070]/50 focus:outline-none"
          />

          <button
            onClick={() => setPhase("checklist")}
            className="rounded-md bg-[#E00070] py-2.5 text-sm font-bold text-white transition hover:opacity-80"
          >
            Iniciar checklist
          </button>
        </div>
      )}

      {phase === "checklist" && (
        <div className="flex flex-col gap-5">
          <div className="fixed left-0 right-0 top-0 z-50 h-0.5 bg-zinc-800">
            <div
              className="h-full bg-[#E00070] transition-all duration-300"
              style={{ width: `${((step + 1) / CRITERIOS.length) * 100}%` }}
            />
          </div>

          <div className="mt-2 flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-widest text-[#A8A095]">
              {step + 1} / {CRITERIOS.length}
            </span>
            {criterioAtual.inegociavel && (
              <span className="rounded border border-[#E00070]/40 px-2 py-0.5 text-[10px] font-bold text-[#E00070]">
                ⚑ inegociável
              </span>
            )}
          </div>

          <h2 className="text-xl font-bold">{criterioAtual.label}</h2>
          <p className="text-base text-[#f1f1f1]">{criterioAtual.pergunta}</p>

          <div className="rounded-r-md border-l-2 border-[#E00070] bg-zinc-900/50 py-2 pl-3 pr-3">
            <p className="text-xs text-[#A8A095]">{criterioAtual.dica}</p>
          </div>

          <div className="mt-2 flex flex-col gap-2">
            <button
              onClick={() => handleResposta("sim")}
              className="flex items-center gap-3 rounded-md border border-white/10 px-4 py-3 text-left transition hover:border-[#5a9e5a] hover:bg-[#5a9e5a]/5"
            >
              <span className="text-sm font-bold text-[#5a9e5a]">✓ Sim</span>
            </button>
            <button
              onClick={() => handleResposta("parcial")}
              className="flex items-center gap-3 rounded-md border border-white/10 px-4 py-3 text-left transition hover:border-[#E00070]/50 hover:bg-[#E00070]/5"
            >
              <span className="text-sm font-bold text-[#E00070]">~ Parcialmente</span>
            </button>
            <button
              onClick={() => handleResposta("não")}
              className="flex items-center gap-3 rounded-md border border-white/10 px-4 py-3 text-left transition hover:border-[#c86e6e]/50 hover:bg-[#c86e6e]/5"
            >
              <span className="text-sm font-bold text-[#c86e6e]">✕ Não</span>
            </button>
          </div>
        </div>
      )}

      {phase === "result" && (
        <div className="flex flex-col gap-6">
          {postTitulo && <p className="text-sm text-[#A8A095]">"{postTitulo}"</p>}

          <div className="flex flex-col gap-2">
            <span style={{ color: veredictoColor }} className="text-6xl font-bold">
              {nota}
            </span>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${nota}%`, backgroundColor: veredictoColor }}
              />
            </div>
            <div
              className="mt-1 rounded-md border px-4 py-3"
              style={{
                borderColor: `${veredictoColor}40`,
                backgroundColor: `${veredictoColor}10`,
              }}
            >
              <p className="text-sm font-bold" style={{ color: veredictoColor }}>
                {veredicto}
              </p>
              {veredicto === "Não está pronto" && (
                <p className="mt-1 text-xs text-[#A8A095]">
                  Falhou em critério inegociável. Corrija antes de publicar.
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-xs font-bold uppercase tracking-widest text-[#A8A095]">
              Diagnóstico
            </p>
            {CRITERIOS.map((c) => {
              const r = respostas[c.id as keyof ChecklistRespostas];
              const feedback = r ? c[r as "sim" | "parcial" | "nao"] : "";
              const color = r === "sim" ? "#5a9e5a" : r === "parcial" ? "#E00070" : "#c86e6e";
              const icon = r === "sim" ? "✓" : r === "parcial" ? "~" : "✕";
              return (
                <div
                  key={c.id}
                  className="flex flex-col gap-1 rounded-md border border-white/10 px-3 py-2.5"
                >
                  <div className="flex items-center gap-2">
                    <span style={{ color }} className="text-xs font-bold">
                      {icon}
                    </span>
                    <span className="text-sm font-medium">{c.label}</span>
                    {c.inegociavel && <span className="text-[10px] text-[#E00070]">⚑</span>}
                    <span className="ml-auto text-[10px] text-[#A8A095]">{r}</span>
                  </div>
                  {feedback && <p className="text-xs italic text-[#A8A095]">{feedback}</p>}
                </div>
              );
            })}
          </div>

          <div className="border-l-2 border-[#E00070] py-2 pl-4">
            {veredicto === "Pronto para publicar" ? (
              <p className="text-sm text-[#f1f1f1]">
                O post está sólido. Todos os critérios passaram. Pode publicar.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                <p className="text-sm font-bold text-[#f1f1f1]">Antes de publicar, corrija:</p>
                {CRITERIOS.filter(
                  (c) => respostas[c.id as keyof ChecklistRespostas] !== "sim"
                ).map((c) => {
                  const r = respostas[c.id as keyof ChecklistRespostas];
                  if (!r) return null;
                  return (
                    <div key={c.id} className="text-sm text-[#A8A095]">
                      <span className="font-medium text-[#f1f1f1]">{c.label}: </span>
                      {c[r as "parcial" | "nao"]} {c.dica}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <button
            onClick={reiniciar}
            className="rounded-md border border-white/10 py-2.5 text-sm text-[#A8A095] transition hover:border-white/30"
          >
            Novo checklist
          </button>
        </div>
      )}
    </div>
  );
}
