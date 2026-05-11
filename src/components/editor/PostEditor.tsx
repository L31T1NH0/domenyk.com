"use client"

import { useState, useCallback, useEffect, useRef } from "react"
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
  const [audioUrl, setAudioUrl] = useState(post?.audioUrl ?? "")
  const [content, setContent] = useState(post?.content ?? "")
  const [saving, setSaving] = useState(false)
  const [uploadingCover, setUploadingCover] = useState(false)
  const [error, setError] = useState("")
  const coverFileRef = useRef<HTMLInputElement>(null)
  const editorRef = useRef<LexicalEditorInstance | null>(null)

  function handleTitleChange(value: string) {
    setTitle(value)
    if (!slugEdited) setSlug(slugify(value))
  }

  const handleContentChange = useCallback((markdown: string) => {
    setContent(markdown)
  }, [])

  useEffect(() => {
    let cancelled = false

    fetch("/api/admin/users")
      .then((res) => res.ok ? res.json() : { users: [] })
      .then((data: { users?: CoAuthorOption[] }) => {
        if (!cancelled) setCoAuthors(data.users ?? [])
      })
      .catch(() => {
        if (!cancelled) setCoAuthors([])
      })
      .finally(() => {
        if (!cancelled) setLoadingCoAuthors(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  function handleCoAuthorChange(value: string) {
    setCoAuthorUserId(value)
    const user = coAuthors.find((item) => item.id === value)
    setFriendImage(user?.imageUrl ?? "")
  }

  async function uploadCover(file: File) {
    setUploadingCover(true)
    setError("")
    try {
      const form = new FormData()
      form.append("file", file)
      const res = await fetch("/api/admin/media", { method: "POST", body: form })
      const data = await res.json()
      if (!res.ok || !data.url) throw new Error(data.error ?? "Erro ao enviar imagem.")
      setCoverUrl(data.url)
      if (!coverAlt) setCoverAlt(title)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao enviar imagem.")
    } finally {
      setUploadingCover(false)
    }
  }

  async function save(publish?: boolean) {
    const latestContent = editorRef.current ? readMarkdownFromEditor(editorRef.current) : content

    if (!title || !slug || !latestContent) {
      setError("Título, slug e conteúdo são obrigatórios.")
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

    let res: Response
    if (isEditing) {
      res = await fetch(`/api/admin/posts/${post!.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(publish !== undefined ? { ...body, published: publish } : body),
      })
    } else {
      res = await fetch("/api/admin/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(publish !== undefined ? { ...body, published: publish } : body),
      })
    }

    if (res.ok) {
      router.push("/admin/posts")
    } else {
      const data = await res.json()
      setError(data.error ?? "Erro ao salvar.")
    }

    setSaving(false)
  }

  return (
    <div className="flex w-full max-w-3xl flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-lg font-semibold">{isEditing ? "Editar post" : "Novo post"}</h1>
        <div className="flex flex-col gap-2 sm:flex-row">
          {!isEditing && (
            <button
              onClick={() => save()}
              disabled={saving}
              className="rounded-lg border border-neutral-200 px-3 py-2 text-sm hover:bg-neutral-50 disabled:opacity-40 dark:border-neutral-700 dark:hover:bg-neutral-800 sm:py-1.5"
            >
              Salvar rascunho
            </button>
          )}
          <button
            onClick={() => save(isEditing ? undefined : true)}
            disabled={saving}
            className="rounded-lg bg-neutral-900 px-3 py-2 text-sm text-white disabled:opacity-40 dark:bg-white dark:text-neutral-900 sm:py-1.5"
          >
            {isEditing ? "Aplicar edições" : "Publicar"}
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="flex flex-col gap-4">
        <input
          value={title}
          onChange={(e) => handleTitleChange(e.target.value)}
          placeholder="Título"
          className="w-full border-b border-neutral-200 bg-transparent pb-2 text-2xl font-semibold outline-none placeholder:text-neutral-300 dark:border-neutral-800"
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-neutral-400">Slug</label>
            <input
              value={slug}
              onChange={(e) => { setSlug(e.target.value); setSlugEdited(true) }}
              className="text-sm bg-transparent border border-neutral-200 dark:border-neutral-700 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-neutral-300"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-neutral-400">Estilo</label>
            <select
              value={style}
              onChange={(e) => setStyle(e.target.value as PostData["style"])}
              className="text-sm bg-transparent border border-neutral-200 dark:border-neutral-700 rounded px-2 py-1 outline-none"
            >
              <option value="standard">Standard</option>
              <option value="editorial">Editorial</option>
              <option value="opinion">Opinion</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-neutral-400">Tags (separadas por vírgula)</label>
            <input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              className="text-sm bg-transparent border border-neutral-200 dark:border-neutral-700 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-neutral-300"
            />
          </div>
          <label className="flex items-center gap-2 rounded border border-neutral-200 px-2 py-1 text-sm text-neutral-700 dark:border-neutral-700 dark:text-neutral-300">
            <input
              type="checkbox"
              checked={visibleInTimeline}
              onChange={(e) => setVisibleInTimeline(e.target.checked)}
              className="size-4 rounded border-neutral-300"
            />
            Aparecer na timeline
          </label>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-neutral-400">Resumo (excerpt)</label>
          <textarea
            value={excerpt}
            onChange={(e) => setExcerpt(e.target.value)}
            rows={2}
            className="text-sm bg-transparent border border-neutral-200 dark:border-neutral-700 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-neutral-300 resize-none"
          />
        </div>

        <div className="grid gap-3 rounded-xl border border-neutral-200 p-3 dark:border-neutral-800">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-neutral-400">Coautor</label>
            <select
              value={coAuthorUserId}
              onChange={(e) => handleCoAuthorChange(e.target.value)}
              className="text-sm bg-transparent border border-neutral-200 dark:border-neutral-700 rounded px-2 py-1 outline-none"
            >
              <option value="">Sem coautor</option>
              {coAuthors.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </select>
            <span className="text-xs text-neutral-500">
              {loadingCoAuthors ? "Carregando usuários..." : "Usado pelo token @co-autor no texto."}
            </span>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-neutral-400">Imagem do coautor</label>
            <input
              value={friendImage}
              onChange={(e) => setFriendImage(e.target.value)}
              placeholder="https://..."
              className="text-sm bg-transparent border border-neutral-200 dark:border-neutral-700 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-neutral-300"
            />
          </div>
        </div>

        <div className="grid gap-3 rounded-xl border border-neutral-200 p-3 dark:border-neutral-800">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <label className="text-xs text-neutral-400">Capa / asset de imagem</label>
            <button
              type="button"
              onClick={() => coverFileRef.current?.click()}
              disabled={uploadingCover}
              className="rounded border border-neutral-200 px-2 py-1.5 text-xs hover:bg-neutral-50 disabled:opacity-40 dark:border-neutral-700 dark:hover:bg-neutral-800 sm:py-1"
            >
              {uploadingCover ? "enviando..." : "Upload para Blob"}
            </button>
          </div>
          <input
            ref={coverFileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => { if (e.target.files?.[0]) uploadCover(e.target.files[0]) }}
          />
          <input
            value={coverUrl}
            onChange={(e) => setCoverUrl(e.target.value)}
            placeholder="URL da imagem de capa"
            className="text-sm bg-transparent border border-neutral-200 dark:border-neutral-700 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-neutral-300"
          />
          <input
            value={coverAlt}
            onChange={(e) => setCoverAlt(e.target.value)}
            placeholder="Texto alternativo"
            className="text-sm bg-transparent border border-neutral-200 dark:border-neutral-700 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-neutral-300"
          />
          <label className="flex items-start gap-2 rounded-lg border border-neutral-200 px-3 py-2 text-sm text-neutral-700 dark:border-neutral-800 dark:text-neutral-300">
            <input
              type="checkbox"
              checked={showCoverInTimeline}
              onChange={(e) => setShowCoverInTimeline(e.target.checked)}
              disabled={!coverUrl.trim()}
              className="mt-0.5 size-4 rounded border-neutral-300 text-neutral-900 disabled:opacity-40"
            />
            <span className="flex flex-col gap-0.5">
              <span className="font-medium">Mostrar capa na timeline</span>
              <span className="text-xs text-neutral-500">
                A capa continua visível dentro do post mesmo quando esta opção está desligada.
              </span>
            </span>
          </label>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-neutral-400">URL do áudio</label>
          <input
            value={audioUrl}
            onChange={(e) => setAudioUrl(e.target.value)}
            placeholder="https://..."
            className="text-sm bg-transparent border border-neutral-200 dark:border-neutral-700 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-neutral-300"
          />
        </div>
      </div>

      <div className="border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden">
        <LexicalEditor initialMarkdown={content} onChange={handleContentChange} editorRef={editorRef} />
      </div>
    </div>
  )
}
