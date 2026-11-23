import { PostComposer } from "../../PostComposer"
import { loadEditPostPage } from "./data"
export const metadata = { title: "Editar post" }
export default async function EditPostPage(props: Parameters<typeof loadEditPostPage>[0]) {
  const { post } = await loadEditPostPage(props)
  return <PostComposer post={post} />
}
