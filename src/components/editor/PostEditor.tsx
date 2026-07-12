"use client"

import Link from "next/link"
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react"
import type { LexicalEditor as LexicalEditorInstance } from "lexical"
import {
  POST_LOCALES,
  POST_LOCALE_DETAILS,
  isTranslationRevisionStale,
  type PostLocale,
  type TranslationLocale,
} from "@/lib/post-locales"
import { LexicalEditor, readMarkdownFromEditor } from "./LexicalEditor"

type CoAuthorOption = {
  id: string
  name: string
  imageUrl: string | null
}

type LocalizedDraft = {
  title: string
  subtitle: string
  excerpt: string
  coverAlt: string
  tags: string
  content: string
}

type StoredTranslation = Partial<Omit<LocalizedDraft, "tags">> & {
  title: string
  content: string
  tags?: string[]
  published: boolean
  publishedAt?: string
  sourceUpdatedAt: string
  updatedAt: string
}

type PostData = {
  id?: string
  title: string
  content: string
  slug: string
  excerpt?: string
  subtitle?: string
  tags: string[]
  style: "standard" | "editorial" | "opinion"
  cover?: { url: string; alt?: string }
  showCoverInTimeline?: boolean
  hiddenFromTimeline?: boolean
  friendImage?: string
  coAuthorUserId?: string | null
  audioUrl?: string
  published?: boolean
  publishedAt?: string
  originalContentUpdatedAt?: string
  translations?: Partial<Record<TranslationLocale, StoredTranslation>>
}

type Props = {
  post?: PostData
}

type VersionState = {
  exists: boolean
  published: boolean
  publishedAt?: string
  sourceUpdatedAt?: string
  updatedAt?: string
}

type VersionStates = Record<PostLocale, VersionState>

function slugify(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
}

function emptyDraft(): LocalizedDraft {
  return { title: "", subtitle: "", excerpt: "", coverAlt: "", tags: "", content: "" }
}

function initialDrafts(post?: PostData): Record<PostLocale, LocalizedDraft> {
  const drafts: Record<PostLocale, LocalizedDraft> = {
    pt: {
      title: post?.title ?? "",
      subtitle: post?.subtitle ?? "",
      excerpt: post?.excerpt ?? "",
      coverAlt: post?.cover?.alt ?? "",
      tags: post?.tags.join(", ") ?? "",
      content: post?.content ?? "",
    },
    en: emptyDraft(),
    de: emptyDraft(),
    id: emptyDraft(),
  }

  for (const locale of ["en", "de", "id"] as const) {
    const translation = post?.translations?.[locale]
    if (!translation) continue
    drafts[locale] = {
      title: translation.title,
      subtitle: translation.subtitle ?? "",
      excerpt: translation.excerpt ?? "",
      coverAlt: translation.coverAlt ?? "",
      tags: translation.tags?.join(", ") ?? "",
      content: translation.content,
    }
  }

  return drafts
}

function initialVersionStates(post?: PostData): VersionStates {
  const states: VersionStates = {
    pt: {
      exists: Boolean(post?.id),
      published: post?.published === true,
      publishedAt: post?.publishedAt,
      updatedAt: post?.originalContentUpdatedAt,
    },
    en: { exists: false, published: false },
    de: { exists: false, published: false },
    id: { exists: false, published: false },
  }

  for (const locale of ["en", "de", "id"] as const) {
    const translation = post?.translations?.[locale]
    if (!translation) continue
    states[locale] = {
      exists: true,
      published: translation.published,
      publishedAt: translation.publishedAt,
      sourceUpdatedAt: translation.sourceUpdatedAt,
      updatedAt: translation.updatedAt,
    }
  }

  return states
}

function draftsMatch(left: LocalizedDraft, right: LocalizedDraft): boolean {
  return left.title === right.title &&
    left.subtitle === right.subtitle &&
    left.excerpt === right.excerpt &&
    left.coverAlt === right.coverAlt &&
    left.tags === right.tags &&
    left.content === right.content
}

const FIELD_CLASS_NAME = "min-h-10 rounded border border-neutral-300 bg-transparent px-3 py-2 text-sm text-neutral-950 placeholder:text-neutral-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500/60 dark:border-neutral-700 dark:text-neutral-100 dark:placeholder:text-neutral-400 dark:focus-visible:ring-neutral-300/70"
const LABEL_CLASS_NAME = "text-xs font-medium text-neutral-600 dark:text-neutral-400"
const ACCEPTED_COVER_TYPES = new Set(["image/jpeg", "image/png", "image/webp"])

export function PostEditor({ post }: Props) {
  const [postId, setPostId] = useState(post?.id)
  const [activeLocale, setActiveLocale] = useState<PostLocale>("pt")
  const [drafts, setDrafts] = useState<Record<PostLocale, LocalizedDraft>>(() => initialDrafts(post))
  const [savedDrafts, setSavedDrafts] = useState<Record<PostLocale, LocalizedDraft>>(() => initialDrafts(post))
  const [versions, setVersions] = useState<VersionStates>(() => initialVersionStates(post))
  const [originalContentUpdatedAt, setOriginalContentUpdatedAt] = useState(post?.originalContentUpdatedAt)

  const [slug, setSlug] = useState(post?.slug ?? "")
  const [slugEdited, setSlugEdited] = useState(Boolean(post?.id))
  const [style, setStyle] = useState<PostData["style"]>(post?.style ?? "standard")
  const [visibleInTimeline, setVisibleInTimeline] = useState(post?.hiddenFromTimeline !== true)
  const [coverUrl, setCoverUrl] = useState(post?.cover?.url ?? "")
  const [showCoverInTimeline, setShowCoverInTimeline] = useState(post?.showCoverInTimeline ?? true)
  const [friendImage, setFriendImage] = useState(post?.friendImage ?? "")
  const [coAuthorUserId, setCoAuthorUserId] = useState(post?.coAuthorUserId ?? "")
  const [coAuthors, setCoAuthors] = useState<CoAuthorOption[]>([])
  const [loadingCoAuthors, setLoadingCoAuthors] = useState(true)
  const [coAuthorsError, setCoAuthorsError] = useState("")
  const [audioUrl, setAudioUrl] = useState(post?.audioUrl ?? "")
  const [saving, setSaving] = useState(false)
  const [uploadingCover, setUploadingCover] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")

  const initialSharedSignature = useMemo(() => JSON.stringify({
    slug: post?.slug ?? "",
    style: post?.style ?? "standard",
    visibleInTimeline: post?.hiddenFromTimeline !== true,
    coverUrl: post?.cover?.url ?? "",
    showCoverInTimeline: post?.showCoverInTimeline ?? true,
    friendImage: post?.friendImage ?? "",
    coAuthorUserId: post?.coAuthorUserId ?? "",
    audioUrl: post?.audioUrl ?? "",
  }), [post])
  const [savedSharedSignature, setSavedSharedSignature] = useState(initialSharedSignature)

  const fieldId = useId()
  const coverFileRef = useRef<HTMLInputElement>(null)
  const titleRef = useRef<HTMLInputElement>(null)
  const errorRef = useRef<HTMLParagraphElement>(null)
  const editorRef = useRef<LexicalEditorInstance | null>(null)

  const activeDraft = drafts[activeLocale]
  const currentSharedSignature = JSON.stringify({
    slug,
    style,
    visibleInTimeline,
    coverUrl,
    showCoverInTimeline,
    friendImage,
    coAuthorUserId,
    audioUrl,
  })

  const dirtyLocales = useMemo(() => new Set(POST_LOCALES.filter((locale) => (
    !draftsMatch(drafts[locale], savedDrafts[locale]) ||
    (locale === "pt" && currentSharedSignature !== savedSharedSignature)
  ))), [currentSharedSignature, drafts, savedDrafts, savedSharedSignature])
  const hasUnsavedChanges = dirtyLocales.size > 0

  function updateDraft(locale: PostLocale, patch: Partial<LocalizedDraft>) {
    setDrafts((current) => ({
      ...current,
      [locale]: { ...current[locale], ...patch },
    }))
    setNotice("")
  }

  function updateActiveDraft(patch: Partial<LocalizedDraft>) {
    updateDraft(activeLocale, patch)
  }

  function handleTitleChange(value: string) {
    updateActiveDraft({ title: value })
    if (activeLocale === "pt" && !slugEdited) setSlug(slugify(value))
  }

  const handleContentChange = useCallback((markdown: string) => {
    setDrafts((current) => ({
      ...current,
      [activeLocale]: { ...current[activeLocale], content: markdown },
    }))
    setNotice("")
  }, [activeLocale])

  function readCurrentDraft(): LocalizedDraft {
    const content = editorRef.current
      ? readMarkdownFromEditor(editorRef.current)
      : drafts[activeLocale].content
    const next = { ...drafts[activeLocale], content }
    setDrafts((current) => ({ ...current, [activeLocale]: next }))
    return next
  }

  function selectLocale(locale: PostLocale) {
    if (locale === activeLocale) return
    readCurrentDraft()
    setActiveLocale(locale)
    setError("")
    setNotice("")
  }

  useEffect(() => {
    if (!hasUnsavedChanges) return
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = true
    }
    window.addEventListener("beforeunload", warnBeforeUnload)
    return () => window.removeEventListener("beforeunload", warnBeforeUnload)
  }, [hasUnsavedChanges])

  useEffect(() => {
    const controller = new AbortController()

    async function loadCoAuthors() {
      setLoadingCoAuthors(true)
      setCoAuthorsError("")
      try {
        const response = await fetch("/api/admin/users", { signal: controller.signal })
        if (!response.ok) throw new Error("Não foi possível carregar os coautores.")

        const data = await response.json() as { users?: CoAuthorOption[] }
        if (!controller.signal.aborted) setCoAuthors(Array.isArray(data.users) ? data.users : [])
      } catch {
        if (!controller.signal.aborted) {
          setCoAuthors([])
          setCoAuthorsError("Não foi possível carregar os coautores.")
        }
      } finally {
        if (!controller.signal.aborted) setLoadingCoAuthors(false)
      }
    }

    void loadCoAuthors()
    return () => controller.abort()
  }, [])

  useEffect(() => {
    if (error) errorRef.current?.focus()
  }, [error])

  function handleCoAuthorChange(value: string) {
    setCoAuthorUserId(value)
    const user = coAuthors.find((item) => item.id === value)
    setFriendImage(user?.imageUrl ?? "")
    setNotice("")
  }

  async function uploadCover(file: File) {
    if (!ACCEPTED_COVER_TYPES.has(file.type)) {
      setError("Selecione um arquivo de imagem válido.")
      if (coverFileRef.current) coverFileRef.current.value = ""
      return
    }
    if (file.size > 4 * 1024 * 1024) {
      setError("A imagem deve ter no máximo 4 MB.")
      if (coverFileRef.current) coverFileRef.current.value = ""
      return
    }

    setUploadingCover(true)
    setError("")
    try {
      const form = new FormData()
      form.append("file", file)
      const res = await fetch("/api/admin/media", { method: "POST", body: form })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.url) throw new Error(data?.error ?? "Erro ao enviar imagem.")
      setCoverUrl(data.url)
      if (!drafts.pt.coverAlt) updateDraft("pt", { coverAlt: drafts.pt.title })
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Erro ao enviar imagem.")
    } finally {
      setUploadingCover(false)
      if (coverFileRef.current) coverFileRef.current.value = ""
    }
  }

  async function save(published?: boolean) {
    if (saving) return
    const locale = activeLocale
    const draft = readCurrentDraft()

    if (!draft.title.trim() || !draft.content.trim() || (locale === "pt" && !slug.trim())) {
      setError(locale === "pt"
        ? "Título, slug e conteúdo são obrigatórios."
        : "Título e conteúdo são obrigatórios para salvar a tradução.")
      if (!draft.title.trim()) requestAnimationFrame(() => titleRef.current?.focus())
      return
    }
    if (locale !== "pt" && !postId) {
      setError("Salve primeiro a versão original em português. Seu rascunho desta tradução foi mantido.")
      return
    }

    setSaving(true)
    setError("")
    setNotice("")

    const localizedBody = {
      locale,
      title: draft.title,
      subtitle: draft.subtitle.trim() || null,
      excerpt: draft.excerpt.trim() || null,
      coverAlt: draft.coverAlt.trim() || null,
      tags: draft.tags.split(",").map((tag) => tag.trim()).filter(Boolean),
      content: draft.content,
    }
    const body = locale === "pt" ? {
      ...localizedBody,
      slug,
      style,
      hiddenFromTimeline: !visibleInTimeline,
      cover: coverUrl.trim() ? { url: coverUrl.trim(), alt: draft.coverAlt || draft.title } : null,
      showCoverInTimeline: Boolean(coverUrl.trim()) && showCoverInTimeline,
      friendImage: friendImage.trim() || undefined,
      coAuthorUserId: coAuthorUserId.trim() || null,
      audioUrl: audioUrl.trim() || undefined,
    } : localizedBody

    try {
      const creating = !postId
      const res = await fetch(creating ? "/api/admin/posts" : `/api/admin/posts/${postId}`, {
        method: creating ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(published === undefined ? body : { ...body, published }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error ?? "Erro ao salvar.")

      if (locale === "pt") {
        const nextId = postId ?? data?._id
        if (!nextId) throw new Error("O post foi salvo, mas o identificador não foi retornado.")
        if (!postId) {
          setPostId(nextId)
          window.history.replaceState(null, "", `/admin/posts/${nextId}/edit`)
        }

        const nextOriginalUpdatedAt = data?.originalContentUpdatedAt ?? originalContentUpdatedAt
        setOriginalContentUpdatedAt(nextOriginalUpdatedAt)
        setVersions((current) => ({
          ...current,
          pt: {
            exists: true,
            published: data?.published === true,
            publishedAt: data?.publishedAt,
            updatedAt: nextOriginalUpdatedAt,
          },
        }))
        setSavedSharedSignature(currentSharedSignature)
      } else {
        const translation = data?.translation as StoredTranslation | undefined
        if (!translation) throw new Error("A tradução foi salva, mas seu estado não foi retornado.")
        setVersions((current) => ({
          ...current,
          [locale]: {
            exists: true,
            published: translation.published,
            publishedAt: translation.publishedAt,
            sourceUpdatedAt: translation.sourceUpdatedAt,
            updatedAt: translation.updatedAt,
          },
        }))
      }

      setSavedDrafts((current) => ({ ...current, [locale]: draft }))
      setNotice(`${POST_LOCALE_DETAILS[locale].adminLabel}: versão salva com sucesso.`)
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Erro ao salvar.")
    } finally {
      setSaving(false)
    }
  }

  function localeStatus(locale: PostLocale) {
    const version = versions[locale]
    const dirty = dirtyLocales.has(locale)
    if (!version.exists) {
      return {
        label: locale === "pt" ? "Novo rascunho" : "Sem tradução",
        dot: "bg-neutral-400",
        dirty,
      }
    }

    const stale = locale !== "pt" && version.exists && version.sourceUpdatedAt && originalContentUpdatedAt
      ? isTranslationRevisionStale(version.sourceUpdatedAt, originalContentUpdatedAt)
      : false
    return {
      label: stale
        ? `${version.published ? "Publicado" : "Rascunho"} · revisão pendente`
        : version.published ? "Publicado" : "Rascunho",
      dot: stale ? "bg-orange-500" : version.published ? "bg-emerald-500" : "bg-amber-500",
      dirty,
    }
  }

  const activeVersion = versions[activeLocale]
  const activeStatus = localeStatus(activeLocale)
  const translationBlocked = activeLocale !== "pt" && !postId

  return (
    <div className="flex w-full max-w-4xl flex-col gap-6" aria-busy={saving || uploadingCover}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link href="/admin/posts" className="text-xs text-neutral-500 hover:text-neutral-950 dark:hover:text-neutral-100">
            ← Voltar para posts
          </Link>
          <h1 className="mt-1 text-lg font-semibold">{postId ? "Editar post" : "Novo post"}</h1>
          <p className="mt-0.5 text-sm text-neutral-500">
            Editando em <span className="font-medium text-neutral-800 dark:text-neutral-200">{POST_LOCALE_DETAILS[activeLocale].adminLabel}</span>
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving || translationBlocked}
            className="min-h-10 rounded-lg border border-neutral-300 px-3 py-2 text-sm hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-neutral-700 dark:hover:bg-neutral-800 dark:focus-visible:ring-neutral-300"
          >
            {activeVersion.exists ? "Salvar alterações" : "Salvar rascunho"}
          </button>
          <button
            type="button"
            onClick={() => void save(!activeVersion.published)}
            disabled={saving || translationBlocked}
            className={activeVersion.published
              ? "min-h-10 rounded-lg px-3 py-2 text-sm text-red-700 hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 disabled:cursor-not-allowed disabled:opacity-50 dark:text-red-300 dark:hover:bg-red-950/30"
              : "min-h-10 rounded-lg bg-neutral-900 px-3 py-2 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-neutral-900 dark:focus-visible:ring-neutral-300 dark:focus-visible:ring-offset-black"}
          >
            {activeVersion.published ? "Despublicar" : "Publicar"}
          </button>
        </div>
      </div>

      <div role="tablist" aria-label="Idioma da versão" className="grid grid-cols-2 border-y border-neutral-200 dark:border-neutral-800 sm:grid-cols-4">
        {POST_LOCALES.map((locale) => {
          const details = POST_LOCALE_DETAILS[locale]
          const status = localeStatus(locale)
          const selected = locale === activeLocale
          return (
            <button
              key={locale}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`${fieldId}-localized-editor`}
              onClick={() => selectLocale(locale)}
              className={[
                "relative flex min-h-16 flex-col items-start justify-center px-3 py-2 text-left focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-neutral-500",
                selected ? "bg-neutral-100 dark:bg-white/[0.07]" : "hover:bg-neutral-50 dark:hover:bg-white/[0.04]",
              ].join(" ")}
            >
              <span className="flex w-full items-center justify-between gap-2 text-sm font-medium">
                <span>{details.shortLabel} · {details.adminLabel}</span>
                {status.dirty && <span className="size-1.5 shrink-0 rounded-full bg-sky-500" title="Alterações não salvas" />}
              </span>
              <span className="mt-1 flex items-center gap-1.5 text-[11px] text-neutral-500 dark:text-neutral-400">
                <span className={`size-1.5 shrink-0 rounded-full ${status.dot}`} aria-hidden />
                {status.label}
              </span>
              {selected && <span className="absolute inset-x-3 bottom-0 h-0.5 bg-neutral-950 dark:bg-white" aria-hidden />}
            </button>
          )
        })}
      </div>

      {error && (
        <p ref={errorRef} role="alert" tabIndex={-1} className="text-sm text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 dark:text-red-300">
          {error}
        </p>
      )}
      <p aria-live="polite" className="min-h-5 text-sm text-emerald-700 dark:text-emerald-300">
        {notice}
      </p>

      {translationBlocked && (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
          Você pode preparar esta tradução agora. Para salvá-la, volte ao português e salve primeiro o texto original.
        </p>
      )}
      {activeLocale !== "pt" && activeStatus.label.includes("revisão pendente") && (
        <p className="rounded-md bg-orange-50 px-3 py-2 text-sm text-orange-900 dark:bg-orange-950/30 dark:text-orange-200">
          O texto original mudou depois da última revisão desta versão. A tradução continua {activeVersion.published ? "publicada" : "em rascunho"} até você decidir alterá-la.
        </p>
      )}

      <div id={`${fieldId}-localized-editor`} role="tabpanel" className="flex flex-col gap-5">
        <div>
          <label htmlFor={`${fieldId}-${activeLocale}-title`} className="sr-only">Título em {POST_LOCALE_DETAILS[activeLocale].adminLabel}</label>
          <input
            ref={titleRef}
            id={`${fieldId}-${activeLocale}-title`}
            value={activeDraft.title}
            onChange={(event) => handleTitleChange(event.target.value)}
            placeholder={`Título em ${POST_LOCALE_DETAILS[activeLocale].adminLabel.toLowerCase()}`}
            required
            aria-invalid={Boolean(error && !activeDraft.title.trim())}
            className="w-full border-b border-neutral-300 bg-transparent pb-2 text-2xl font-semibold text-neutral-950 placeholder:text-neutral-500 focus-visible:border-neutral-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500/60 dark:border-neutral-700 dark:text-neutral-100 dark:placeholder:text-neutral-400 dark:focus-visible:border-neutral-400 dark:focus-visible:ring-neutral-300/70"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label htmlFor={`${fieldId}-${activeLocale}-subtitle`} className={LABEL_CLASS_NAME}>Descrição</label>
            <textarea
              id={`${fieldId}-${activeLocale}-subtitle`}
              value={activeDraft.subtitle}
              onChange={(event) => updateActiveDraft({ subtitle: event.target.value })}
              rows={3}
              placeholder="Exibida abaixo do título"
              className={`${FIELD_CLASS_NAME} resize-y`}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor={`${fieldId}-${activeLocale}-excerpt`} className={LABEL_CLASS_NAME}>Resumo</label>
            <textarea
              id={`${fieldId}-${activeLocale}-excerpt`}
              value={activeDraft.excerpt}
              onChange={(event) => updateActiveDraft({ excerpt: event.target.value })}
              rows={3}
              placeholder="Usado em listagens e metadados"
              className={`${FIELD_CLASS_NAME} resize-y`}
            />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor={`${fieldId}-${activeLocale}-tags`} className={LABEL_CLASS_NAME}>Tags (separadas por vírgula)</label>
          <input
            id={`${fieldId}-${activeLocale}-tags`}
            value={activeDraft.tags}
            onChange={(event) => updateActiveDraft({ tags: event.target.value })}
            placeholder={`Tags em ${POST_LOCALE_DETAILS[activeLocale].adminLabel.toLowerCase()}`}
            className={FIELD_CLASS_NAME}
          />
        </div>

        {coverUrl.trim() && (
          <div className="flex flex-col gap-1">
            <label htmlFor={`${fieldId}-${activeLocale}-cover-alt`} className={LABEL_CLASS_NAME}>Texto alternativo da capa</label>
            <input
              id={`${fieldId}-${activeLocale}-cover-alt`}
              value={activeDraft.coverAlt}
              onChange={(event) => updateActiveDraft({ coverAlt: event.target.value })}
              placeholder={`Descrição da imagem em ${POST_LOCALE_DETAILS[activeLocale].adminLabel.toLowerCase()}`}
              className={FIELD_CLASS_NAME}
            />
          </div>
        )}

        {activeLocale === "pt" && (
          <section className="flex flex-col gap-4 border-t border-neutral-200 pt-5 dark:border-neutral-800" aria-labelledby={`${fieldId}-settings-title`}>
            <div>
              <h2 id={`${fieldId}-settings-title`} className="text-sm font-semibold">Configurações do post</h2>
              <p className="mt-0.5 text-xs text-neutral-500">Estas opções são compartilhadas por todos os idiomas.</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1">
                <label htmlFor={`${fieldId}-slug`} className={LABEL_CLASS_NAME}>Slug</label>
                <input
                  id={`${fieldId}-slug`}
                  value={slug}
                  onChange={(event) => { setSlug(event.target.value); setSlugEdited(true); setNotice("") }}
                  required
                  aria-invalid={Boolean(error && !slug.trim())}
                  className={FIELD_CLASS_NAME}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor={`${fieldId}-style`} className={LABEL_CLASS_NAME}>Estilo</label>
                <select id={`${fieldId}-style`} value={style} onChange={(event) => { setStyle(event.target.value as PostData["style"]); setNotice("") }} className={FIELD_CLASS_NAME}>
                  <option value="standard">Standard</option>
                  <option value="editorial">Editorial</option>
                  <option value="opinion">Opinion</option>
                </select>
              </div>
              <label className="flex items-center gap-2 rounded border border-neutral-200 px-2 py-1 text-sm text-neutral-700 dark:border-neutral-700 dark:text-neutral-300">
                <input
                  type="checkbox"
                  checked={visibleInTimeline}
                  onChange={(event) => { setVisibleInTimeline(event.target.checked); setNotice("") }}
                  className="size-5 rounded border-neutral-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500 dark:focus-visible:ring-neutral-300"
                />
                Aparecer na timeline
              </label>
            </div>

            <div className="grid gap-3 rounded-xl border border-neutral-200 p-3 dark:border-neutral-800">
              <div className="flex flex-col gap-1">
                <label htmlFor={`${fieldId}-co-author`} className={LABEL_CLASS_NAME}>Coautor</label>
                <select
                  id={`${fieldId}-co-author`}
                  value={coAuthorUserId}
                  onChange={(event) => handleCoAuthorChange(event.target.value)}
                  disabled={loadingCoAuthors}
                  aria-describedby={`${fieldId}-co-author-hint`}
                  className={`${FIELD_CLASS_NAME} disabled:cursor-wait disabled:opacity-60`}
                >
                  <option value="">Sem coautor</option>
                  {coAuthors.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
                </select>
                <span id={`${fieldId}-co-author-hint`} role="status" className="text-xs text-neutral-600 dark:text-neutral-400">
                  {loadingCoAuthors ? "Carregando usuários..." : coAuthorsError || "Usado pelo token @co-autor no texto."}
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor={`${fieldId}-friend-image`} className={LABEL_CLASS_NAME}>Imagem do coautor</label>
                <input id={`${fieldId}-friend-image`} type="url" value={friendImage} onChange={(event) => { setFriendImage(event.target.value); setNotice("") }} placeholder="https://..." className={FIELD_CLASS_NAME} />
              </div>
            </div>

            <div className="grid gap-3 rounded-xl border border-neutral-200 p-3 dark:border-neutral-800">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <h3 className={LABEL_CLASS_NAME}>Capa / asset de imagem</h3>
                <button
                  type="button"
                  onClick={() => coverFileRef.current?.click()}
                  disabled={uploadingCover}
                  aria-controls={`${fieldId}-cover-file`}
                  className="min-h-10 rounded border border-neutral-300 px-3 py-2 text-xs hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500 disabled:cursor-wait disabled:opacity-50 dark:border-neutral-700 dark:hover:bg-neutral-800 dark:focus-visible:ring-neutral-300"
                >
                  {uploadingCover ? "Enviando..." : "Enviar imagem"}
                </button>
              </div>
              <input ref={coverFileRef} id={`${fieldId}-cover-file`} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(event) => { if (event.target.files?.[0]) void uploadCover(event.target.files[0]) }} />
              <label htmlFor={`${fieldId}-cover-url`} className="sr-only">URL da imagem de capa</label>
              <input id={`${fieldId}-cover-url`} type="url" value={coverUrl} onChange={(event) => { setCoverUrl(event.target.value); setNotice("") }} placeholder="URL da imagem de capa" className={FIELD_CLASS_NAME} />
              <label className="flex items-start gap-2 rounded-lg border border-neutral-200 px-3 py-2 text-sm text-neutral-700 dark:border-neutral-800 dark:text-neutral-300">
                <input
                  type="checkbox"
                  checked={showCoverInTimeline}
                  onChange={(event) => { setShowCoverInTimeline(event.target.checked); setNotice("") }}
                  disabled={!coverUrl.trim()}
                  className="mt-0.5 size-5 rounded border-neutral-300 text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500 disabled:opacity-50 dark:focus-visible:ring-neutral-300"
                />
                <span className="flex flex-col gap-0.5">
                  <span className="font-medium">Mostrar capa na timeline</span>
                  <span className="text-xs text-neutral-600 dark:text-neutral-400">A capa continua visível dentro do post quando esta opção está desligada.</span>
                </span>
              </label>
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor={`${fieldId}-audio-url`} className={LABEL_CLASS_NAME}>URL do áudio</label>
              <input id={`${fieldId}-audio-url`} type="url" value={audioUrl} onChange={(event) => { setAudioUrl(event.target.value); setNotice("") }} placeholder="https://..." className={FIELD_CLASS_NAME} />
            </div>
          </section>
        )}

        <div className="flex items-center justify-between gap-3">
          <h2 id={`${fieldId}-content-label`} className="text-sm font-semibold">Conteúdo em {POST_LOCALE_DETAILS[activeLocale].adminLabel}</h2>
          {dirtyLocales.has(activeLocale) && <span className="text-xs text-sky-700 dark:text-sky-300">Alterações não salvas</span>}
        </div>
        <div
          role="group"
          aria-labelledby={`${fieldId}-content-label`}
          className="overflow-hidden rounded-xl border border-neutral-200 focus-within:ring-2 focus-within:ring-neutral-500/60 dark:border-neutral-800 dark:focus-within:ring-neutral-300/70"
        >
          <LexicalEditor
            key={activeLocale}
            namespace={`PostEditor-${activeLocale}`}
            initialMarkdown={activeDraft.content}
            placeholder={`Escreva o conteúdo em ${POST_LOCALE_DETAILS[activeLocale].adminLabel.toLowerCase()}...`}
            onChange={handleContentChange}
            editorRef={editorRef}
          />
        </div>
      </div>
    </div>
  )
}
