"use client"

import Link from "next/link"
import Image from "next/image"
import { useId, useState } from "react"
import { ChevronDownIcon } from "@heroicons/react/20/solid"
import type { TimelineUtilityRailData } from "@/lib/public-content-cache"
import type { TimelineArchiveItem } from "@/lib/db/timeline"

const monthNames = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
]

function itemCountLabel(count: number) {
  return `${count} ${count === 1 ? "item" : "itens"}`
}

type ArchiveLoadStatus = "idle" | "loading" | "ready" | "error"

function ArchiveItemResults({
  items,
  status,
  hasMore,
  searchQuery,
  loadMore,
}: {
  items: TimelineArchiveItem[]
  status: ArchiveLoadStatus
  hasMore: boolean
  searchQuery: string
  loadMore: () => Promise<void>
}) {
  return (
    <>
      {items.length > 0 && (
        <ol className="flex min-w-0 flex-col gap-1.5">
          {items.map((item) => (
            <li key={`${item.type}:${item.id}`} className="min-w-0">
              <Link
                href={item.href}
                prefetch={false}
                title={item.title}
                className="flex min-w-0 items-center gap-1.5 rounded-sm text-xs leading-5 text-neutral-600 outline-none hover:text-neutral-950 focus-visible:ring-2 focus-visible:ring-neutral-500 dark:text-[#A8A095] dark:hover:text-[#f1f1f1] dark:focus-visible:ring-neutral-300"
              >
                {item.cover && (
                  <Image
                    src={item.cover.url}
                    alt=""
                    width={36}
                    height={24}
                    sizes="36px"
                    className="h-6 w-9 shrink-0 rounded-[3px] object-cover !grayscale-0"
                  />
                )}
                <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">{item.title}</span>
              </Link>
            </li>
          ))}
        </ol>
      )}

      {status === "loading" && (
        <p role="status" className="py-1.5 text-center text-xs text-neutral-400 dark:text-[#77716a]">
          Carregando…
        </p>
      )}
      {status === "ready" && items.length === 0 && (
        <p className="py-1.5 text-center text-xs text-neutral-400 dark:text-[#77716a]">
          {searchQuery ? "Nenhum item nesta busca." : "Nenhum conteúdo."}
        </p>
      )}
      {status === "error" && (
        <button
          type="button"
          onClick={() => void loadMore()}
          className="mx-auto block min-h-8 rounded-sm px-1 text-xs text-neutral-600 underline decoration-neutral-400 underline-offset-2 outline-none hover:text-neutral-950 focus-visible:ring-2 focus-visible:ring-neutral-500 dark:text-[#A8A095] dark:hover:text-[#f1f1f1] dark:focus-visible:ring-neutral-300"
        >
          Tentar novamente
        </button>
      )}
      {status !== "loading" && status !== "error" && hasMore && (
        <button
          type="button"
          onClick={() => void loadMore()}
          className="mx-auto mt-1 block min-h-8 rounded-sm px-1 text-xs text-neutral-600 outline-none hover:text-neutral-950 focus-visible:ring-2 focus-visible:ring-neutral-500 dark:text-[#A8A095] dark:hover:text-[#f1f1f1] dark:focus-visible:ring-neutral-300"
        >
          Carregar mais
        </button>
      )}
    </>
  )
}

function ArchiveMonth({
  year,
  month,
  count,
  searchQuery,
  feedMode,
}: {
  year: number
  month: number
  count: number
  searchQuery: string
  feedMode: "all" | "posts" | "notes"
}) {
  const contentId = useId()
  const [isOpen, setIsOpen] = useState(false)
  const [items, setItems] = useState<TimelineArchiveItem[]>([])
  const [status, setStatus] = useState<ArchiveLoadStatus>("idle")
  const [hasMore, setHasMore] = useState(count > 0)

  async function loadMore() {
    if (status === "loading" || !hasMore) return
    setStatus("loading")

    try {
      const params = new URLSearchParams({
        year: String(year),
        month: String(month),
        offset: String(items.length),
        mode: feedMode,
      })
      if (searchQuery) params.set("q", searchQuery)
      const response = await fetch(`/api/archive?${params.toString()}`)
      const data = await response.json().catch(() => null) as {
        items?: TimelineArchiveItem[]
        hasMore?: boolean
        error?: string
      } | null
      if (!response.ok || !Array.isArray(data?.items)) {
        throw new Error(data?.error ?? "Não foi possível carregar o arquivo.")
      }

      setItems((current) => [
        ...current,
        ...data.items!.filter((item) => !current.some((existing) => existing.id === item.id && existing.type === item.type)),
      ])
      setHasMore(data.hasMore === true)
      setStatus("ready")
    } catch {
      setStatus("error")
    }
  }

  return (
    <div>
      <button
        type="button"
        aria-expanded={isOpen}
        aria-controls={contentId}
        onClick={() => {
          const nextOpen = !isOpen
          setIsOpen(nextOpen)
          if (nextOpen && status === "idle") void loadMore()
        }}
        className="flex min-h-8 w-full cursor-pointer items-center gap-1.5 rounded-sm text-[13px] leading-5 text-neutral-600 outline-none hover:text-neutral-950 focus-visible:ring-2 focus-visible:ring-neutral-500 dark:text-[#A8A095] dark:hover:text-[#f1f1f1] dark:focus-visible:ring-neutral-300"
      >
        <ChevronDownIcon
          aria-hidden
          className={`size-3.5 shrink-0 text-neutral-400 transition-transform duration-150 motion-reduce:transition-none dark:text-[#77716a] ${isOpen ? "rotate-0" : "-rotate-90"}`}
        />
        <span className="min-w-0 flex-1 text-left [overflow-wrap:anywhere]">{monthNames[month - 1]}</span>
        <span className="shrink-0 font-editorial-mono text-xs tabular-nums" title={itemCountLabel(count)}>
          {count}
        </span>
      </button>

      <div id={contentId} hidden={!isOpen} className="ml-4 mt-1.5 min-w-0">
        <ArchiveItemResults
          items={items}
          status={status}
          hasMore={hasMore}
          searchQuery={searchQuery}
          loadMore={loadMore}
        />
      </div>
    </div>
  )
}

function ArchiveCategory({
  category,
  searchQuery,
  feedMode,
}: {
  category: TimelineUtilityRailData["categories"][number]
  searchQuery: string
  feedMode: "all" | "posts" | "notes"
}) {
  const contentId = useId()
  const [isOpen, setIsOpen] = useState(false)
  const [items, setItems] = useState<TimelineArchiveItem[]>([])
  const [status, setStatus] = useState<ArchiveLoadStatus>("idle")
  const [hasMore, setHasMore] = useState(category.count > 0)

  async function loadMore() {
    if (status === "loading" || !hasMore) return
    setStatus("loading")

    try {
      const params = new URLSearchParams({
        category: category.slug,
        offset: String(items.length),
        mode: feedMode,
      })
      if (searchQuery) params.set("q", searchQuery)
      const response = await fetch(`/api/archive?${params.toString()}`)
      const data = await response.json().catch(() => null) as {
        items?: TimelineArchiveItem[]
        hasMore?: boolean
        error?: string
      } | null
      if (!response.ok || !Array.isArray(data?.items)) {
        throw new Error(data?.error ?? "Não foi possível carregar a categoria.")
      }

      setItems((current) => [
        ...current,
        ...data.items!.filter((item) => !current.some((existing) => existing.id === item.id)),
      ])
      setHasMore(data.hasMore === true)
      setStatus("ready")
    } catch {
      setStatus("error")
    }
  }

  return (
    <li className="min-w-0">
      <button
        type="button"
        aria-expanded={isOpen}
        aria-controls={contentId}
        onClick={() => {
          const nextOpen = !isOpen
          setIsOpen(nextOpen)
          if (nextOpen && status === "idle") void loadMore()
        }}
        className="flex min-h-8 w-full items-center gap-1.5 rounded-sm py-1 text-[13px] leading-5 text-neutral-600 outline-none hover:text-neutral-950 focus-visible:ring-2 focus-visible:ring-neutral-500 dark:text-[#9d968d] dark:hover:text-[#f1f1f1] dark:focus-visible:ring-neutral-300"
      >
        <ChevronDownIcon
          aria-hidden
          className={`size-3.5 shrink-0 text-neutral-400 transition-transform duration-150 motion-reduce:transition-none dark:text-[#77716a] ${isOpen ? "rotate-0" : "-rotate-90"}`}
        />
        <span className="min-w-0 flex-1 text-left [overflow-wrap:anywhere]">{category.name}</span>
        <span className="shrink-0 font-editorial-mono text-xs tabular-nums text-neutral-400 dark:text-[#77716a]">
          {category.count}
        </span>
      </button>
      <div id={contentId} hidden={!isOpen} className="ml-4 mt-1.5 min-w-0">
        <ArchiveItemResults
          items={items}
          status={status}
          hasMore={hasMore}
          searchQuery={searchQuery}
          loadMore={loadMore}
        />
      </div>
    </li>
  )
}

function ArchiveYear({
  archive,
  initiallyOpen,
  searchQuery,
  feedMode,
}: {
  archive: TimelineUtilityRailData["archives"][number]
  initiallyOpen: boolean
  searchQuery: string
  feedMode: "all" | "posts" | "notes"
}) {
  const contentId = useId()
  const [isOpen, setIsOpen] = useState(initiallyOpen)

  return (
    <div className="py-2.5">
      <button
        type="button"
        aria-expanded={isOpen}
        aria-controls={contentId}
        onClick={() => setIsOpen((current) => !current)}
        className="flex min-h-8 w-full cursor-pointer items-center gap-2 rounded-sm text-sm text-neutral-700 outline-none hover:text-neutral-950 focus-visible:ring-2 focus-visible:ring-neutral-500 dark:text-[#c2bbb1] dark:hover:text-[#f1f1f1] dark:focus-visible:ring-neutral-300"
      >
        <ChevronDownIcon
          aria-hidden
          className={`size-4 shrink-0 text-neutral-400 transition-transform duration-150 motion-reduce:transition-none dark:text-[#77716a] ${isOpen ? "rotate-0" : "-rotate-90"}`}
        />
        <span className="flex-1 text-left tabular-nums">{archive.year}</span>
        <span className="font-editorial-mono text-xs text-neutral-600 dark:text-[#77716a]">
          {archive.count}
        </span>
      </button>
      <div
        id={contentId}
        hidden={!isOpen}
        className="ml-5 mt-1.5 flex flex-col gap-1"
        aria-label={`Publicações de ${archive.year}`}
      >
        {archive.months.map(({ month, count }) => (
          <ArchiveMonth
            key={month}
            year={archive.year}
            month={month}
            count={count}
            searchQuery={searchQuery}
            feedMode={feedMode}
          />
        ))}
      </div>
    </div>
  )
}

export function TimelineUtilityRail({
  archives,
  categories,
  searchQuery,
  feedMode,
}: TimelineUtilityRailData & {
  searchQuery: string
  feedMode: "all" | "posts" | "notes"
}) {
  if (archives.length === 0 && categories.length === 0 && !searchQuery) return null

  return (
    <aside
      aria-label="Navegação complementar da timeline"
      className="home-timeline-utility-rail hidden min-w-0 min-[84rem]:absolute min-[84rem]:bottom-0 min-[84rem]:left-[calc(100%+1rem)] min-[84rem]:right-[calc(100%-67.5vw-9.2125rem)] min-[84rem]:top-0 min-[84rem]:block"
    >
      <div
        className="timeline-thread-scroll sticky top-4 max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-y-contain pr-1"
      >
        <div className="flex flex-col gap-9">
          <section aria-labelledby="timeline-archives-title">
            <h2
              id="timeline-archives-title"
              className="border-b border-neutral-200 pb-2.5 text-sm font-semibold text-neutral-700 dark:border-white/10 dark:text-[#d8d4ce]"
            >
              Arquivos
            </h2>
            {archives.length > 0 ? (
              <div className="divide-y divide-neutral-200 dark:divide-white/10">
                {archives.map((archive, index) => (
                  <ArchiveYear
                    key={archive.year}
                    archive={archive}
                    initiallyOpen={index === 0}
                    searchQuery={searchQuery}
                    feedMode={feedMode}
                  />
                ))}
              </div>
            ) : (
              <p className="py-3 text-[13px] leading-5 text-neutral-600 dark:text-[#A8A095]">
                {searchQuery ? "Nenhum item nesta busca." : "Nenhum conteúdo arquivado."}
              </p>
            )}
          </section>

          {categories.length > 0 && (
            <nav aria-labelledby="timeline-categories-title">
              <h2
                id="timeline-categories-title"
                className="border-b border-neutral-200 pb-2.5 text-sm font-semibold text-neutral-700 dark:border-white/10 dark:text-[#d8d4ce]"
              >
                Categorias
              </h2>
              <ul className="mt-2.5 flex flex-col gap-1">
                {categories.map((category) => (
                  <ArchiveCategory
                    key={category.slug}
                    category={category}
                    searchQuery={searchQuery}
                    feedMode={feedMode}
                  />
                ))}
              </ul>
            </nav>
          )}
        </div>
      </div>
    </aside>
  )
}
