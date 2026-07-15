export type PostSeoFields = {
  title: string
  seoTitle?: string
  seoDescription?: string
  excerpt?: string
  subtitle?: string
}

export function postSeoTitle(post: Pick<PostSeoFields, "title" | "seoTitle">): string {
  return post.seoTitle?.trim() || post.title.trim()
}

export function postSeoDescription(
  post: Pick<PostSeoFields, "seoDescription" | "excerpt" | "subtitle">,
  fallback = ""
): string {
  return post.seoDescription?.trim()
    || post.excerpt?.trim()
    || post.subtitle?.trim()
    || fallback.trim()
}

export function isPostVersionIndexable(post: {
  published: boolean
  hiddenFromTimeline?: boolean
}): boolean {
  return post.published === true && post.hiddenFromTimeline !== true
}

export function preservedSlugAliases(
  currentSlug: string | undefined,
  existingAliases: string[] | undefined,
  nextSlug: string
): string[] {
  return Array.from(new Set([
    ...(existingAliases ?? []),
    ...(currentSlug && currentSlug !== nextSlug ? [currentSlug] : []),
  ])).filter((alias) => alias !== nextSlug)
}
