"use client"

import { ExpandableText } from "@/components/text/ExpandableText"
import type { Comment } from "@/components/comments/useComments"

type Props = {
  comment: Comment
  maxLines: number
  className?: string
  whiteSpace?: "normal" | "pre-wrap"
}

export function CommentContent({ comment, maxLines, className = "", whiteSpace = "normal" }: Props) {
  if (comment.contentHtml) {
    return (
      <div
        className={`note-content comment-content ${className}`}
        dangerouslySetInnerHTML={{ __html: comment.contentHtml }}
      />
    )
  }

  return (
    <ExpandableText
      text={comment.content}
      maxLines={maxLines}
      whiteSpace={whiteSpace}
      className={className}
    />
  )
}
