"use client";

import { useEffect, useState } from "react";
import type { Idea, IdeaOutline } from "../../../../types/ideas";

const GATILHOS = [
  "Comentário / debate online",
  "Notícia ou evento político",
  "Experiência pessoal",
  "Morte / atentado",
  "Lançamento de produto / tecnologia",
  "Lei ou medida governamental",
  "Outro",
];

const TAGS_SUGERIDAS = [
  "liberalismo",
  "liberdade-economia",
  "desigualdade",
  "STF",
  "censura",
  "intervenção-estado",
  "justiça-social",
  "propriedade-privada",
  "IA",
  "regulamentação",
  "história",
  "política",
  "direitos-individuais",
];

const OUTLINE_STEPS = [
  {
    id: "gatilho",
    label: "Gatilho",
    icon: "⚡",
    description: "O que provocou esse post? Seja específico.",
    placeholder: "Ex: Um comentário no Instagram sobre impostos progressivos...",
    tip: "Seus melhores posts sempre começam com algo concreto que te irritou, emocionou ou intrigou.",
  },
  {
    id: "tese",
    label: "Tese central",
    icon: "🎯",
    description: "Em uma frase, qual é sua posição?",
    placeholder:
      "Ex: A desigualdade no Brasil é produto do Estado, não do livre mercado.",
    tip: "Se não der pra resumir em uma frase, a ideia ainda não está madura.",
  },
  {
    id: "argumento_principal",
    label: "Argumento principal",
    icon: "🔑",
    description: "Por que sua tese é verdadeira? O mecanismo central.",
    placeholder:
      "Ex: Toda intervenção estatal cria privilégios para poucos às custas de todos...",
    tip: "Aqui entra Bastiat, Hayek, exemplos históricos. O coração analítico do post.",
  },
  {
    id: "historico",
    label: "Contexto histórico",
    icon: "📜",
    description: "Qual exemplo histórico ou caso concreto sustenta seu argumento?",
    placeholder:
      "Ex: Capitanias hereditárias, Navigation Acts, Homestead Act...",
    tip: "Especificidade vence generalidade. Use nomes e datas.",
  },
  {
    id: "contraponto",
    label: "O que os outros dizem",
    icon: "⚖️",
    description: "Qual é o argumento oposto mais forte? Como você responde?",
    placeholder:
      "Ex: 'Impostos progressivos são justiça social' — mas redistribuição não ataca a raiz...",
    tip: "Seus posts ficam mais fortes quando você trata o argumento contrário de forma honesta antes de destruí-lo.",
  },
  {
    id: "implicacao",
    label: "Implicação prática",
    icon: "🔧",
    description: "O que muda se sua tese for aceita?",
    placeholder: "Ex: Flat tax, vouchers, limite ao poder do STF...",
    tip: "Você não fica no abstrato — sempre conecta ao concreto. Mantenha isso.",
  },
  {
    id: "provocacao",
    label: "Provocação final",
    icon: "💥",
    description: "Com qual pergunta ou frase você fecha o post?",
    placeholder:
      "Ex: Se a desigualdade foi moldada pelo Estado, suas ideias de redistribuição desafiam o sistema ou apenas o reforçam?",
    tip: "Sua melhor assinatura. Uma pergunta que o leitor não consegue ignorar.",
  },
] as const;

type View = "list" | "new" | "outline";

export default function IdeiasPage() {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>("list");
  const [selectedIdea, setSelectedIdea] = useState<Idea | null>(null);
  const [outlineStep, setOutlineStep] = useState(0);
  const [outlineData, setOutlineData] = useState<Partial<IdeaOutline>>({});
  const [toast, setToast] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [gatilhoTipo, setGatilhoTipo] = useState("");
  const [gatilho, setGatilho] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [notas, setNotas] = useState("");
  const [customTag, setCustomTag] = useState("");

  useEffect(() => {
    void fetchIdeas();
  }, []);

  async function fetchIdeas() {
    setLoading(true);
    const res = await fetch("/admin/api/ideas");
    const data = await res.json();
    setIdeas(Array.isArray(data) ? data : []);
    setLoading(false);
  }

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }

  async function handleCreateIdea() {
    if (!title.trim() || !gatilhoTipo) return;
    await fetch("/admin/api/ideas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, gatilhoTipo, gatilho, tags, notas }),
    });
    showToast("Ideia salva.");
    setTitle("");
    setGatilhoTipo("");
    setGatilho("");
    setTags([]);
    setNotas("");
    setView("list");
    void fetchIdeas();
  }

  async function handleDeleteIdea(id: string) {
    await fetch(`/admin/api/ideas/${id}`, { method: "DELETE" });
    showToast("Ideia removida.");
    void fetchIdeas();
  }

  function openOutline(idea: Idea) {
    setSelectedIdea(idea);
    setOutlineData(idea.outline ?? {});
    setOutlineStep(0);
    setView("outline");
  }

  async function handleSaveOutline() {
    if (!selectedIdea) return;
    await fetch(`/admin/api/ideas/${selectedIdea._id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        outline: outlineData,
        outlineAt: new Date().toISOString(),
      }),
    });
    showToast("Outline salvo.");
    setView("list");
    void fetchIdeas();
  }

  const currentStep = OUTLINE_STEPS[outlineStep];

  return (
    <div className="mx-auto min-h-screen max-w-4xl bg-[#040404] p-6 text-[#f1f1f1]">
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 rounded-md bg-[#E00070] px-4 py-2 text-xs font-bold text-white">
          {toast}
        </div>
      )}

      {view === "list" && (
        <>
          <div className="mb-8 flex items-center justify-between">
            <h1 className="text-2xl font-bold text-[#f1f1f1]">Banco de Ideias</h1>
            <button
              onClick={() => setView("new")}
              className="rounded-md bg-[#E00070] px-4 py-2 text-sm font-bold text-white transition hover:opacity-80"
            >
              + Nova Ideia
            </button>
          </div>

          {loading ? (
            <p className="text-sm text-[#A8A095]">Carregando...</p>
          ) : ideas.length === 0 ? (
            <p className="text-sm text-[#A8A095]">Nenhuma ideia ainda.</p>
          ) : (
            <div className="grid gap-3">
              {ideas.map((idea) => (
                <div
                  key={idea._id}
                  className="flex flex-col gap-2 rounded-md border border-white/10 bg-zinc-900/50 p-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex flex-col gap-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded border border-white/10 bg-zinc-800 px-2 py-0.5 text-[10px] font-bold text-[#A8A095]">
                          {idea.gatilhoTipo}
                        </span>
                        {idea.outline && (
                          <span className="rounded border border-[#E00070]/40 bg-[#E00070]/20 px-2 py-0.5 text-[10px] font-bold text-[#E00070]">
                            outline ✓
                          </span>
                        )}
                      </div>
                      <h2 className="font-bold text-[#f1f1f1]">{idea.title}</h2>
                      {idea.gatilho && (
                        <p className="line-clamp-2 text-sm text-[#A8A095]">{idea.gatilho}</p>
                      )}
                      {idea.tags.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {idea.tags.map((t) => (
                            <span
                              key={t}
                              className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-[#A8A095]"
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="shrink-0 flex flex-col gap-2">
                      <button
                        onClick={() => openOutline(idea)}
                        className="whitespace-nowrap rounded border border-white/10 px-3 py-1.5 text-xs text-[#f1f1f1] transition hover:border-[#E00070]/50"
                      >
                        {idea.outline ? "Ver Outline" : "Criar Outline →"}
                      </button>
                      <button
                        onClick={() => handleDeleteIdea(idea._id)}
                        className="text-right text-xs text-[#A8A095] transition hover:text-red-400"
                      >
                        remover
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {view === "new" && (
        <>
          <div className="mb-8 flex items-center gap-4">
            <button
              onClick={() => setView("list")}
              className="text-sm text-[#A8A095] transition hover:text-[#f1f1f1]"
            >
              ← Voltar
            </button>
            <h1 className="text-2xl font-bold">Nova Ideia</h1>
          </div>

          <div className="flex flex-col gap-5">
            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-[#A8A095]">
                Título
              </label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="O que você quer dizer?"
                className="w-full rounded-md border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-[#f1f1f1] placeholder:text-zinc-600 focus:border-[#E00070]/50 focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-[#A8A095]">
                Tipo de gatilho
              </label>
              <div className="flex flex-wrap gap-2">
                {GATILHOS.map((g) => (
                  <button
                    key={g}
                    onClick={() => setGatilhoTipo(g)}
                    className={`rounded border px-3 py-1.5 text-xs transition ${
                      gatilhoTipo === g
                        ? "border-[#E00070] bg-[#E00070] text-white"
                        : "border-white/10 text-[#A8A095] hover:border-white/30"
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-[#A8A095]">
                O que aconteceu?
              </label>
              <textarea
                value={gatilho}
                onChange={(e) => setGatilho(e.target.value)}
                rows={3}
                placeholder="Descreva o gatilho sem compromisso com a tese..."
                className="w-full resize-none rounded-md border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-[#f1f1f1] placeholder:text-zinc-600 focus:border-[#E00070]/50 focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-[#A8A095]">
                Tags
              </label>
              <div className="mb-2 flex flex-wrap gap-2">
                {TAGS_SUGERIDAS.map((t) => (
                  <button
                    key={t}
                    onClick={() =>
                      setTags((prev) =>
                        prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]
                      )
                    }
                    className={`rounded border px-2 py-1 text-xs transition ${
                      tags.includes(t)
                        ? "border-[#E00070]/50 bg-[#E00070]/20 text-[#f1f1f1]"
                        : "border-white/10 text-[#A8A095] hover:border-white/30"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <input
                value={customTag}
                onChange={(e) => setCustomTag(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && customTag.trim()) {
                    setTags((prev) => [...prev, customTag.trim()]);
                    setCustomTag("");
                  }
                }}
                placeholder="Tag personalizada (Enter para adicionar)"
                className="w-full rounded-md border border-white/10 bg-zinc-900 px-3 py-1.5 text-xs text-[#f1f1f1] placeholder:text-zinc-600 focus:border-[#E00070]/50 focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-[#A8A095]">
                Notas livres
              </label>
              <textarea
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                rows={3}
                placeholder="Referências, links, pensamentos soltos..."
                className="w-full resize-none rounded-md border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-[#f1f1f1] placeholder:text-zinc-600 focus:border-[#E00070]/50 focus:outline-none"
              />
            </div>

            <button
              onClick={handleCreateIdea}
              disabled={!title.trim() || !gatilhoTipo}
              className="rounded-md bg-[#E00070] py-2.5 text-sm font-bold text-white transition hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-30"
            >
              Salvar Ideia
            </button>
          </div>
        </>
      )}

      {view === "outline" && selectedIdea && (
        <>
          <div className="mb-6 flex items-center gap-4">
            <button
              onClick={() => setView("list")}
              className="text-sm text-[#A8A095] transition hover:text-[#f1f1f1]"
            >
              ← Voltar
            </button>
            <h1 className="truncate text-lg font-bold">{selectedIdea.title}</h1>
          </div>

          <div className="mb-8 flex items-center gap-2">
            {OUTLINE_STEPS.map((s, i) => {
              const hasContent = !!(outlineData as Record<string, string>)[s.id];
              return (
                <button
                  key={s.id}
                  onClick={() => setOutlineStep(i)}
                  className={`h-2 rounded-full transition-all ${
                    i === outlineStep
                      ? "w-6 bg-[#E00070]"
                      : hasContent
                        ? "w-2 bg-[#3a5a3a]"
                        : "w-2 bg-zinc-700"
                  }`}
                />
              );
            })}
          </div>

          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <span className="text-2xl">{currentStep.icon}</span>
              <span className="text-xs font-bold uppercase tracking-widest text-[#A8A095]">
                Passo {outlineStep + 1} de {OUTLINE_STEPS.length}
              </span>
            </div>
            <h2 className="text-xl font-bold">{currentStep.label}</h2>
            <p className="text-sm text-[#A8A095]">{currentStep.description}</p>

            <div className="rounded-r-md border-l-2 border-[#E00070] bg-zinc-900/50 py-2 pl-3 pr-3">
              <p className="text-xs text-[#A8A095]">{currentStep.tip}</p>
            </div>

            <textarea
              rows={5}
              value={(outlineData as Record<string, string>)[currentStep.id] ?? ""}
              onChange={(e) =>
                setOutlineData((prev) => ({ ...prev, [currentStep.id]: e.target.value }))
              }
              placeholder={currentStep.placeholder}
              className="w-full resize-none rounded-md border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-[#f1f1f1] placeholder:text-zinc-600 focus:border-[#E00070]/50 focus:outline-none"
            />

            <div className="flex gap-3">
              {outlineStep > 0 && (
                <button
                  onClick={() => setOutlineStep((p) => p - 1)}
                  className="flex-1 rounded-md border border-white/10 py-2 text-sm text-[#A8A095] transition hover:border-white/30"
                >
                  ← Anterior
                </button>
              )}
              {outlineStep < OUTLINE_STEPS.length - 1 ? (
                <button
                  onClick={() => setOutlineStep((p) => p + 1)}
                  className="flex-1 rounded-md bg-zinc-800 py-2 text-sm font-bold text-[#f1f1f1] transition hover:bg-zinc-700"
                >
                  Próximo →
                </button>
              ) : (
                <button
                  onClick={handleSaveOutline}
                  className="flex-1 rounded-md bg-[#E00070] py-2 text-sm font-bold text-white transition hover:opacity-80"
                >
                  Salvar Outline
                </button>
              )}
            </div>

            {Object.values(outlineData).some(Boolean) && (
              <details className="mt-4 rounded-md border border-white/10">
                <summary className="cursor-pointer px-4 py-3 text-xs font-bold uppercase tracking-widest text-[#A8A095]">
                  Preview do outline
                </summary>
                <div className="flex flex-col gap-3 px-4 pb-4">
                  {OUTLINE_STEPS.map((s) => {
                    const val = (outlineData as Record<string, string>)[s.id];
                    if (!val) return null;
                    return (
                      <div key={s.id}>
                        <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-[#A8A095]">
                          {s.icon} {s.label}
                        </p>
                        <p className="text-sm text-[#f1f1f1]">{val}</p>
                      </div>
                    );
                  })}
                </div>
              </details>
            )}
          </div>
        </>
      )}
    </div>
  );
}
