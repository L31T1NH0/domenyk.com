import { PostComposer } from "../PostComposer"
import { loadNewPostPage } from "./data"
export const metadata = { title: "Novo post" }
export default async function NewPostPage(props: Parameters<typeof loadNewPostPage>[0]) {
  const { initialSeriesPublicId } = await loadNewPostPage(props)
  return <PostComposer initialSeriesPublicId={initialSeriesPublicId} />
}
