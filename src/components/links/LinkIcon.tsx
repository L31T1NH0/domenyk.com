"use client"

import { useState } from "react"
import { CalendarDaysIcon, ChatBubbleLeftRightIcon, HeartIcon, MapPinIcon, MicrophoneIcon, MusicalNoteIcon, PhotoIcon, RssIcon, ShoppingBagIcon, StarIcon, VideoCameraIcon, BookOpenIcon, CodeBracketIcon, DocumentTextIcon, EnvelopeIcon, GlobeAltIcon, LinkIcon as ChainIcon } from "@heroicons/react/24/outline"
import { linkFaviconURL, type LinkInput } from "@/lib/links"

export function LinkIcon({ name, url = "", className = "size-5" }: { name: LinkInput["icon"]; url?: string; className?: string }) {
  const [failedURL, setFailedURL] = useState<string | null>(null)
  const favicon = name === "favicon" ? linkFaviconURL(url) : null
  if (favicon && failedURL !== favicon) {
    // The resolver already returns a small image; no Next.js image optimization is needed.
    return <img src={favicon} alt="" width={20} height={20} className={`${className} object-contain`} referrerPolicy="no-referrer" onError={() => setFailedURL(favicon)} />
  }
  if (name === "favicon") return <GlobeAltIcon className={className} aria-hidden="true" />
  const icons = { link: ChainIcon, document: DocumentTextIcon, mail: EnvelopeIcon, code: CodeBracketIcon, globe: GlobeAltIcon, book: BookOpenIcon, music: MusicalNoteIcon, podcast: MicrophoneIcon, photo: PhotoIcon, video: VideoCameraIcon, chat: ChatBubbleLeftRightIcon, calendar: CalendarDaysIcon, location: MapPinIcon, shop: ShoppingBagIcon, heart: HeartIcon, star: StarIcon, rss: RssIcon }
  if (name in icons) {
    const Icon = icons[name as keyof typeof icons]
    return <Icon className={className} aria-hidden="true" />
  }
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="none">
      {name === "threads" && <path d="M19.5 7.5C18.3 3.8 15.8 2 12 2 6.1 2 3.5 6 3.5 12s3 10 8.5 10c4.7 0 8-2.4 8-6.4 0-3.4-2.7-5.8-6.8-5.8-3.2 0-5.2 1.4-5.2 3.7 0 1.9 1.4 3.1 3.6 3.1 3.1 0 4.8-2.4 4.8-5.6 0-3.1-1.5-5-4.4-5-1.8 0-3.1.8-3.8 2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />}
      {name === "whatsapp" && <><path d="m3 21 1.5-5A9 9 0 1 1 8 20Z" stroke="currentColor" strokeWidth="1.6" /><path d="m8 7 2 3-1 1c1 2 2 3 4 4l1-1 3 2c-1 4-10-1-11-6 0-2 1-3 2-3Z" fill="currentColor" /></>}
      {name === "telegram" && <><path d="m3 11 18-7-4 17-6-5-3 3v-6Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /><path d="m8 13 9-6-6 9" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /></>}
      {name === "instagram" && <g stroke="currentColor" strokeWidth="1.6"><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.4" cy="6.6" r=".9" fill="currentColor" stroke="none" /></g>}
      {name === "twitter" && <path fill="currentColor" d="M23 4.6a9.4 9.4 0 0 1-2.6.7 4.6 4.6 0 0 0 2-2.5 9.2 9.2 0 0 1-2.9 1.1 4.6 4.6 0 0 0-7.9 4.2A13 13 0 0 1 2.2 3.3a4.6 4.6 0 0 0 1.4 6.1A4.6 4.6 0 0 1 1.5 9v.1a4.6 4.6 0 0 0 3.7 4.5 4.6 4.6 0 0 1-2.1.1 4.6 4.6 0 0 0 4.3 3.2A9.2 9.2 0 0 1 1.7 19a9.4 9.4 0 0 1-1.1-.1A13 13 0 0 0 7.7 21c8.5 0 13.1-7 13.1-13.1v-.6A9.4 9.4 0 0 0 23 4.6Z" />}
      {name === "github" && <path fill="currentColor" d="M12 .8a11.3 11.3 0 0 0-3.6 22c.6.1.8-.2.8-.6v-2.1c-3.1.7-3.8-1.3-3.8-1.3-.5-1.3-1.3-1.6-1.3-1.6-1-.7.1-.7.1-.7 1.1.1 1.7 1.1 1.7 1.1 1 1.7 2.6 1.2 3.3.9.1-.7.4-1.2.7-1.5-2.5-.3-5.2-1.3-5.2-5.6 0-1.2.4-2.3 1.2-3.1-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.1 1.2a10.7 10.7 0 0 1 5.7 0c2.2-1.5 3.1-1.2 3.1-1.2.6 1.6.2 2.8.1 3.1.8.9 1.2 1.9 1.2 3.1 0 4.3-2.6 5.3-5.2 5.6.4.4.8 1 .8 2.1v3.2c0 .4.2.7.8.6A11.3 11.3 0 0 0 12 .8Z" />}
      {name === "youtube" && <><rect x="2" y="5" width="20" height="14" rx="4" stroke="currentColor" strokeWidth="1.6" /><path d="m10 9 5 3-5 3V9Z" fill="currentColor" /></>}
    </svg>
  )
}
