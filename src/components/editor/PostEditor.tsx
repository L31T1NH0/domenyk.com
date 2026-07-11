"use client"

import { useState, useCallback, useEffect, useId, useRef } from "react"
import { useRouter } from "next/navigation"
import type { LexicalEditor as LexicalEditorInstance } from "lexical"
import { LexicalEditor, readMarkdownFromEditor } from "./LexicalEditor"

type CoAuthorOption = {
  id: string
  name: string
  imageUrl: string | null
}

type PostData = {
  id?: string
  title: string
  content: string
  slug: string
  excerpt?: string
  tags: string[]
  style: "standard" | "editorial" | "opinion"
  cover?: { url: string; alt?: string }
  showCoverInTimeline?: boolean
  hiddenFromTimeline?: boolean
  friendImage?: string
  coAuthorUserId?: string | null
  audioUrl?: string
}

type Props = {
  post?: PostData
}

function slugify(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
}

const FIELD_CLASS_NAME = "min-h-10 rounded border border-neutral-300 bg-transparent px-3 py-2 text-sm text-neutral-950 placeholder:text-neutral-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500/60 dark:border-neutral-700 dark:text-neutral-100 dark:placeholder:text-neutral-400 dark:focus-visible:ring-neutral-300/70"
const LABEL_CLASS_NAME = "text-xs font-medium text-neutral-600 dark:text-neutral-400"
const ACCEPTED_COVER_TYPES = new Set(["image/jpeg", "image/png", "image/webp"])

export function PostEditor({ post }: Props) {
  const router = useRouter()
  const isEditing = !!post?.id

  const [title, setTitle] = useState(post?.title ?? "")
  const [slug, setSlug] = useState(post?.slug ?? "")
  const [slugEdited, setSlugEdited] = useState(isEditing)
  const [excerpt, setExcerpt] = useState(post?.excerpt ?? "")
  const [tags, setTags] = useState(post?.tags.join(", ") ?? "")
  const [style, setStyle] = useState<PostData["style"]>(post?.style ?? "standard")
  const [visibleInTimeline, setVisibleInTimeline] = useState(post?.hiddenFromTimeline !== true)
  const [coverUrl, setCoverUrl] = useState(post?.cover?.url ?? "")
  const [coverAlt, setCoverAlt] = useState(post?.cover?.alt ?? "")
  const [showCoverInTimeline, setShowCoverInTimeline] = useState(post?.showCoverInTimeline ?? true)
  const [friendImage, setFriendImage] = useState(post?.friendImage ?? "")
  const [coAuthorUserId, setCoAuthorUserId] = useState(post?.coAuthorUserId ?? "")
  const [coAuthors, setCoAuthors] = useState<CoAuthorOption[]>([])
  const [loadingCoAuthors, setLoadingCoAuthors] = useState(true)
  const [coAuthorsError, setCoAuthorsError] = useState("")
  const [audioUrl, setAudioUrl] = useState(post?.audioUrl ?? "")
  const [content, setContent] = useState(post?.content ?? "")
  const [saving, setSaving] = useState(false)
  const [uploadingCover, setUploadingCover] = useState(false)
  const [error, setError] = useState("")
  const fieldId = useId()
  const coverFileRef = useRef<HTMLInputElement>(null)
  const titleRef = useRef<HTMLInputElement>(null)
  const errorRef = useRef<HTMLParagraphElement>(null)
  const editorRef = useRef<LexicalEditorInstance | null>(null)

  function handleTitleChange(value: string) {
    setTitle(value)
    if (!slugEdited) setSlug(slugify(value))
  }

  const handleContentChange = useCallback((markdown: string) => {
    setContent(markdown)
  }, [])

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

    return () => {
      controller.abort()
    }
  }, [])

  useEffect(() => {
    if (error) errorRef.current?.focus()
  }, [error])

  function handleCoAuthorChange(value: string) {
    setCoAuthorUserId(value)
    const user = coAuthors.find((item) => item.id === value)
    setFriendImage(user?.imageUrl ?? "")
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
      if (!coverAlt) setCoverAlt(title)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao enviar imagem.")
    } finally {
      setUploadingCover(false)
      if (coverFileRef.current) coverFileRef.current.value = ""
    }
  }

  async function save(publish?: boolean) {
    if (saving) return
    const latestContent = editorRef.current ? readMarkdownFromEditor(editorRef.current) : content

    if (!title.trim() || !slug.trim() || !latestContent.trim()) {
      setError("Título, slug e conteúdo são obrigatórios.")
      if (!title.trim()) requestAnimationFrame(() => titleRef.current?.focus())
      return
    }

    setSaving(true)
    setError("")

    const body = {
      title,
      slug,
      content: latestContent,
      excerpt: excerpt || undefined,
      tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
      style,
      hiddenFromTimeline: !visibleInTimeline,
      cover: coverUrl.trim() ? { url: coverUrl.trim(), alt: coverAlt || title } : null,
      showCoverInTimeline: Boolean(coverUrl.trim()) && showCoverInTimeline,
      friendImage: friendImage.trim() || undefined,
      coAuthorUserId: coAuthorUserId.trim() || null,
      audioUrl: audioUrl.trim() || undefined,
    }

    setContent(latestContent)

    try {
      const res = await fetch(isEditing ? `/api/admin/posts/${post!.id}` : "/api/admin/posts", {
        method: isEditing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(publish !== undefined ? { ...body, published: publish } : body),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error ?? "Erro ao salvar.")
      }

      router.push("/admin/posts")
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Erro ao salvar.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex w-full max-w-3xl flex-col gap-6" aria-busy={saving || uploadingCover}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-lg font-semibold">{isEditing ? "Editar post" : "Novo post"}</h1>
        <div className="flex flex-col gap-2 sm:flex-row">
          {!isEditing && (
            <button
              type="button"
              onClick={() => save()}
              disabled={saving}
              className="min-h-10 rounded-lg border border-neutral-300 px-3 py-2 text-sm hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500 disabled:cursor-wait disabled:opacity-50 dark:border-neutral-700 dark:hover:bg-neutral-800 dark:focus-visible:ring-neutral-300"
            >
              Salvar rascunho
            </button>
          )}
          <button
            type="button"
            onClick={() => save(isEditing ? undefined : true)}
            disabled={saving}
            className="min-h-10 rounded-lg bg-neutral-900 px-3 py-2 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500 focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-50 dark:bg-white dark:text-neutral-900 dark:focus-visible:ring-neutral-300 dark:focus-visible:ring-offset-black"
          >
            {isEditing ? "Aplicar edições" : "Publicar"}
          </button>
        </div>
      </div>

      {error && (
        <p
          ref={errorRef}
          role="alert"
          tabIndex={-1}
          className="rounded-md text-sm text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 dark:text-red-300"
        >
          {error}
        </p>
      )}

      <div className="flex flex-col gap-4">
        <label htmlFor={`${fieldId}-title`} className="sr-only">Título</label>
        <input
          ref={titleRef}
          id={`${fieldId}-title`}
          value={title}
          onChange={(e) => handleTitleChange(e.target.value)}
          placeholder="Título"
          required
          aria-invalid={Boolean(error && !title.trim())}
          className="w-full border-b border-neutral-300 bg-transparent pb-2 text-2xl font-semibold text-neutral-950 placeholder:text-neutral-500 focus-visible:border-neutral-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500/60 dark:border-neutral-700 dark:text-neutral-100 dark:placeholder:text-neutral-400 dark:focus-visible:border-neutral-400 dark:focus-visible:ring-neutral-300/70"
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label htmlFor={`${fieldId}-slug`} className={LABEL_CLASS_NAME}>Slug</label>
            <input
              id={`${fieldId}-slug`}
              value={slug}
              onChange={(e) => { setSlug(e.target.value); setSlugEdited(true) }}
              required
              aria-invalid={Boolean(error && !slug.trim())}
              className={FIELD_CLASS_NAME}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor={`${fieldId}-style`} className={LABEL_CLASS_NAME}>Estilo</label>
            <select
              id={`${fieldId}-style`}
              value={style}
              onChange={(e) => setStyle(e.target.value as PostData["style"])}
              className={FIELD_CLASS_NAME}
            >
              <option value="standard">Standard</option>
              <option value="editorial">Editorial</option>
              <option value="opinion">Opinion</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor={`${fieldId}-tags`} className={LABEL_CLASS_NAME}>Tags (separadas por vírgula)</label>
            <input
              id={`${fieldId}-tags`}
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              className={FIELD_CLASS_NAME}
            />
          </div>
          <label className="flex items-center gap-2 rounded border border-neutral-200 px-2 py-1 text-sm text-neutral-700 dark:border-neutral-700 dark:text-neutral-300">
            <input
              type="checkbox"
              checked={visibleInTimeline}
              onChange={(e) => setVisibleInTimeline(e.target.checked)}
              className="size-5 rounded border-neutral-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500 dark:focus-visible:ring-neutral-300"
            />
            Aparecer na timeline
          </label>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor={`${fieldId}-excerpt`} className={LABEL_CLASS_NAME}>Resumo (excerpt)</label>
          <textarea
            id={`${fieldId}-excerpt`}
            value={excerpt}
            onChange={(e) => setExcerpt(e.target.value)}
            rows={2}
            className={`${FIELD_CLASS_NAME} resize-y`}
          />
        </div>

        <div className="grid gap-3 rounded-xl border border-neutral-200 p-3 dark:border-neutral-800">
          <div className="flex flex-col gap-1">
            <label htmlFor={`${fieldId}-co-author`} className={LABEL_CLASS_NAME}>Coautor</label>
            <select
              id={`${fieldId}-co-author`}
              value={coAuthorUserId}
              onChange={(e) => handleCoAuthorChange(e.target.value)}
              disabled={loadingCoAuthors}
              aria-describedby={`${fieldId}-co-author-hint`}
              className={`${FIELD_CLASS_NAME} disabled:cursor-wait disabled:opacity-60`}
            >
              <option value="">Sem coautor</option>
              {coAuthors.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </select>
            <span id={`${fieldId}-co-author-hint`} role="status" className="text-xs text-neutral-600 dark:text-neutral-400">
              {loadingCoAuthors ? "Carregando usuários..." : coAuthorsError || "Usado pelo token @co-autor no texto."}
            </span>
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor={`${fieldId}-friend-image`} className={LABEL_CLASS_NAME}>Imagem do coautor</label>
            <input
              id={`${fieldId}-friend-image`}
              type="url"
              value={friendImage}
              onChange={(e) => setFriendImage(e.target.value)}
              placeholder="https://..."
              className={FIELD_CLASS_NAME}
            />
          </div>
        </div>

        <div className="grid gap-3 rounded-xl border border-neutral-200 p-3 dark:border-neutral-800">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h2 className={LABEL_CLASS_NAME}>Capa / asset de imagem</h2>
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
          <input
            ref={coverFileRef}
            id={`${fieldId}-cover-file`}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => { if (e.target.files?.[0]) uploadCover(e.target.files[0]) }}
          />
          <label htmlFor={`${fieldId}-cover-url`} className="sr-only">URL da imagem de capa</label>
          <input
            id={`${fieldId}-cover-url`}
            type="url"
            value={coverUrl}
            onChange={(e) => setCoverUrl(e.target.value)}
            placeholder="URL da imagem de capa"
            className={FIELD_CLASS_NAME}
          />
          <label htmlFor={`${fieldId}-cover-alt`} className="sr-only">Texto alternativo da imagem de capa</label>
          <input
            id={`${fieldId}-cover-alt`}
            value={coverAlt}
            onChange={(e) => setCoverAlt(e.target.value)}
            placeholder="Texto alternativo da capa"
            className={FIELD_CLASS_NAME}
          />
          <label className="flex items-start gap-2 rounded-lg border border-neutral-200 px-3 py-2 text-sm text-neutral-700 dark:border-neutral-800 dark:text-neutral-300">
            <input
              type="checkbox"
              checked={showCoverInTimeline}
              onChange={(e) => setShowCoverInTimeline(e.target.checked)}
              disabled={!coverUrl.trim()}
              className="mt-0.5 size-5 rounded border-neutral-300 text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500 disabled:opacity-50 dark:focus-visible:ring-neutral-300"
            />
            <span className="flex flex-col gap-0.5">
              <span className="font-medium">Mostrar capa na timeline</span>
              <span className="text-xs text-neutral-600 dark:text-neutral-400">
                A capa continua visível dentro do post mesmo quando esta opção está desligada.
              </span>
            </span>
          </label>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor={`${fieldId}-audio-url`} className={LABEL_CLASS_NAME}>URL do áudio</label>
          <input
            id={`${fieldId}-audio-url`}
            type="url"
            value={audioUrl}
            onChange={(e) => setAudioUrl(e.target.value)}
            placeholder="https://..."
            className={FIELD_CLASS_NAME}
          />
        </div>
      </div>

      <h2 id={`${fieldId}-content-label`} className="sr-only">Conteúdo do post</h2>
      <div
        role="group"
        aria-labelledby={`${fieldId}-content-label`}
        className="overflow-hidden rounded-xl border border-neutral-200 focus-within:ring-2 focus-within:ring-neutral-500/60 dark:border-neutral-800 dark:focus-within:ring-neutral-300/70"
      >
        <LexicalEditor initialMarkdown={content} onChange={handleContentChange} editorRef={editorRef} />
      </div>
    </div>
  )
}
