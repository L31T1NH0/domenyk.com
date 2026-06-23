"use client"

import Link from "next/link"
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type MouseEvent } from "react"
import { useUser } from "@clerk/nextjs"
import { ChatBubbleLeftEllipsisIcon, PencilIcon, XMarkIcon } from "@heroicons/react/24/outline"
import { formatDistanceToNow } from "date-fns"
import { ptBR } from "date-fns/locale"
import type { LexicalEditor as LexicalEditorInstance } from "lexical"
import { LexicalEditor, readMarkdownFromEditor } from "@/components/editor/LexicalEditor"
import { ExpandableText } from "@/components/text/ExpandableText"
import { usePretextContentFontSize } from "@/components/text/usePretextTextMetrics"
import type { SerializedNote } from "@/lib/db/notes"

type Comment = {
  _id: string
  authorName: string
  authorImageUrl: string
  authorId: string
  content: string
  createdAt: string
}

type Props = {
  note: SerializedNote
  isAdmin?: boolean
  onDelete?: (id: string) => void
  onUpdate?: (note: SerializedNote) => void
  cropTallImages?: boolean
}

type ActiveImage = {
  src: string
  alt: string
}

const TIMELINE_IMAGE_CROP_MAX_HEIGHT = 416
const TIMELINE_IMAGE_CROP_MIN_RATIO = 1.12

type NoteCommentsPanelProps = {
  noteId: string
  comments: Comment[]
  loading?: boolean
  isAdmin?: boolean
  onCommentsChange: (comments: Comment[]) => void
  onClose: () => void
}

function NoteCommentsPanel({ noteId, comments, loading = false, isAdmin, onCommentsChange, onClose }: NoteCommentsPanelProps) {
  const { user } = useUser()
  const [draft, setDraft] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

  async function submit() {
    if (!draft.trim() || submitting) return
    setSubmitting(true)
    const res = await fetch(`/api/notes/${noteId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: draft.trim() }),
    })
    if (res.ok) {
      const comment = await res.json()
      onCommentsChange([...comments, comment])
      setDraft("")
    }
    setSubmitting(false)
  }

  async function remove(id: string) {
    const res = await fetch(`/api/comments/by-id/${id}`, { method: "DELETE" })
    if (res.ok) onCommentsChange(comments.filter((comment) => comment._id !== id))
  }

  return (
    <aside className="fixed inset-x-4 bottom-4 z-50 flex max-h-[70vh] flex-col rounded-lg border border-neutral-200 bg-white p-3 shadow-xl shadow-black/10 dark:border-white/10 dark:bg-[#080808] sm:absolute sm:inset-x-auto sm:inset-y-0 sm:left-[calc(100%+1rem)] sm:bottom-auto sm:w-80 sm:max-h-full">
      <div className="flex items-center justify-between gap-3 border-b border-neutral-200 pb-2 dark:border-white/10">
        <span className="text-xs font-medium text-neutral-700 dark:text-[#A8A095]">Comentários</span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar comentários"
          className="grid size-7 place-items-center rounded-full text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-950 dark:text-[#A8A095] dark:hover:bg-white/10 dark:hover:text-[#f1f1f1]"
        >
          <XMarkIcon className="size-4" aria-hidden />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto py-3">
        {loading ? (
          <p className="text-xs text-neutral-500 dark:text-[#A8A095]/75">Carregando comentários...</p>
        ) : comments.length === 0 ? (
          <p className="text-xs text-neutral-500 dark:text-[#A8A095]/75">Nenhum comentário ainda.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {comments.map((comment) => (
              <div key={comment._id} className="flex gap-2 text-xs">
                {comment.authorImageUrl ? (
                  <img
                    src={comment.authorImageUrl}
                    alt=""
                    className="mt-0.5 size-6 shrink-0 rounded-full object-cover"
                    style={{ filter: "none" }}
                  />
                ) : (
                  <div className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-neutral-100 text-[10px] text-neutral-700 dark:bg-white/10 dark:text-[#f1f1f1]">
                    {comment.authorName.slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="font-medium text-neutral-950 dark:text-[#f1f1f1]">{comment.authorName}</span>
                    <time className="shrink-0 text-[11px] text-neutral-500 dark:text-[#A8A095]/70">
                      {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true, locale: ptBR })}
                    </time>
                  </div>
                  <ExpandableText
                    text={comment.content}
                    maxLines={5}
                    whiteSpace="pre-wrap"
                    className="mt-0.5 break-words leading-relaxed text-neutral-700 dark:text-[#d8d4ce]"
                  />
                </div>
                {(isAdmin || user?.id === comment.authorId) && (
                  <button
                    type="button"
                    onClick={() => remove(comment._id)}
                    aria-label="Deletar comentário"
                    className="grid size-5 shrink-0 place-items-center text-neutral-400 transition-colors hover:text-red-500 dark:text-[#A8A095]/50 dark:hover:text-red-400"
                  >
                    <XMarkIcon className="size-3" aria-hidden />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {user ? (
        <div className="flex gap-2 border-t border-neutral-200 pt-2 dark:border-white/10">
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) submit()
            }}
            rows={2}
            placeholder="Escreva um comentário..."
            className="min-w-0 flex-1 resize-none rounded-md border border-neutral-200 bg-transparent p-2 text-xs text-neutral-900 outline-none placeholder:text-neutral-400 focus:ring-1 focus:ring-neutral-300 dark:border-white/10 dark:text-[#f1f1f1] dark:placeholder:text-[#A8A095]/60 dark:focus:ring-[#A8A095]/40"
          />
          <button
            type="button"
            onClick={submit}
            disabled={submitting || !draft.trim()}
            className="self-end rounded-md bg-neutral-950 px-3 py-1.5 text-xs font-medium text-white transition-opacity disabled:opacity-40 dark:bg-[#f1f1f1] dark:text-[#080808]"
          >
            {submitting ? "..." : "Enviar"}
          </button>
        </div>
      ) : (
        <p className="border-t border-neutral-200 pt-2 text-xs text-neutral-500 dark:border-white/10 dark:text-[#A8A095]/75">Faça login para comentar.</p>
      )}
    </aside>
  )
}

export function NoteCard({ note, isAdmin, onDelete, onUpdate, cropTallImages = false }: Props) {
  const contentRef = useRef<HTMLDivElement>(null)
  const editEditorRef = useRef<LexicalEditorInstance | null>(null)
  const contentFontSize = usePretextContentFontSize(contentRef, {
    minSize: 13,
    maxSize: 14,
    maxLinesPerBlock: 5,
    blockSelector: "p, li, blockquote",
  })
  const [comments, setComments] = useState<Comment[]>([])
  const [commentsLoaded, setCommentsLoaded] = useState(false)
  const [loadingComments, setLoadingComments] = useState(false)
  const [commentsOpen, setCommentsOpen] = useState(false)
  const [activeImage, setActiveImage] = useState<ActiveImage | null>(null)
  const [lightboxVisible, setLightboxVisible] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editContent, setEditContent] = useState(note.content)
  const [editSession, setEditSession] = useState(0)
  const [savingEdit, setSavingEdit] = useState(false)
  const [editError, setEditError] = useState("")
  const touchStartRef = useRef(0)
  const activeImageTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const closeThreshold = 80

  const applyTimelineImageCrops = useCallback(() => {
    const content = contentRef.current
    if (!content) return

    const images = Array.from(content.querySelectorAll("img"))
    for (const image of images) {
      if (image.naturalWidth <= 0 || image.naturalHeight <= 0) continue

      const aspectRatio = image.naturalHeight / image.naturalWidth
      const isTall = cropTallImages && aspectRatio >= TIMELINE_IMAGE_CROP_MIN_RATIO
      const renderedWidth =
        image.getBoundingClientRect().width ||
        image.parentElement?.clientWidth ||
        image.clientWidth ||
        image.naturalWidth
      const renderedHeight = renderedWidth * aspectRatio
      const shouldCrop = isTall && renderedHeight > TIMELINE_IMAGE_CROP_MAX_HEIGHT

      image.dataset.timelineCropped = shouldCrop ? "true" : "false"
      image.parentElement?.toggleAttribute("data-timeline-crop-frame", shouldCrop)
    }
  }, [cropTallImages])

  const closeLightbox = useCallback(() => {
    if (activeImageTimerRef.current) clearTimeout(activeImageTimerRef.current)
    setLightboxVisible(false)
    activeImageTimerRef.current = setTimeout(() => {
      setActiveImage(null)
      activeImageTimerRef.current = null
    }, 250)
  }, [])

  const ago = formatDistanceToNow(new Date(note.publishedAt), {
    addSuffix: true,
    locale: ptBR,
  })

  async function loadComments() {
    if (commentsLoaded || loadingComments) return

    setLoadingComments(true)
    try {
      const response = await fetch(`/api/notes/${note._id}/comments`)
      const next = response.ok ? await response.json() as Comment[] : []
      setComments(next)
      setCommentsLoaded(true)
    } catch {
      setComments([])
    } finally {
      setLoadingComments(false)
    }
  }

  function openComments() {
    setCommentsOpen(true)
    void loadComments()
  }

  function startEditing() {
    setEditContent(note.content)
    setEditError("")
    setEditSession((current) => current + 1)
    setEditing(true)
  }

  function cancelEditing() {
    setEditing(false)
    setEditError("")
  }

  async function saveEdit() {
    const currentContent = editEditorRef.current
      ? readMarkdownFromEditor(editEditorRef.current)
      : editContent.trim()

    if (!currentContent || savingEdit) return
    setSavingEdit(true)
    setEditError("")

    const response = await fetch(`/api/admin/notes/${note._id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: currentContent }),
    })

    if (response.ok) {
      const updatedNote = await response.json() as SerializedNote
      onUpdate?.(updatedNote)
      setEditing(false)
    } else {
      const data = await response.json().catch(() => null)
      setEditError(data?.error ?? "Não foi possível salvar a nota.")
    }

    setSavingEdit(false)
  }

  function confirmDelete() {
    if (!window.confirm("Deletar esta nota? Esta ação não pode ser desfeita.")) return
    onDelete?.(note._id)
  }

  useEffect(() => {
    if (!activeImage) return
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => setLightboxVisible(true))
    })

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeLightbox()
    }
    const onWheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaY) > closeThreshold) closeLightbox()
    }
    const onTouchStart = (event: TouchEvent) => {
      touchStartRef.current = event.touches[0]?.clientY ?? 0
    }
    const onTouchMove = (event: TouchEvent) => {
      const delta = Math.abs((event.touches[0]?.clientY ?? 0) - touchStartRef.current)
      if (delta > closeThreshold) closeLightbox()
    }

    document.addEventListener("keydown", onKey)
    window.addEventListener("wheel", onWheel, { passive: true })
    window.addEventListener("touchstart", onTouchStart, { passive: true })
    window.addEventListener("touchmove", onTouchMove, { passive: true })

    return () => {
      cancelAnimationFrame(frame)
      document.body.style.overflow = previousOverflow
      document.removeEventListener("keydown", onKey)
      window.removeEventListener("wheel", onWheel)
      window.removeEventListener("touchstart", onTouchStart)
      window.removeEventListener("touchmove", onTouchMove)
      if (activeImageTimerRef.current) {
        clearTimeout(activeImageTimerRef.current)
        activeImageTimerRef.current = null
      }
    }
  }, [activeImage, closeLightbox])

  useLayoutEffect(() => {
    const content = contentRef.current
    if (!content) return

    const images = Array.from(content.querySelectorAll("img"))
    const cleanups = images.map((image) => {
      if (image.complete) {
        applyTimelineImageCrops()
        return () => {}
      }

      const onLoad = () => applyTimelineImageCrops()
      image.addEventListener("load", onLoad)
      return () => image.removeEventListener("load", onLoad)
    })
    const resizeObserver = new ResizeObserver(() => applyTimelineImageCrops())
    resizeObserver.observe(content)
    applyTimelineImageCrops()

    return () => {
      cleanups.forEach((cleanup) => cleanup())
      resizeObserver.disconnect()
    }
  }, [applyTimelineImageCrops, contentFontSize, note.contentHtml, note.images])

  useEffect(() => {
    if (activeImage) return
    const frame = requestAnimationFrame(() => applyTimelineImageCrops())
    return () => cancelAnimationFrame(frame)
  }, [activeImage, applyTimelineImageCrops])

  function openLightbox(src: string, alt = "") {
    setActiveImage({ src, alt })
  }

  function handleContentClick(event: MouseEvent<HTMLDivElement>) {
    const image = (event.target as HTMLElement).closest("img")
    if (!image || !contentRef.current?.contains(image)) return
    openLightbox(image.getAttribute("src") ?? "", image.getAttribute("alt") ?? "")
  }

  const commentActionLabel = commentsLoaded && comments.length > 0 ? "ver comentários" : "comentar"
  const notePath = `/notes/${note._id}`

  return (
    <article className="group relative flex w-full min-w-0 flex-col gap-2.5 border-y border-neutral-200 pb-5 pt-4 dark:border-white/10">
      <div className="flex items-center">
        <Link
          href={notePath}
          className="text-xs text-neutral-500 transition-colors hover:text-neutral-950 dark:text-[#A8A095]/75 dark:hover:text-[#f1f1f1]"
          aria-label="Abrir nota"
        >
          <time dateTime={note.publishedAt}>{ago}</time>
        </Link>
        {isAdmin && (
          <div className="absolute right-0 top-5 flex items-center gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
            {onUpdate && !editing && (
              <button
                type="button"
                onClick={startEditing}
                aria-label="Editar nota"
                title="Editar nota"
                className="grid size-4 place-items-center text-neutral-400 transition-colors hover:text-neutral-950 dark:text-[#A8A095]/60 dark:hover:text-[#f1f1f1]"
              >
                <PencilIcon className="size-3.5" aria-hidden />
              </button>
            )}
            {onDelete && !editing && (
              <button
                type="button"
                onClick={confirmDelete}
                className="text-xs leading-none text-neutral-400 transition-colors hover:text-red-500 dark:text-[#A8A095]/50 dark:hover:text-red-400"
              >
                deletar
              </button>
            )}
          </div>
        )}
      </div>

      {editing ? (
        <div className="rounded-lg border border-neutral-200 bg-white dark:border-white/10 dark:bg-white/[0.03]">
          <div
            onKeyDown={(event) => {
              if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) saveEdit()
              if (event.key === "Escape") cancelEditing()
            }}
          >
            <LexicalEditor
              key={`${note._id}:${editSession}`}
              namespace={`NoteEdit-${note._id}`}
              initialMarkdown={note.content}
              onChange={setEditContent}
              placeholder="Edite a nota..."
              shellClassName="min-h-28 px-4 py-3"
              editorClassName="min-h-28 text-[15px]"
              toolbarVariant="compact"
              toolbarPlacement="bottom"
              onChangeDelayMs={160}
              editorRef={editEditorRef}
            />
          </div>
          <div className="flex items-center justify-end gap-2 border-t border-neutral-200 px-3 py-2 dark:border-white/10">
            {editError && <p className="mr-auto text-xs text-red-400">{editError}</p>}
            <button
              type="button"
              onClick={cancelEditing}
              disabled={savingEdit}
              className="rounded-full px-3 py-1.5 text-xs font-medium text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-950 disabled:opacity-50 dark:text-[#A8A095] dark:hover:bg-white/10 dark:hover:text-[#f1f1f1]"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={saveEdit}
              disabled={savingEdit || !editContent.trim()}
              className="rounded-full bg-neutral-950 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-neutral-700 disabled:cursor-not-allowed disabled:bg-neutral-200 disabled:text-neutral-400 dark:bg-[#f1f1f1] dark:text-[#040404] dark:hover:bg-[#A8A095] dark:disabled:bg-white/25 dark:disabled:text-white/50"
            >
              {savingEdit ? "Salvando" : "Salvar"}
            </button>
          </div>
        </div>
      ) : (
        <div
          ref={contentRef}
          className={[
            "note-content text-sm leading-relaxed text-neutral-900 dark:text-[#f1f1f1]",
            cropTallImages ? "note-content-timeline" : "",
          ].filter(Boolean).join(" ")}
          style={{ fontSize: contentFontSize }}
          onClick={handleContentClick}
          dangerouslySetInnerHTML={{ __html: note.contentHtml }}
        />
      )}

      {note.images && note.images.length > 0 && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {note.images.map((url) => (
            <img
              key={url}
              src={url}
              alt=""
              onClick={() => openLightbox(url)}
              className="aspect-square w-full cursor-zoom-in rounded-xl border border-neutral-200 object-cover dark:border-white/10"
            />
          ))}
        </div>
      )}

      <div className="pointer-events-none absolute bottom-0 left-0">
        <button
          type="button"
          onClick={openComments}
          aria-expanded={commentsOpen}
          className="pointer-events-auto inline-flex items-center gap-1.5 text-xs text-neutral-500 opacity-100 transition-colors hover:text-neutral-950 dark:text-[#A8A095]/70 dark:hover:text-[#f1f1f1] sm:opacity-0 sm:group-hover:opacity-100"
        >
          <ChatBubbleLeftEllipsisIcon className="size-4" aria-hidden />
          <span>{commentActionLabel}</span>
          {commentsLoaded && comments.length > 0 && <span className="tabular-nums">({comments.length})</span>}
        </button>
      </div>

      {commentsOpen && (
          <NoteCommentsPanel
            noteId={note._id}
            comments={comments}
            loading={loadingComments}
            isAdmin={isAdmin}
            onCommentsChange={(next) => {
              setComments(next)
              setCommentsLoaded(true)
            }}
            onClose={() => setCommentsOpen(false)}
          />
      )}

      {activeImage && (
        <div
          onClick={closeLightbox}
          className="fixed inset-0 z-[9999] flex items-center justify-center"
          style={{
            backgroundColor: `rgba(0,0,0,${lightboxVisible ? 0.92 : 0})`,
            backdropFilter: `blur(${lightboxVisible ? 8 : 0}px)`,
            transition: "background-color 250ms ease, backdrop-filter 250ms ease",
          }}
        >
          <button
            type="button"
            onClick={closeLightbox}
            aria-label="Fechar"
            className="absolute right-4 top-4 z-10 flex items-center justify-center rounded-full bg-white/10 p-2 transition-colors hover:bg-white/20"
            style={{ opacity: lightboxVisible ? 1 : 0, transition: "opacity 250ms ease" }}
          >
            <XMarkIcon className="h-5 w-5 text-white" />
          </button>
          <img
            src={activeImage.src}
            alt={activeImage.alt}
            onClick={(event) => event.stopPropagation()}
            className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain shadow-2xl"
            style={{
              filter: "grayscale(0)",
              opacity: lightboxVisible ? 1 : 0,
              transform: lightboxVisible ? "scale(1)" : "scale(0.92)",
              transition: "opacity 250ms ease, transform 250ms ease",
            }}
          />
          <span
            className="pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white mix-blend-difference backdrop-blur-sm"
            style={{ opacity: lightboxVisible ? 1 : 0, transition: "opacity 400ms ease" }}
          >
            Scroll ou Esc para fechar
          </span>
        </div>
      )}
    </article>
  )
}
