import { PostEditor } from "@/components/editor/PostEditor"

export default async function NewPostPage({ searchParams }: { searchParams: Promise<{ series?: string | string[] }> }) {
  const value = (await searchParams).series
  const initialSeriesPublicId = (Array.isArray(value) ? value[0] : value)?.slice(0, 80) ?? ""
  return <PostEditor initialSeriesPublicId={initialSeriesPublicId} />
}
