"use client"

import Link from "next/link"
import { useEffect, useRef, useState, type ReactNode } from "react"
import { ArrowUpRightIcon } from "@heroicons/react/24/outline"
import type { LinkContent, LinkPageData } from "@/lib/link-page"
import type { SiteLink } from "@/lib/links"
import { LinkIcon } from "./LinkIcon"
import { MusicCard } from "./MusicCard"
import styles from "./LinksPageView.module.css"

function ContentLink({ kind, id, url, track, children, className }: { kind: LinkContent["kind"]; id: string; url: string; track: boolean; children: ReactNode; className?: string }) {
  function clicked() {
    if (!track) return
    const body = JSON.stringify({ kind, id })
    if (!navigator.sendBeacon?.("/api/links/click", new Blob([body], { type: "application/json" }))) void fetch("/api/links/click", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => undefined)
  }
  return <Link href={url} target={track ? undefined : "_blank"} rel={track ? undefined : "noopener noreferrer"} onClick={clicked} onAuxClick={event => { if (event.button === 1) clicked() }} className={className}>{children}</Link>
}

export function LinkContentCard({ item, track = true, featured = false }: { item: LinkContent; track?: boolean; featured?: boolean }) {
  const reading = item.kind !== "link"
  const vertical = featured || reading
  const description = item.kind === "note" ? item.content : item.description
  const fillsCard = featured || (reading && Boolean(item.cover))
  const descriptionRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const element = descriptionRef.current
    if (!fillsCard || !element) return
    const measure = () => {
      const lineHeight = Number.parseFloat(getComputedStyle(element).lineHeight)
      const footer = element.nextElementSibling
      if (lineHeight > 0 && footer) {
        const available = footer.getBoundingClientRect().top - element.getBoundingClientRect().top
        element.style.setProperty("--description-lines", String(Math.max(1, Math.floor(available / lineHeight))))
      }
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    if (element.parentElement) observer.observe(element.parentElement)
    if (element.previousElementSibling) observer.observe(element.previousElementSibling)
    return () => observer.disconnect()
  }, [fillsCard, description])

  return <ContentLink kind={item.kind} id={item.id} url={item.url} track={track} className={`flex h-full overflow-hidden rounded-xl border border-neutral-200 transition-colors hover:border-neutral-400 focus-visible:outline-2 focus-visible:outline-offset-4 dark:border-white/15 dark:hover:border-white/40 ${vertical ? styles.featuredCard : "items-center"}`}>
    {item.cover && <img src={item.cover} alt={item.coverAlt} loading="lazy" className={vertical ? styles.contentCover : "aspect-square w-20 shrink-0 self-stretch object-cover grayscale-0"} />}
    <span className={`flex min-w-0 flex-1 flex-col ${vertical ? styles.featuredCopy : "justify-center p-4"}`}>
      {reading && <span className={styles.featuredLabel}>{item.kind === "note" ? "Nota" : "Artigo"}</span>}
      <span className={`break-words font-semibold leading-snug ${vertical ? styles.featuredTitle : "text-sm"}`}>{item.title}</span>
      {description && <span ref={descriptionRef} className={`mt-2 break-words text-neutral-600 dark:text-neutral-400 ${fillsCard ? styles.fillingDescription : "line-clamp-3"} ${vertical ? styles.featuredDescription : "text-xs leading-relaxed"} ${item.kind === "note" ? styles.noteDescription : ""}`}>{description}</span>}
      {reading && <span className={styles.continueReading}>Continuar lendo</span>}
    </span>
  </ContentLink>
}

function FeaturedCarousel({ heading, items, track }: { heading: string; items: LinkContent[]; track: boolean }) {
  const container = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(0)
  function go(index: number) {
    const track = container.current
    const slide = track?.children[index] as HTMLElement | undefined
    if (!track || !slide) return
    track.scrollTo({ left: track.scrollLeft + slide.getBoundingClientRect().left - track.getBoundingClientRect().left - track.clientLeft, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" })
  }
  if (!items.length) return null
  return <section aria-label={heading || "Destaques"} aria-roledescription="carrossel" className={`min-w-0 ${styles.carousel}`}>
    <span className="sr-only" aria-live="polite">{active + 1} de {items.length}</span>
    <div ref={container} tabIndex={0} aria-label="Navegue pelos destaques" className={`flex snap-x snap-mandatory gap-4 overflow-x-auto overscroll-x-contain focus-visible:outline-2 focus-visible:outline-offset-4 ${styles.track}`} onKeyDown={event => {
      if (event.target !== event.currentTarget) return
      if (event.key === "ArrowRight") { event.preventDefault(); go(Math.min(items.length - 1, active + 1)) }
      if (event.key === "ArrowLeft") { event.preventDefault(); go(Math.max(0, active - 1)) }
    }} onScroll={() => {
      const element = container.current
      if (element) setActive(Math.max(0, Math.min(items.length - 1, Math.round(element.scrollLeft / ((element.firstElementChild as HTMLElement).offsetWidth + 16)))))
    }}>
      {items.map((item, index) => <div key={`${item.kind}:${item.id}`} role="group" aria-roledescription="slide" aria-label={`${index + 1} de ${items.length}`} className={`min-w-0 shrink-0 snap-start ${styles.slide}`}><LinkContentCard item={item} featured track={track} /></div>)}
    </div>
    {items.length > 1 && <div className={`flex justify-center ${styles.indicators}`}>{items.map((item, index) => <button key={`${item.kind}:${item.id}`} type="button" aria-label={`Ver destaque ${index + 1}: ${item.title}`} aria-current={index === active ? "true" : undefined} onClick={() => go(index)} className={`grid place-items-center ${styles.indicator}`}><span className={`${styles.dot} ${index === active ? styles.activeDot : ""}`} /></button>)}</div>}
  </section>
}

export function LinksPageView({ data, links, preview = false }: { data: LinkPageData; links: SiteLink[]; preview?: boolean }) {
  const settings = data.settings
  const [now] = useState(() => Date.now())
  if (!settings && !links.length) return <p className="py-8 text-sm text-neutral-500">A página de links ainda não foi configurada.</p>
  const sections = settings?.sections ?? [...new Set(links.map(link => link.section))].map(id => ({ id, title: "", layout: "row" }))
  const visible = links.filter(link => link.published && (!link.startsAt || Date.parse(link.startsAt) <= now) && (!link.endsAt || Date.parse(link.endsAt) > now))
  function renderSection(section: (typeof sections)[number]) {
    const items = visible.filter(link => link.section === section.id).sort((a, b) => a.order - b.order)
    if (!items.length) return null
    return <section key={section.id} className={styles.linkSection} aria-labelledby={section.title ? `links-section-${section.id}` : undefined}>
      {section.title && <h2 id={`links-section-${section.id}`} className="mb-2 text-xs font-semibold uppercase tracking-[.1em]">{section.title}</h2>}
      <ul className={section.layout === "cards" ? "grid grid-cols-1 gap-3 sm:grid-cols-2" : "flex flex-wrap gap-2.5"}>
        {items.map(link => <li key={link.id} className={section.layout === "cards" ? "min-w-0" : "shrink-0"}>
          {section.layout === "row" ? <ContentLink kind="link" id={link.id} url={link.url} track={!preview} className="grid size-12 place-items-center rounded-lg border border-neutral-200 transition-colors hover:border-neutral-400 focus-visible:outline-2 focus-visible:outline-offset-4 dark:border-white/15 dark:hover:border-white/40">
            <LinkIcon name={link.icon} url={link.url} className="size-5" />
            <span className="sr-only">{link.title}</span>
          </ContentLink> : link.appearance === "image" && link.cover ? <LinkContentCard item={{ kind: "link", id: link.id, title: link.title, description: link.description, url: link.url, cover: link.cover, coverAlt: link.coverAlt, publishedAt: "" }} track={!preview} /> :
            <ContentLink kind="link" id={link.id} url={link.url} track={!preview} className="group flex h-full min-h-12 items-center gap-3 rounded-lg border border-neutral-200 px-3.5 py-3 transition-colors hover:border-neutral-400 focus-visible:outline-2 focus-visible:outline-offset-4 dark:border-white/15 dark:hover:border-white/40">
              <LinkIcon name={link.icon} url={link.url} className="size-[18px] shrink-0" />
              <span className="min-w-0 flex-1"><span className="block break-words text-sm font-medium">{link.title}</span>{link.appearance !== "simple" && link.description && <span className="mt-1 block break-words text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">{link.description}</span>}</span>
              <ArrowUpRightIcon className="size-3.5 shrink-0 text-neutral-500" aria-hidden="true" />
            </ContentLink>}
        </li>)}
      </ul>
    </section>
  }
  const social = sections.filter(section => section.id === "social")
  const remaining = sections.filter(section => !["social", "contact", "contato"].includes(section.id))
  return <div className={styles.page} data-public-links={!preview || undefined}>
    {(settings?.heading || settings?.intro) && <header className={styles.hero}>
      <img src="/images/links/portrait-photoshop.png" width={220} height={164} alt="Retrato de Domenyk" fetchPriority="high" className={styles.portrait} />
      {settings.heading && <h1 className={styles.heading}>{settings.heading}</h1>}
      {settings.intro && <p className={styles.intro}>{settings.intro}</p>}
    </header>}
    {social.length > 0 && <div className={styles.social}>{social.map(renderSection)}</div>}
    <FeaturedCarousel key={data.featured.map(item => `${item.kind}:${item.id}`).join(",")} heading={settings?.featuredHeading || ""} items={data.featured} track={!preview} />
    {!preview && <MusicCard />}
    <div className={styles.sections}>{remaining.map(renderSection)}</div>
    {data.readings.length > 0 && <section className={styles.readings} aria-label={settings?.readingsHeading || "Leituras"}>
      {settings?.readingsHeading && <h2 className="mb-2 text-xs font-semibold uppercase tracking-[.1em]">{settings?.readingsHeading}</h2>}
      <ul className="flex flex-wrap gap-3">{data.readings.map(item => <li key={`${item.kind}:${item.id}`} className="min-w-0 max-w-full"><LinkContentCard item={item} track={!preview} /></li>)}</ul>
    </section>}
  </div>
}
