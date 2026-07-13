"use client"

import { FormEvent, KeyboardEvent, useEffect, useId, useRef, useState } from "react"
import { useClerk, useUser } from "@clerk/nextjs"
import {
  ArchiveBoxIcon,
  CheckIcon,
  ChevronDownIcon,
  PaperAirplaneIcon,
} from "@heroicons/react/24/outline"
import { DeleteActionMenu } from "@/components/actions/DeleteActionMenu"
import { MESSAGE_CATEGORIES, messageCategoryLabel } from "@/lib/message-categories"

type Entry = { _id: string; authorName: string; body: string; createdAt: string; readAt?: string; isOwn: boolean }
type Thread = { _id: string; subject: string; category: string; status: string; archivedAt?: string; entries?: Entry[]; updatedAt: string; lastMessage?: { body: string; createdAt: string } | null }

const STATUS_LABELS: Record<string, string> = {
  open: "Aguardando resposta",
  answered: "Respondido",
  accepted: "Sugestão aceita",
  declined: "Sugestão negada",
  closed: "Encerrado",
}

const FIELD_CLASS_NAME = "block min-h-11 w-full rounded-lg border border-zinc-300 bg-white/40 px-3.5 py-2.5 text-[15px] text-zinc-950 outline-none transition-[border-color,background-color,box-shadow] placeholder:text-zinc-500 hover:border-zinc-400 focus-visible:border-zinc-500 focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-zinc-500/25 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-white/[0.03] dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:hover:border-zinc-600 dark:focus-visible:border-zinc-500 dark:focus-visible:bg-white/[0.05] dark:focus-visible:ring-zinc-400/25"
const SECONDARY_BUTTON_CLASS_NAME = "inline-flex min-h-11 items-center justify-center rounded-lg border border-zinc-300 px-4 text-sm font-medium text-zinc-800 outline-none transition-colors hover:border-zinc-400 hover:bg-zinc-100 focus-visible:ring-2 focus-visible:ring-zinc-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[#f4f4f4] active:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-200 dark:hover:border-zinc-600 dark:hover:bg-white/[0.07] dark:focus-visible:ring-zinc-300 dark:focus-visible:ring-offset-[#040404] dark:active:bg-white/10"

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value))
}

export function Correspondence() {
  const { isLoaded, isSignedIn } = useUser()
  const clerk = useClerk()
  const categoryListboxId = useId()
  const categoryRootRef = useRef<HTMLDivElement>(null)
  const categoryTriggerRef = useRef<HTMLButtonElement>(null)
  const categoryOptionRefs = useRef<Array<HTMLButtonElement | null>>([])
  const [threads, setThreads] = useState<Thread[] | null>(null)
  const [subject, setSubject] = useState("")
  const [body, setBody] = useState("")
  const [category, setCategory] = useState("idea")
  const [categoryOpen, setCategoryOpen] = useState(false)
  const [reply, setReply] = useState<Record<string, string>>({})
  const [pendingAction, setPendingAction] = useState<string | null>(null)
  const [error, setError] = useState("")
  const [selected, setSelected] = useState<string | null>(null)
  const [loadingThread, setLoadingThread] = useState<string | null>(null)
  const [cursor, setCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [archived, setArchived] = useState(false)

  async function openThread(id: string) {
    if (selected === id) {
      setSelected(null)
      return
    }

    setSelected(id)
    if (threads?.find((thread) => thread._id === id)?.entries) return
    setLoadingThread(id)
    const response = await fetch(`/api/messages/${id}`, { cache: "no-store" })
    if (!response.ok) {
      setError("Não foi possível abrir este assunto.")
      setLoadingThread(null)
      return
    }
    const detail = await response.json()
    setThreads((current) => current?.map((thread) => thread._id === id ? detail : thread) ?? [])
    setLoadingThread(null)
  }

  useEffect(() => {
    if (!isSignedIn) return
    let cancelled = false
    fetch(`/api/messages${archived ? "?archived=1" : ""}`, { cache: "no-store" })
      .then((response) => response.ok ? response.json() : { items: [] })
      .then((data) => {
        if (!cancelled) {
          setThreads(data.items)
          setCursor(data.nextCursor)
          setHasMore(data.hasMore)
        }
      })
    return () => { cancelled = true }
  }, [isSignedIn, archived])

  useEffect(() => {
    if (!categoryOpen) return

    function handlePointerDown(event: PointerEvent) {
      if (!categoryRootRef.current?.contains(event.target as Node)) setCategoryOpen(false)
    }

    function handleEscape(event: globalThis.KeyboardEvent) {
      if (event.key !== "Escape") return
      event.preventDefault()
      setCategoryOpen(false)
      categoryTriggerRef.current?.focus()
    }

    document.addEventListener("pointerdown", handlePointerDown)
    document.addEventListener("keydown", handleEscape)
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown)
      document.removeEventListener("keydown", handleEscape)
    }
  }, [categoryOpen])

  async function send(event: FormEvent) {
    event.preventDefault()
    setPendingAction("send")
    setError("")
    const response = await fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject, body, category }),
    })
    const data = await response.json().catch(() => ({}))
    setPendingAction(null)
    if (!response.ok) return setError(data.error ?? "Não foi possível enviar.")
    setThreads((current) => [data, ...(current ?? [])])
    setSelected(data._id)
    setSubject("")
    setBody("")
  }

  async function loadMore() {
    if (!cursor) return
    setPendingAction("load-more")
    const params = new URLSearchParams({ cursor, ...(archived ? { archived: "1" } : {}) })
    const response = await fetch(`/api/messages?${params}`, { cache: "no-store" })
    setPendingAction(null)
    if (!response.ok) return setError("Não foi possível carregar os assuntos anteriores.")
    const data = await response.json()
    setThreads((current) => [...(current ?? []), ...data.items])
    setCursor(data.nextCursor)
    setHasMore(data.hasMore)
  }

  async function answer(id: string) {
    const text = reply[id]?.trim()
    if (!text) return
    setPendingAction(`reply:${id}`)
    setError("")
    const response = await fetch(`/api/messages/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: text }),
    })
    const data = await response.json().catch(() => ({}))
    setPendingAction(null)
    if (!response.ok) return setError(data.error ?? "Não foi possível responder.")
    setThreads((current) => current?.map((thread) => thread._id === id ? data : thread) ?? [])
    setReply((current) => ({ ...current, [id]: "" }))
  }

  async function deleteThread(id: string) {
    setPendingAction(`delete:${id}`)
    setError("")
    const response = await fetch(`/api/messages/${id}`, { method: "DELETE" })
    setPendingAction(null)
    if (!response.ok) {
      const message = "Não foi possível excluir o assunto."
      setError(message)
      throw new Error(message)
    }
    setThreads((current) => current?.filter((thread) => thread._id !== id) ?? [])
    setSelected(null)
  }

  function toggleArchived() {
    setArchived((value) => !value)
    setSelected(null)
    setThreads(null)
    setError("")
  }

  function focusCategoryOption(index: number) {
    requestAnimationFrame(() => categoryOptionRefs.current[index]?.focus())
  }

  function handleCategoryTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return
    event.preventDefault()
    setCategoryOpen(true)
    const selectedIndex = MESSAGE_CATEGORIES.findIndex((option) => option.value === category)
    focusCategoryOption(event.key === "ArrowDown" ? selectedIndex : Math.max(0, selectedIndex - 1))
  }

  function handleCategoryListKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return
    event.preventDefault()
    const currentIndex = categoryOptionRefs.current.indexOf(document.activeElement as HTMLButtonElement)
    const nextIndex = event.key === "Home"
      ? 0
      : event.key === "End"
        ? MESSAGE_CATEGORIES.length - 1
        : event.key === "ArrowDown"
          ? (currentIndex + 1 + MESSAGE_CATEGORIES.length) % MESSAGE_CATEGORIES.length
          : (currentIndex - 1 + MESSAGE_CATEGORIES.length) % MESSAGE_CATEGORIES.length
    categoryOptionRefs.current[nextIndex]?.focus()
  }

  function selectCategory(value: string) {
    setCategory(value)
    setCategoryOpen(false)
    categoryTriggerRef.current?.focus()
  }

  const isBusy = pendingAction !== null
  const selectedCategory = MESSAGE_CATEGORIES.find((option) => option.value === category) ?? MESSAGE_CATEGORIES[0]

  if (!isLoaded) return (
    <div className="py-12 sm:py-16" aria-label="Carregando página">
      <div className="h-9 w-44 animate-pulse rounded-md bg-zinc-200 motion-reduce:animate-none dark:bg-zinc-800" />
      <div className="mt-4 h-4 w-full max-w-md animate-pulse rounded bg-zinc-200 motion-reduce:animate-none dark:bg-zinc-800" />
      <div className="mt-2 h-4 w-4/5 max-w-sm animate-pulse rounded bg-zinc-200 motion-reduce:animate-none dark:bg-zinc-800" />
    </div>
  )

  if (!isSignedIn) return (
    <div className="py-12 sm:py-16">
      <header>
        <h1 className="text-balance text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-100">Fale comigo</h1>
        <p className="mt-4 max-w-lg text-pretty text-[15px] leading-7 text-zinc-600 dark:text-zinc-400">
          Um espaço direto para enviar uma ideia, apontar uma correção ou sugerir uma melhoria — sem precisar encaixá-la em um post.
        </p>
      </header>
      <div className="mt-8 border-y border-zinc-300 py-6 dark:border-zinc-800">
        <p className="max-w-md text-sm leading-6 text-zinc-600 dark:text-zinc-400">Entre na sua conta para escrever e acompanhar as respostas no mesmo lugar.</p>
        <button
          type="button"
          onClick={() => clerk.openSignIn()}
          className="mt-5 inline-flex min-h-11 items-center justify-center rounded-lg bg-zinc-950 px-5 text-sm font-semibold text-white outline-none transition-colors hover:bg-zinc-800 focus-visible:ring-2 focus-visible:ring-zinc-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[#f4f4f4] active:bg-black dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200 dark:focus-visible:ring-zinc-300 dark:focus-visible:ring-offset-[#040404]"
        >
          Entrar para escrever
        </button>
      </div>
    </div>
  )

  return (
    <div className="py-10 sm:py-14">
      <header>
        <h1 className="text-balance text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-100">Fale comigo</h1>
        <p className="mt-3 max-w-xl text-pretty text-[15px] leading-7 text-zinc-600 dark:text-zinc-400">
          Envie uma ideia, crítica ou melhoria. Cada mensagem vira um assunto que fica guardado aqui para continuarmos quando fizer sentido.
        </p>
      </header>

      <section className="mt-8 border-y border-zinc-300 py-7 dark:border-zinc-800" aria-labelledby="new-message-title">
        <div className="flex items-baseline justify-between gap-4">
          <h2 id="new-message-title" className="text-lg font-semibold tracking-tight">Nova mensagem</h2>
          <span className="text-xs text-zinc-500">Resposta por aqui</span>
        </div>

        <form onSubmit={send} className="mt-6 space-y-5">
          <div>
            <label className="block text-sm font-medium" htmlFor="category">Categoria</label>
            <div
              ref={categoryRootRef}
              className="relative mt-2"
              onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setCategoryOpen(false)
              }}
            >
              <button
                ref={categoryTriggerRef}
                type="button"
                id="category"
                aria-haspopup="listbox"
                aria-expanded={categoryOpen}
                aria-controls={categoryOpen ? categoryListboxId : undefined}
                onClick={() => setCategoryOpen((open) => !open)}
                onKeyDown={handleCategoryTriggerKeyDown}
                className={`${FIELD_CLASS_NAME} flex min-h-14 cursor-pointer items-center justify-between gap-4 text-left`}
              >
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">{selectedCategory.label}</span>
                  <span className="mt-0.5 block truncate text-xs font-normal text-zinc-500 dark:text-zinc-400">{selectedCategory.description}</span>
                </span>
                <ChevronDownIcon aria-hidden className={`size-4 shrink-0 text-zinc-500 transition-transform duration-200 motion-reduce:transition-none ${categoryOpen ? "rotate-180" : ""}`} />
              </button>

              {categoryOpen && (
                <div
                  id={categoryListboxId}
                  role="listbox"
                  aria-label="Escolha uma categoria"
                  onKeyDown={handleCategoryListKeyDown}
                  className="public-menu-panel absolute z-50 mt-2 max-h-[min(28rem,calc(100dvh-8rem))] w-full overflow-y-auto overscroll-contain rounded-lg border border-zinc-300 bg-[#f4f4f4] p-1.5 shadow-[0_6px_8px_rgba(0,0,0,0.12)] dark:border-zinc-700 dark:bg-[#151515] dark:shadow-[0_6px_8px_rgba(0,0,0,0.38)]"
                >
                  {MESSAGE_CATEGORIES.map((option, index) => {
                    const isSelected = option.value === category
                    return (
                      <button
                        key={option.value}
                        ref={(element) => { categoryOptionRefs.current[index] = element }}
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        onClick={() => selectCategory(option.value)}
                        className={`flex min-h-14 w-full items-center gap-3 rounded-md px-3 py-2 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-zinc-500 dark:focus-visible:ring-zinc-300 ${isSelected ? "bg-zinc-200/80 text-zinc-950 dark:bg-white/10 dark:text-white" : "text-zinc-800 hover:bg-zinc-200/60 dark:text-zinc-200 dark:hover:bg-white/[0.07]"}`}
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-semibold">{option.label}</span>
                          <span className="mt-0.5 block text-xs font-normal text-zinc-500 dark:text-zinc-400">{option.description}</span>
                        </span>
                        <CheckIcon aria-hidden className={`size-4 shrink-0 ${isSelected ? "opacity-100" : "opacity-0"}`} />
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          <div>
            <div className="flex items-baseline justify-between gap-4">
              <label className="block text-sm font-medium" htmlFor="subject">Assunto</label>
              <span className="text-xs tabular-nums text-zinc-500">{subject.length}/120</span>
            </div>
            <input
              id="subject"
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              minLength={3}
              maxLength={120}
              required
              className={`${FIELD_CLASS_NAME} mt-2`}
              placeholder="Resuma em poucas palavras"
            />
          </div>

          <div>
            <div className="flex items-baseline justify-between gap-4">
              <label className="block text-sm font-medium" htmlFor="message">Mensagem</label>
              <span className="text-xs tabular-nums text-zinc-500">{body.length}/5000</span>
            </div>
            <textarea
              id="message"
              value={body}
              onChange={(event) => setBody(event.target.value)}
              minLength={10}
              maxLength={5000}
              required
              rows={6}
              className={`${FIELD_CLASS_NAME} mt-2 resize-y leading-6`}
              placeholder="Conte a ideia com o contexto que achar importante."
            />
          </div>

          <div className="flex flex-col-reverse gap-3 pt-1 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-h-5 text-sm text-red-700 dark:text-red-400" role="alert" aria-live="polite">{error}</div>
            <button
              disabled={isBusy}
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-zinc-950 px-5 text-sm font-semibold text-white outline-none transition-colors hover:bg-zinc-800 focus-visible:ring-2 focus-visible:ring-zinc-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[#f4f4f4] active:bg-black disabled:cursor-wait disabled:opacity-50 sm:w-auto dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200 dark:focus-visible:ring-zinc-300 dark:focus-visible:ring-offset-[#040404]"
            >
              <PaperAirplaneIcon aria-hidden className="size-4" />
              {pendingAction === "send" ? "Enviando…" : "Enviar mensagem"}
            </button>
          </div>
        </form>
      </section>

      <section className="mt-10" aria-labelledby="history-title">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 id="history-title" className="text-lg font-semibold tracking-tight">{archived ? "Assuntos arquivados" : "Seus assuntos"}</h2>
            <p className="mt-1 text-sm text-zinc-500">{archived ? "Conversas que você guardou." : "Acompanhe as respostas e continue a conversa."}</p>
          </div>
          <button
            type="button"
            onClick={toggleArchived}
            className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-lg px-2 text-sm font-medium text-zinc-600 outline-none transition-colors hover:bg-zinc-200/60 hover:text-zinc-950 focus-visible:ring-2 focus-visible:ring-zinc-500 dark:text-zinc-400 dark:hover:bg-white/[0.07] dark:hover:text-white dark:focus-visible:ring-zinc-300"
          >
            <ArchiveBoxIcon aria-hidden className="size-4" />
            {archived ? "Ver atuais" : "Arquivados"}
          </button>
        </div>

        {threads === null ? (
          <div className="mt-6 space-y-4 border-y border-zinc-300 py-5 dark:border-zinc-800" aria-label="Carregando assuntos">
            {["w-3/5", "w-4/5"].map((width) => (
              <div key={width} className="animate-pulse motion-reduce:animate-none">
                <div className={`h-4 ${width} rounded bg-zinc-200 dark:bg-zinc-800`} />
                <div className="mt-2 h-3 w-2/5 rounded bg-zinc-200 dark:bg-zinc-800" />
              </div>
            ))}
          </div>
        ) : threads.length === 0 ? (
          <div className="mt-6 border-y border-zinc-300 py-9 text-center dark:border-zinc-800">
            <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">{archived ? "Nenhum assunto arquivado." : "Nenhum assunto por enquanto."}</p>
            <p className="mx-auto mt-1 max-w-sm text-sm leading-6 text-zinc-500">{archived ? "Os assuntos arquivados aparecerão aqui." : "Quando você enviar uma mensagem, a conversa ficará guardada aqui."}</p>
          </div>
        ) : (
          <div className="mt-6 border-y border-zinc-300 dark:border-zinc-800">
            {threads.map((thread) => {
              const isSelected = selected === thread._id
              const detailsId = `thread-${thread._id}`
              return (
                <article id={thread._id} key={thread._id} className="border-b border-zinc-300 last:border-b-0 dark:border-zinc-800">
                  <button
                    type="button"
                    onClick={() => void openThread(thread._id)}
                    aria-expanded={isSelected}
                    aria-controls={detailsId}
                    className="group flex min-h-20 w-full items-center gap-3 px-1 py-4 text-left outline-none transition-colors hover:bg-zinc-200/40 focus-visible:bg-zinc-200/40 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-zinc-500 dark:hover:bg-white/[0.04] dark:focus-visible:bg-white/[0.04] dark:focus-visible:ring-zinc-400"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="truncate text-[15px] font-semibold text-zinc-950 dark:text-zinc-100">{thread.subject}</span>
                        <span className="shrink-0 rounded-full bg-zinc-200 px-2 py-0.5 text-[11px] text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">{messageCategoryLabel(thread.category)}</span>
                      </span>
                      {thread.lastMessage && <span className="mt-1.5 block truncate text-sm text-zinc-500">{thread.lastMessage.body}</span>}
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="flex items-center justify-end gap-1.5 text-[11px] font-medium text-zinc-600 dark:text-zinc-400">
                        <span aria-hidden className={`size-1.5 rounded-full ${thread.status === "open" ? "bg-amber-500" : thread.status === "closed" ? "bg-zinc-400" : "bg-emerald-600 dark:bg-emerald-500"}`} />
                        {STATUS_LABELS[thread.status] ?? thread.status}
                      </span>
                      <time className="mt-1.5 block text-[11px] tabular-nums text-zinc-500" dateTime={thread.updatedAt}>{formatDate(thread.updatedAt)}</time>
                    </span>
                    <ChevronDownIcon aria-hidden className={`size-4 shrink-0 text-zinc-400 transition-transform duration-200 motion-reduce:transition-none ${isSelected ? "rotate-180" : ""}`} />
                  </button>

                  {isSelected && (
                    <div id={detailsId} className="border-t border-zinc-200 px-1 pb-5 dark:border-zinc-800">
                      {loadingThread === thread._id ? (
                        <div className="py-6 text-sm text-zinc-500" role="status">Carregando conversa…</div>
                      ) : (
                        <>
                          <ol className="divide-y divide-zinc-200 dark:divide-zinc-800">
                            {thread.entries?.map((entry) => (
                              <li key={entry._id} className="py-5 first:pt-5">
                                <div className="flex items-baseline justify-between gap-3 text-xs text-zinc-500">
                                  <strong className="font-semibold text-zinc-800 dark:text-zinc-200">{entry.isOwn ? "Você" : entry.authorName}</strong>
                                  <span className="shrink-0">
                                    <time dateTime={entry.createdAt}>{formatDate(entry.createdAt)}</time>
                                    {entry.isOwn && <span className="ml-2">· {entry.readAt ? "Lido" : "Não lido"}</span>}
                                  </span>
                                </div>
                                <p className="mt-2 whitespace-pre-wrap text-[15px] leading-7 text-zinc-800 dark:text-zinc-200">{entry.body}</p>
                              </li>
                            ))}
                          </ol>

                          {thread.status === "closed" ? (
                            <p className="border-t border-zinc-200 py-5 text-sm text-zinc-500 dark:border-zinc-800">Este assunto foi encerrado.</p>
                          ) : (
                            <div className="border-t border-zinc-200 pt-5 dark:border-zinc-800">
                              <label htmlFor={`reply-${thread._id}`} className="text-sm font-medium">Continuar conversa</label>
                              <textarea
                                id={`reply-${thread._id}`}
                                value={reply[thread._id] ?? ""}
                                onChange={(event) => setReply((current) => ({ ...current, [thread._id]: event.target.value }))}
                                rows={3}
                                maxLength={5000}
                                className={`${FIELD_CLASS_NAME} mt-2 resize-y text-sm leading-6`}
                                placeholder="Acrescentar algo…"
                              />
                              <div className="mt-3 flex justify-end">
                                <button
                                  type="button"
                                  disabled={isBusy || !reply[thread._id]?.trim() || !thread.entries}
                                  onClick={() => void answer(thread._id)}
                                  className={SECONDARY_BUTTON_CLASS_NAME}
                                >
                                  {pendingAction === `reply:${thread._id}` ? "Enviando…" : "Responder"}
                                </button>
                              </div>
                            </div>
                          )}

                          <div className="mt-4 flex justify-end">
                            <DeleteActionMenu
                              title={`Excluir “${thread.subject}”?`}
                              description="O assunto e todas as respostas serão apagados permanentemente."
                              onDelete={() => deleteThread(thread._id)}
                              disabled={isBusy}
                              triggerLabel="Excluir assunto"
                              triggerVariant="text"
                              triggerClassName="inline-flex min-h-11 items-center gap-1 rounded-md px-2 text-xs font-medium text-red-700 outline-none transition-colors hover:bg-red-50 focus-visible:ring-2 focus-visible:ring-red-600 disabled:opacity-40 dark:text-red-400 dark:hover:bg-red-500/10"
                            />
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </article>
              )
            })}
          </div>
        )}

        {hasMore && (
          <button type="button" disabled={isBusy} onClick={() => void loadMore()} className={`${SECONDARY_BUTTON_CLASS_NAME} mt-6 w-full`}>
            {pendingAction === "load-more" ? "Carregando…" : "Carregar assuntos anteriores"}
          </button>
        )}
      </section>
    </div>
  )
}
