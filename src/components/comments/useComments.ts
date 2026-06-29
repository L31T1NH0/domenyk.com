"use client"

import { useCallback, useEffect, useRef, useState } from "react"

export type Comment = {
  _id: string
  authorName: string
  authorImageUrl: string
  authorId: string
  content: string
  contentHtml?: string
  createdAt: string
}

type UseCommentsOptions = {
  enabled?: boolean
}

export function useComments(endpoint: string, { enabled = true }: UseCommentsOptions = {}) {
  const [comments, setComments] = useState<Comment[]>([])
  const [draft, setDraft] = useState("")
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [submitting, setSubmitting] = useState(false)
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
    })
  }, [endpoint])

  const load = useCallback(async (signal?: AbortSignal) => {
    if (loadingRef.current || loadedRef.current) return

    loadingRef.current = true
    setLoading(true)
    try {
      const response = await fetch(endpoint, { signal })
      const next = response.ok ? await response.json() as Comment[] : []
      setComments(next)
      loadedRef.current = true
      setLoaded(true)
    } catch (error: unknown) {
      if (error instanceof DOMException && error.name === "AbortError") return
      setComments([])
    } finally {
      loadingRef.current = false
      setLoading(false)
    }
  }, [endpoint])

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
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      })

      if (response.ok) {
        const comment = await response.json() as Comment
        setComments((current) => [...current, comment])
        loadedRef.current = true
        setLoaded(true)
        setDraft("")
        return true
      }
      return false
    } finally {
      setSubmitting(false)
    }
  }, [draft, endpoint, submitting])

  const remove = useCallback(async (id: string) => {
    const response = await fetch(`/api/comments/by-id/${id}`, { method: "DELETE" })
    if (response.ok) {
      setComments((current) => current.filter((comment) => comment._id !== id))
    }
  }, [])

  return {
    comments,
    draft,
    loading,
    loaded,
    submitting,
    setComments,
    setDraft,
    load,
    submit,
    remove,
  }
}
