"use client"

import { useCallback, useEffect, useRef, useState } from "react"

export type Comment = {
  _id: string
  authorName: string
  authorImageUrl: string
  canDelete: boolean
  content: string
  contentHtml?: string
  createdAt: string
}

type UseCommentsOptions = {
  enabled?: boolean
}

function commentTotalFromResponse(response: Response, fallback: number): number {
  const value = response.headers.get("X-Comments-Total")
  if (value === null) return fallback
  const total = Number(value)
  return Number.isSafeInteger(total) && total >= 0 ? total : fallback
}

export function useComments(endpoint: string, { enabled = true }: UseCommentsOptions = {}) {
  const [comments, setComments] = useState<Comment[]>([])
  const [draft, setDraft] = useState("")
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [totalCount, setTotalCount] = useState(0)
  const [error, setError] = useState("")
  const loadingRef = useRef(false)
  const loadedRef = useRef(false)

  useEffect(() => {
    loadingRef.current = false
    loadedRef.current = false
    queueMicrotask(() => {
      setComments([])
      setDraft("")
      setLoading(false)
      setLoaded(false)
      setSubmitting(false)
      setLoadingOlder(false)
      setNextCursor(null)
      setTotalCount(0)
      setError("")
    })
  }, [endpoint])

  const load = useCallback(async (signal?: AbortSignal) => {
    if (loadingRef.current || loadedRef.current) return

    loadingRef.current = true
    setLoading(true)
    setError("")
    try {
      const response = await fetch(endpoint, { signal })
      if (!response.ok) {
        const body = await response.json().catch(() => null) as { error?: string } | null
        throw new Error(body?.error ?? "Não foi possível carregar os comentários.")
      }

      const next = await response.json() as Comment[]
      setComments(next)
      setNextCursor(response.headers.get("X-Comments-Next-Cursor"))
      setTotalCount(commentTotalFromResponse(response, next.length))
      loadedRef.current = true
      setLoaded(true)
    } catch (error: unknown) {
      if (error instanceof DOMException && error.name === "AbortError") return
      setError(error instanceof Error ? error.message : "Não foi possível carregar os comentários.")
    } finally {
      loadingRef.current = false
      setLoading(false)
    }
  }, [endpoint])

  const loadOlder = useCallback(async () => {
    if (!nextCursor || loadingOlder) return
    setLoadingOlder(true)
    setError("")
    try {
      const separator = endpoint.includes("?") ? "&" : "?"
      const response = await fetch(`${endpoint}${separator}cursor=${encodeURIComponent(nextCursor)}`)
      if (!response.ok) {
        const body = await response.json().catch(() => null) as { error?: string } | null
        throw new Error(body?.error ?? "Não foi possível carregar comentários anteriores.")
      }
      const older = await response.json() as Comment[]
      setComments((current) => [
        ...older,
        ...current.filter((comment) => !older.some((item) => item._id === comment._id)),
      ])
      setNextCursor(response.headers.get("X-Comments-Next-Cursor"))
      setTotalCount((current) => commentTotalFromResponse(response, current))
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "Não foi possível carregar comentários anteriores.")
    } finally {
      setLoadingOlder(false)
    }
  }, [endpoint, loadingOlder, nextCursor])

  useEffect(() => {
    if (!enabled) return

    const controller = new AbortController()
    queueMicrotask(() => {
      void load(controller.signal)
    })

    return () => {
      controller.abort()
    }
  }, [enabled, load])

  const submit = useCallback(async (nextContent?: string) => {
    const content = (nextContent ?? draft).trim()
    if (!content || submitting) return

    setSubmitting(true)
    setError("")
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      })

      if (!response.ok) {
        const body = await response.json().catch(() => null) as { error?: string } | null
        throw new Error(body?.error ?? "Não foi possível publicar o comentário.")
      }

      const comment = await response.json() as Comment
      setComments((current) => [...current, comment])
      setTotalCount((current) => current + 1)
      loadedRef.current = true
      setLoaded(true)
      setDraft("")
      return true
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "Não foi possível publicar o comentário.")
      return false
    } finally {
      setSubmitting(false)
    }
  }, [draft, endpoint, submitting])

  const remove = useCallback(async (id: string) => {
    setError("")
    try {
      const response = await fetch(`/api/comments/by-id/${id}`, { method: "DELETE" })
      if (!response.ok) {
        const body = await response.json().catch(() => null) as { error?: string } | null
        throw new Error(body?.error ?? "Não foi possível excluir o comentário.")
      }
      setComments((current) => current.filter((comment) => comment._id !== id))
      setTotalCount((current) => Math.max(0, current - 1))
      return true
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "Não foi possível excluir o comentário.")
      return false
    }
  }, [])

  return {
    comments,
    draft,
    loading,
    loaded,
    totalCount,
    submitting,
    hasMore: Boolean(nextCursor),
    loadingOlder,
    error,
    setComments,
    setDraft,
    load,
    loadOlder,
    submit,
    remove,
  }
}
