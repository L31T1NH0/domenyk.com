"use client"

import Link from "next/link"
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent,
  type RefObject,
} from "react"
import { createPortal } from "react-dom"
import { useUser } from "@clerk/nextjs"
import { ChatBubbleLeftEllipsisIcon, LinkIcon, PencilIcon, XMarkIcon } from "@heroicons/react/24/outline"
import { formatDistanceToNow } from "date-fns"
import { ptBR } from "date-fns/locale"
import type { LexicalEditor as LexicalEditorInstance } from "lexical"
import { LexicalEditor, readMarkdownFromEditor } from "@/components/editor/LexicalEditor"
import { CommentContent } from "@/components/comments/CommentContent"
import { RichCommentComposer } from "@/components/comments/RichCommentComposer"
import { useComments, type Comment } from "@/components/comments/useComments"
import { ContentActionMenu, type ContentMenuAction } from "@/components/actions/ContentActionMenu"
import { DeleteActionMenu } from "@/components/actions/DeleteActionMenu"
import type { SerializedNote } from "@/lib/db/notes"
import { noteDisplayTitle } from "@/lib/seo"
import { NOTE_VIEW_TTL_MS, type NoteViewSource } from "@/lib/note-views"
import type { NoteTimelinePlacement } from "@/components/notes/NoteTimelineGroup"

type Props = {
  note: SerializedNote
  showMetadata?: boolean
  viewContext?: Exclude<NoteViewSource, "direct">
  isAdmin?: boolean
  onDelete?: (id: string) => Promise<void> | void
  onUpdate?: (note: SerializedNote) => void
  onContinueThread?: (note: SerializedNote) => void
  cropTallImages?: boolean
  deleting?: boolean
  timelineThreadPlacement?: NoteTimelinePlacement
  timelineThreadSize?: number
  showThreadLabel?: boolean
  threadLinkSource?: SerializedNote | null
  onLinkToThread?: (note: SerializedNote) => void
  onCancelThreadLink?: () => void
  linkingToThread?: boolean
  commentsPanelMode?: "adjacent" | "viewport"
  showTimelineBoundaries?: boolean
}

type ActiveImage = {
  src: string
  alt: string
}

const TIMELINE_IMAGE_CROP_MAX_HEIGHT = 416
const TIMELINE_IMAGE_CROP_MIN_RATIO = 1.12
const pendingNoteImpressions = new Set<string>()

type NoteCommentsPanelProps = {
  comments: Comment[]
  loading?: boolean
  hasMore?: boolean
  loadingOlder?: boolean
  error?: string
  draft: string
  submitting: boolean
  isAdmin?: boolean
  onDraftChange: (draft: string) => void
  onSubmit: (content?: string) => Promise<boolean | void> | boolean | void
  onRemove: (id: string) => Promise<boolean>
  onLoadOlder: () => Promise<void> | void
  onClose: () => void
  returnFocusRef: RefObject<HTMLButtonElement | null>
  mode?: "adjacent" | "viewport"
}

function NoteCommentsPanel({ comments, loading = false, hasMore = false, loadingOlder = false, error = "", draft, submitting, isAdmin, onDraftChange, onSubmit, onRemove, onLoadOlder, onClose, returnFocusRef, mode = "adjacent" }: NoteCommentsPanelProps) {
  const { user } = useUser()
  const panelRef = useRef<HTMLElement>(null)
  const titleId = useId()

  useEffect(() => {
    const returnFocusTarget = returnFocusRef.current
    const frame = requestAnimationFrame(() => {
      if (!panelRef.current?.contains(document.activeElement)) panelRef.current?.focus()
    })

    return () => {
      cancelAnimationFrame(frame)
      returnFocusTarget?.focus()
    }
  }, [returnFocusRef])

  return (
    <aside
      ref={panelRef}
      role="dialog"
      aria-labelledby={titleId}
      tabIndex={-1}
      onKeyDown={(event) => {
        if (event.key === "Escape") onClose()
      }}
      className={[
        "z-50 flex flex-col rounded-lg border border-neutral-200 bg-white p-3 shadow-md shadow-black/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500 dark:border-white/10 dark:bg-[#080808] dark:focus-visible:ring-neutral-300",
        mode === "viewport"
          ? "fixed bottom-4 right-4 max-h-[70vh] w-[min(20rem,calc(100vw-2rem))]"
          : "fixed inset-x-4 bottom-4 max-h-[70vh] sm:absolute sm:inset-x-auto sm:inset-y-0 sm:left-[calc(100%+1rem)] sm:bottom-auto sm:w-80 sm:max-h-full",
      ].join(" ")}
    >
      <div className="flex items-center justify-between gap-3 border-b border-neutral-200 pb-2 dark:border-white/10">
        <h2 id={titleId} className="text-xs font-medium text-neutral-700 dark:text-[#c2bbb1]">Comentários</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar comentários"
          className="grid size-8 place-items-center rounded-full text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500 dark:text-[#c2bbb1] dark:hover:bg-white/10 dark:hover:text-[#f1f1f1] dark:focus-visible:ring-neutral-300"
        >
          <XMarkIcon className="size-4" aria-hidden />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto py-3">
        {error && <p role="alert" className="mb-3 text-xs text-red-700 dark:text-red-300">{error}</p>}
        {loading ? (
          <p role="status" className="text-xs text-neutral-600 dark:text-[#c2bbb1]">Carregando comentários...</p>
        ) : comments.length === 0 ? (
          <p className="text-xs text-neutral-600 dark:text-[#c2bbb1]">Nenhum comentário ainda.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {hasMore && (
              <button
                type="button"
                onClick={() => void onLoadOlder()}
                disabled={loadingOlder}
                className="min-h-8 self-start rounded px-2 text-xs font-medium text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500 disabled:opacity-50 dark:text-[#c2bbb1] dark:hover:bg-white/10 dark:hover:text-[#f1f1f1] dark:focus-visible:ring-neutral-300"
              >
                {loadingOlder ? "Carregando..." : "Comentários anteriores"}
              </button>
            )}
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
                    <time dateTime={comment.createdAt} className="shrink-0 text-[11px] text-neutral-600 dark:text-[#c2bbb1]">
                      {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true, locale: ptBR })}
                    </time>
                  </div>
                  <CommentContent
                    comment={comment}
                    maxLines={5}
                    whiteSpace="pre-wrap"
                    className="mt-0.5 break-words leading-relaxed text-neutral-700 dark:text-[#d8d4ce]"
                  />
                </div>
                {(isAdmin || comment.canDelete) && <DeleteActionMenu title="Excluir comentário?" onDelete={async () => { if (!(await onRemove(comment._id))) throw new Error("Não foi possível excluir o comentário.") }} triggerAriaLabel="Opções do comentário" triggerClassName="grid size-8 shrink-0 place-items-center rounded-full text-neutral-500 outline-none transition-colors hover:bg-neutral-100 hover:text-neutral-950 focus-visible:ring-2 focus-visible:ring-neutral-500 dark:text-[#A8A095] dark:hover:bg-white/10 dark:hover:text-white" />}
              </div>
            ))}
          </div>
        )}
      </div>

      {user ? (
        <div className="border-t border-neutral-200 pt-2 dark:border-white/10">
          <RichCommentComposer
            draft={draft}
            submitting={submitting}
            size="compact"
            autoFocus
            submittingLabel="..."
            allowImageUpload={isAdmin}
            onDraftChange={onDraftChange}
            onSubmit={onSubmit}
          />
        </div>
      ) : (
        <p className="border-t border-neutral-200 pt-2 text-xs text-neutral-600 dark:border-white/10 dark:text-[#c2bbb1]">Faça login para comentar.</p>
      )}
    </aside>
  )
}

export function NoteCard({ note, showMetadata = false, viewContext, isAdmin, onDelete, onUpdate, onContinueThread, cropTallImages = false, deleting = false, timelineThreadPlacement = "only", timelineThreadSize = 1, showThreadLabel = true, threadLinkSource = null, onLinkToThread, onCancelThreadLink, linkingToThread = false, commentsPanelMode = "adjacent", showTimelineBoundaries = true }: Props) {
  const articleRef = useRef<HTMLElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const editEditorRef = useRef<LexicalEditorInstance | null>(null)
  const commentsButtonRef = useRef<HTMLButtonElement>(null)
  const lightboxDialogRef = useRef<HTMLDialogElement>(null)
  const lightboxCloseButtonRef = useRef<HTMLButtonElement>(null)
  const lightboxOpenerRef = useRef<HTMLElement | null>(null)
  const commentsEndpoint = `/api/notes/${note._id}/comments`
  const {
    comments,
    draft,
    loading: loadingComments,
    loaded: commentsLoaded,
    totalCount: commentCount,
    submitting,
    hasMore,
    loadingOlder,
    error: commentsError,
    setDraft,
    load: loadComments,
    loadOlder: loadOlderComments,
    submit: submitComment,
    remove: removeComment,
  } = useComments(commentsEndpoint, { enabled: false })
  const [commentsOpen, setCommentsOpen] = useState(false)
  const [activeImage, setActiveImage] = useState<ActiveImage | null>(null)
  const [lightboxVisible, setLightboxVisible] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editTitle, setEditTitle] = useState(note.title ?? "")
  const [editContent, setEditContent] = useState(note.content)
  const [editSession, setEditSession] = useState(0)
  const [savingEdit, setSavingEdit] = useState(false)
  const [editError, setEditError] = useState("")
  const touchStartRef = useRef(0)
  const activeImageTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const closeThreshold = 80

  useEffect(() => {
    if (!viewContext) return
    const element = articleRef.current
    if (!element) return
    const pendingKey = `${viewContext}:${note._id}`
    const storageKey = `note-viewed:${pendingKey}`
    const now = Date.now()
    try {
      const previous = Number(localStorage.getItem(storageKey) ?? 0)
      if (previous && now - previous < NOTE_VIEW_TTL_MS) return
    } catch {}
    if (pendingNoteImpressions.has(pendingKey)) return

    let timer: ReturnType<typeof setTimeout> | null = null
    let stopped = false
    let sufficientlyVisible = false

    const clearImpressionTimer = () => {
      if (!timer) return
      clearTimeout(timer)
      timer = null
    }

    const countImpression = () => {
      timer = null
      if (stopped) return
      pendingNoteImpressions.add(pendingKey)
      observer.disconnect()
      document.removeEventListener("visibilitychange", syncImpressionTimer)
      fetch(`/api/notes/${note._id}/view`, {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: viewContext }),
      }).then((response) => {
        if (response.ok) {
          try { localStorage.setItem(storageKey, String(Date.now())) } catch {}
        }
      }).catch(() => undefined).finally(() => pendingNoteImpressions.delete(pendingKey))
    }

    const syncImpressionTimer = () => {
      clearImpressionTimer()
      if (sufficientlyVisible && document.visibilityState === "visible") {
        timer = setTimeout(countImpression, note.readingEstimate.impressionThresholdMs)
      }
    }

    const observer = new IntersectionObserver(([entry]) => {
      const nextVisibility = entry.isIntersecting
        && entry.intersectionRatio >= note.readingEstimate.impressionVisibleRatio
      if (nextVisibility === sufficientlyVisible) return
      sufficientlyVisible = nextVisibility
      syncImpressionTimer()
    }, { threshold: [0, note.readingEstimate.impressionVisibleRatio] })
    document.addEventListener("visibilitychange", syncImpressionTimer)
    observer.observe(element)
    return () => {
      stopped = true
      observer.disconnect()
      document.removeEventListener("visibilitychange", syncImpressionTimer)
      clearImpressionTimer()
    }
  }, [note._id, note.readingEstimate.impressionThresholdMs, note.readingEstimate.impressionVisibleRatio, viewContext])

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
    const closeDelay = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 250
    activeImageTimerRef.current = setTimeout(() => {
      if (lightboxDialogRef.current?.open) lightboxDialogRef.current.close()
      setActiveImage(null)
      lightboxOpenerRef.current?.focus()
      lightboxOpenerRef.current = null
      activeImageTimerRef.current = null
    }, closeDelay)
  }, [])

  const ago = formatDistanceToNow(new Date(note.publishedAt), {
    addSuffix: true,
    locale: ptBR,
  })

  function openComments() {
    setCommentsOpen(true)
    void loadComments()
  }

  function startEditing() {
    setEditTitle(note.title ?? "")
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

    try {
      const response = await fetch(`/api/admin/notes/${note._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: editTitle.trim() || undefined, content: currentContent }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => null)
        throw new Error(data?.error ?? "Não foi possível salvar a nota.")
      }

      const updatedNote = await response.json() as SerializedNote
      onUpdate?.(updatedNote)
      setEditing(false)
    } catch (caughtError) {
      setEditError(caughtError instanceof Error ? caughtError.message : "Não foi possível salvar a nota.")
    } finally {
      setSavingEdit(false)
    }
  }

  useEffect(() => {
    if (!activeImage) return
    const dialog = lightboxDialogRef.current
    if (!dialog) return

    if (!dialog.open) dialog.showModal()
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => {
        setLightboxVisible(true)
        lightboxCloseButtonRef.current?.focus()
      })
    })

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"

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

    dialog.addEventListener("wheel", onWheel, { passive: true })
    dialog.addEventListener("touchstart", onTouchStart, { passive: true })
    dialog.addEventListener("touchmove", onTouchMove, { passive: true })

    return () => {
      cancelAnimationFrame(frame)
      document.body.style.overflow = previousOverflow
      dialog.removeEventListener("wheel", onWheel)
      dialog.removeEventListener("touchstart", onTouchStart)
      dialog.removeEventListener("touchmove", onTouchMove)
      if (activeImageTimerRef.current) {
        clearTimeout(activeImageTimerRef.current)
        activeImageTimerRef.current = null
      }
      if (dialog.open) dialog.close()
    }
  }, [activeImage, closeLightbox])

  useLayoutEffect(() => {
    const content = contentRef.current
    if (!content) return

    const images = Array.from(content.querySelectorAll("img"))
    const zoomableImages = images.filter((image) => !image.closest('[data-role="author-reference"]'))
    for (const image of zoomableImages) {
      image.tabIndex = 0
      image.setAttribute("role", "button")
      image.setAttribute("aria-label", image.alt ? `Ampliar imagem: ${image.alt}` : "Ampliar imagem")
    }

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
      for (const image of zoomableImages) {
        image.removeAttribute("tabindex")
        image.removeAttribute("role")
        image.removeAttribute("aria-label")
      }
      resizeObserver.disconnect()
    }
  }, [applyTimelineImageCrops, note.contentHtml, note.images])

  useEffect(() => {
    if (activeImage) return
    const frame = requestAnimationFrame(() => applyTimelineImageCrops())
    return () => cancelAnimationFrame(frame)
  }, [activeImage, applyTimelineImageCrops])

  function openLightbox(src: string, alt = "", opener?: HTMLElement) {
    if (!src) return
    lightboxOpenerRef.current = opener ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null)
    setActiveImage({ src, alt })
  }

  function handleContentClick(event: MouseEvent<HTMLDivElement>) {
    const image = (event.target as HTMLElement).closest("img")
    if (!image || !contentRef.current?.contains(image)) return
    if (image.closest('[data-role="author-reference"]')) return
    openLightbox(image.getAttribute("src") ?? "", image.getAttribute("alt") ?? "", image)
  }

  function handleContentKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Enter" && event.key !== " ") return
    const image = (event.target as HTMLElement).closest("img")
    if (!image || !contentRef.current?.contains(image)) return
    if (image.closest('[data-role="author-reference"]')) return

    event.preventDefault()
    openLightbox(image.getAttribute("src") ?? "", image.getAttribute("alt") ?? "", image)
  }

  const commentActionLabel = commentsLoaded && comments.length > 0 ? "ver comentários" : "comentar"
  const notePath = `/notes/${note._id}`
  const displayTitle = noteDisplayTitle(note)
  const visibleTitle = note.title?.trim()
  const selectedThreadRootId = threadLinkSource?.thread?.rootId ?? threadLinkSource?._id
  const noteBelongsToSelectedThread = Boolean(
    threadLinkSource && (
      note._id === threadLinkSource._id ||
      (note.thread?.rootId && note.thread.rootId === selectedThreadRootId)
    )
  )
  const noteBelongsToAnotherThread = Boolean(
    threadLinkSource && note.thread && note.thread.rootId !== selectedThreadRootId
  )
  const noteMenuActions: ContentMenuAction[] = threadLinkSource
    ? [{
        label: note._id === threadLinkSource._id
          ? "Cancelar seleção da thread"
          : noteBelongsToSelectedThread
            ? "Já está nesta thread"
            : noteBelongsToAnotherThread
              ? "Pertence a outra thread"
              : "Linkar à thread selecionada",
        icon: note._id === threadLinkSource._id ? XMarkIcon : LinkIcon,
        onSelect: note._id === threadLinkSource._id
          ? onCancelThreadLink
          : () => onLinkToThread?.(note),
        disabled: note._id !== threadLinkSource._id && (noteBelongsToSelectedThread || noteBelongsToAnotherThread || linkingToThread),
        pendingLabel: "Linkando…",
      }]
    : [
        ...(onUpdate ? [{ label: "Editar nota", icon: PencilIcon, onSelect: startEditing }] : []),
        ...(onContinueThread ? [{ label: "Continuar ou linkar thread", icon: LinkIcon, onSelect: () => onContinueThread(note) }] : []),
      ]
  const borderClass = !showTimelineBoundaries
    ? ""
    : timelineThreadPlacement === "first"
      ? "border-t border-neutral-200 dark:border-white/10"
      : timelineThreadPlacement === "middle"
        ? ""
        : timelineThreadPlacement === "last"
          ? "border-b border-neutral-200 dark:border-white/10"
          : "border-y border-neutral-200 dark:border-white/10"
  const isThreadContinuation = timelineThreadPlacement === "middle" || timelineThreadPlacement === "last"
  const spacingClass = isThreadContinuation ? "pb-5 pt-0" : "pb-5 pt-3"
  const actionPositionClass = isThreadContinuation ? "-top-1" : "top-2"

  return (
    <article ref={articleRef} className={`group relative flex w-full min-w-0 flex-col gap-2.5 ${spacingClass} ${borderClass}`}>
      <div className="flex items-center">
        <Link
          href={notePath}
          className="inline-flex min-h-6 items-center rounded text-xs text-neutral-600 transition-colors hover:text-neutral-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500 dark:text-[#c2bbb1] dark:hover:text-[#f1f1f1] dark:focus-visible:ring-neutral-300"
          aria-label="Abrir nota"
        >
          <time dateTime={note.publishedAt}>{ago}</time>
        </Link>
        {note.thread && (showThreadLabel || timelineThreadSize > 1) && (
          <Link
            href={`/notes/${note.thread.rootId}`}
            className="ml-2 inline-flex min-h-6 items-center gap-1 rounded text-xs text-neutral-600 transition-colors hover:text-neutral-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500 dark:text-[#c2bbb1] dark:hover:text-[#f1f1f1] dark:focus-visible:ring-neutral-300"
            aria-label={`Abrir thread, parte ${note.thread.position}`}
          >
            <LinkIcon className="size-3" aria-hidden />
            <span>{note.thread.position}{timelineThreadSize > 1 ? `/${timelineThreadSize}` : ""}</span>
          </Link>
        )}
        {isAdmin && !editing && (
          <div className={`absolute right-0 z-20 flex items-center gap-1 ${actionPositionClass}`}>
            <ContentActionMenu
              label={`Ações da nota: ${displayTitle}`}
              actions={noteMenuActions}
              deleteAction={onDelete ? {
                title: "Excluir esta nota?",
                description: "A nota, seus comentários e suas métricas internas serão apagados. Se ela estiver em uma thread, as demais notas serão reconectadas.",
                onDelete: () => onDelete(note._id),
                disabled: deleting,
              } : undefined}
            />
          </div>
        )}
      </div>

      {showMetadata && visibleTitle ? (
        <h2 className="text-[15px] font-semibold leading-snug text-neutral-950 dark:text-[#f1f1f1]">
          <Link href={notePath} className="rounded-sm hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500 dark:focus-visible:ring-neutral-300">
            {visibleTitle}
          </Link>
        </h2>
      ) : (
        <h2 className="sr-only"><Link href={notePath}>{displayTitle}</Link></h2>
      )}

      {editing ? (
        <div className="rounded-lg border border-neutral-200 bg-white dark:border-white/10 dark:bg-white/[0.03]">
          <label className="sr-only" htmlFor={`note-edit-title-${note._id}`}>Título da nota</label>
          <input
            id={`note-edit-title-${note._id}`}
            value={editTitle}
            maxLength={120}
            onChange={(event) => setEditTitle(event.target.value)}
            placeholder="Título (opcional)"
            className="w-full border-b border-neutral-200 bg-transparent px-4 py-3 text-sm font-medium text-neutral-950 outline-none placeholder:text-neutral-500 dark:border-white/10 dark:text-[#f1f1f1] dark:placeholder:text-zinc-400"
          />
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
            {editError && <p role="alert" className="mr-auto text-xs text-red-700 dark:text-red-300">{editError}</p>}
            <button
              type="button"
              onClick={cancelEditing}
              disabled={savingEdit}
              className="min-h-8 rounded-full px-3 py-1.5 text-xs font-medium text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500 disabled:opacity-50 dark:text-[#c2bbb1] dark:hover:bg-white/10 dark:hover:text-[#f1f1f1] dark:focus-visible:ring-neutral-300"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={saveEdit}
              disabled={savingEdit || !editContent.trim()}
              className="min-h-8 rounded-full bg-neutral-950 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-neutral-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-neutral-200 disabled:text-neutral-500 dark:bg-[#f1f1f1] dark:text-[#040404] dark:hover:bg-[#A8A095] dark:focus-visible:ring-neutral-300 dark:focus-visible:ring-offset-[#080808] dark:disabled:bg-white/25 dark:disabled:text-white/60"
            >
              {savingEdit ? "Salvando" : "Salvar"}
            </button>
          </div>
        </div>
      ) : (
        <div
          ref={contentRef}
          className={[
            "note-content text-[0.8125rem] leading-relaxed text-neutral-900 dark:text-[#f1f1f1]",
            cropTallImages ? "note-content-timeline" : "",
          ].filter(Boolean).join(" ")}
          onClick={handleContentClick}
          onKeyDown={handleContentKeyDown}
          dangerouslySetInnerHTML={{ __html: note.contentHtml }}
        />
      )}

      {note.images && note.images.length > 0 && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {note.images.map((url, index) => (
            <button
              key={url}
              type="button"
              onClick={(event) => openLightbox(url, `Imagem ${index + 1} da nota`, event.currentTarget)}
              aria-label={`Ampliar imagem ${index + 1} da nota`}
              className="aspect-square w-full cursor-zoom-in overflow-hidden rounded-xl border border-neutral-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500 focus-visible:ring-offset-2 dark:border-white/10 dark:focus-visible:ring-neutral-300 dark:focus-visible:ring-offset-[#040404]"
            >
              <img
                src={url}
                alt={`Imagem ${index + 1}: ${displayTitle}`}
                className="h-full w-full rounded-none object-cover"
              />
            </button>
          ))}
        </div>
      )}

      <div className="pointer-events-none absolute -bottom-1 left-0">
        <button
          ref={commentsButtonRef}
          type="button"
          onClick={openComments}
          aria-expanded={commentsOpen}
          className="pointer-events-auto inline-flex min-h-8 items-center gap-1.5 rounded text-xs leading-none text-neutral-600 opacity-100 transition-colors hover:text-neutral-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500 dark:text-[#c2bbb1] dark:hover:text-[#f1f1f1] dark:focus-visible:ring-neutral-300 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
        >
          <ChatBubbleLeftEllipsisIcon className="size-4 translate-y-px" aria-hidden />
          <span>{commentActionLabel}</span>
          {commentsLoaded && commentCount > 0 && <span className="tabular-nums">({commentCount})</span>}
        </button>
      </div>

      {commentsOpen && (
          <NoteCommentsPanel
            comments={comments}
            loading={loadingComments}
            hasMore={hasMore}
            loadingOlder={loadingOlder}
            error={commentsError}
            draft={draft}
            submitting={submitting}
            isAdmin={isAdmin}
            onDraftChange={setDraft}
            onSubmit={submitComment}
            onRemove={removeComment}
            onLoadOlder={loadOlderComments}
            onClose={() => setCommentsOpen(false)}
            returnFocusRef={commentsButtonRef}
            mode={commentsPanelMode}
          />
      )}

      {activeImage && createPortal(
        <dialog
          ref={lightboxDialogRef}
          aria-label={activeImage.alt ? `Imagem ampliada: ${activeImage.alt}` : "Imagem ampliada"}
          onCancel={(event) => {
            event.preventDefault()
            closeLightbox()
          }}
          onClick={(event) => {
            if (event.target === event.currentTarget) closeLightbox()
          }}
          className="fixed inset-0 m-0 flex h-dvh max-h-none w-screen max-w-none items-center justify-center border-0 bg-transparent p-4 backdrop:bg-transparent motion-reduce:!transition-none"
          style={{
            backgroundColor: `rgba(0,0,0,${lightboxVisible ? 0.92 : 0})`,
            backdropFilter: `blur(${lightboxVisible ? 8 : 0}px)`,
            transition: "background-color 250ms ease, backdrop-filter 250ms ease",
          }}
        >
          <button
            ref={lightboxCloseButtonRef}
            type="button"
            onClick={closeLightbox}
            aria-label="Fechar imagem ampliada"
            className="absolute right-4 top-4 z-10 grid size-10 place-items-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white motion-reduce:!transition-none"
            style={{ opacity: lightboxVisible ? 1 : 0, transition: "opacity 250ms ease" }}
          >
            <XMarkIcon className="h-5 w-5" aria-hidden />
          </button>
          <img
            src={activeImage.src}
            alt={activeImage.alt}
            className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain shadow-2xl motion-reduce:!transform-none motion-reduce:!transition-none"
            style={{
              filter: "grayscale(0)",
              opacity: lightboxVisible ? 1 : 0,
              transform: lightboxVisible ? "scale(1)" : "scale(0.92)",
              transition: "opacity 250ms ease, transform 250ms ease",
            }}
          />
          <span
            className="pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2 rounded-full bg-black/70 px-3 py-1 text-xs font-medium text-white motion-reduce:!transition-none"
            style={{ opacity: lightboxVisible ? 1 : 0, transition: "opacity 400ms ease" }}
          >
            Role, deslize ou pressione Esc para fechar
          </span>
        </dialog>,
        document.body,
      )}
    </article>
  )
}
