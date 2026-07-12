import type { Metadata } from "next"
import {
  getLocalizedPostMetadata,
  LocalizedPostPage,
} from "@/components/post/LocalizedPostPage"

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  return getLocalizedPostMetadata(slug, "pt")
}

export default async function PostPage({ params }: Props) {
  const { slug } = await params
  return <LocalizedPostPage slug={slug} locale="pt" />
}
