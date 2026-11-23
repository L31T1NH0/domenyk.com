export const runtime = "nodejs"

import { loadAdminUsersPage, roleFromMetadata, formatJoinDate } from "./data"
import { PeopleWorkspace } from "./PeopleWorkspace"
export const metadata = { title: "Pessoas" }
export default async function AdminUsersPage() {
  const { users, commentCounts } = await loadAdminUsersPage()
  return <PeopleWorkspace people={users.map(user => {
    const email = user.emailAddresses.find(address => address.id === user.primaryEmailAddressId)?.emailAddress ?? user.emailAddresses[0]?.emailAddress ?? "Sem e-mail"
    return { id: user.id, name: user.fullName ?? user.username ?? email, email, image: user.imageUrl, role: roleFromMetadata(user.publicMetadata), comments: commentCounts.get(user.id) ?? 0, joined: formatJoinDate(user.createdAt) }
  })} />
}
