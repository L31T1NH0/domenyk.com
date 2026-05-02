import { renderMarkdown } from "@/lib/mdx"

type Props = {
  content: string
  className?: string
}

export async function PostContent({ content, className }: Props) {
  const html = await renderMarkdown(content)
  return (
    <div
      className={className}
      data-post-content
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
