export const ADMIN_PUSH_TOPICS = [
  "accounts",
  "post_comments",
  "paragraph_comments",
  "note_comments",
  "new_messages",
  "message_replies",
  "identified_post_views",
  "anonymous_post_views",
  "identified_note_views",
  "anonymous_note_views",
  "site_visits",
] as const

export type AdminPushTopic = (typeof ADMIN_PUSH_TOPICS)[number]

export const ADMIN_PUSH_TOPIC_OPTIONS: ReadonlyArray<{
  value: AdminPushTopic
  label: string
  description: string
}> = [
  { value: "accounts", label: "Novas contas", description: "Quando uma pessoa concluir o cadastro." },
  { value: "post_comments", label: "Comentários em posts", description: "Comentários gerais publicados abaixo de um post." },
  { value: "paragraph_comments", label: "Comentários em trechos", description: "Comentários vinculados a um parágrafo específico." },
  { value: "note_comments", label: "Comentários em notas", description: "Quando uma nota receber um comentário." },
  { value: "new_messages", label: "Novas conversas", description: "Quando um leitor iniciar um assunto em Fale comigo." },
  { value: "message_replies", label: "Respostas em conversas", description: "Quando um leitor responder a uma conversa existente." },
  { value: "identified_post_views", label: "Visitas identificadas em posts", description: "Leituras qualificadas de usuários autenticados." },
  { value: "anonymous_post_views", label: "Visitas anônimas em posts", description: "Leituras qualificadas sem uma conta identificada." },
  { value: "identified_note_views", label: "Visitas identificadas em notas", description: "Aberturas diretas de notas por usuários autenticados." },
  { value: "anonymous_note_views", label: "Visitas anônimas em notas", description: "Aberturas diretas de notas sem uma conta identificada." },
  { value: "site_visits", label: "Qualquer visita ao site", description: "Funciona somente enquanto o monitor global estiver ligado." },
]

export const ADMIN_PUSH_TOPIC_LABELS = Object.fromEntries(
  ADMIN_PUSH_TOPIC_OPTIONS.map((option) => [option.value, option.label])
) as Record<AdminPushTopic, string>

export function normalizeAdminPushTopics(value: unknown, legacyEnabled = false): AdminPushTopic[] {
  if (!Array.isArray(value)) return legacyEnabled ? [...ADMIN_PUSH_TOPICS] : []
  return Array.from(new Set(value.filter((topic): topic is AdminPushTopic => (
    typeof topic === "string" && ADMIN_PUSH_TOPICS.includes(topic as AdminPushTopic)
  ))))
}
