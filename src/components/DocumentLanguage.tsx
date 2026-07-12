"use client"

import { useEffect } from "react"

export function DocumentLanguage({ language }: { language: string }) {
  useEffect(() => {
    document.documentElement.lang = language
    return () => {
      document.documentElement.lang = "pt-BR"
    }
  }, [language])

  return null
}
