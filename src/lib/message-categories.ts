export const MESSAGE_CATEGORIES = [
  { value: "idea", label: "Ideia", description: "Uma ideia ainda sem formato definido" },
  { value: "topic", label: "Sugestão de pauta", description: "Uma sugestão para post ou nota" },
  { value: "source", label: "Fonte ou referência", description: "Um dado, estudo, livro ou material útil" },
  { value: "question", label: "Pergunta", description: "Uma dúvida sobre um texto ou ideia" },
  { value: "collaboration", label: "Colaboração", description: "Uma proposta para criar algo junto" },
  { value: "correction", label: "Correção", description: "Um erro factual, textual ou técnico" },
  { value: "improvement", label: "Melhoria", description: "Um ajuste para tornar o site melhor" },
  { value: "other", label: "Outro", description: "Qualquer outro tipo de mensagem" },
] as const

export type MessageCategory = typeof MESSAGE_CATEGORIES[number]["value"]

const MESSAGE_CATEGORY_VALUES = new Set<string>(MESSAGE_CATEGORIES.map((category) => category.value))

export function isMessageCategory(value: unknown): value is MessageCategory {
  return typeof value === "string" && MESSAGE_CATEGORY_VALUES.has(value)
}

export function messageCategoryLabel(value: string) {
  return MESSAGE_CATEGORIES.find((category) => category.value === value)?.label ?? "Outro"
}
