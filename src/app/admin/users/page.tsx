import { clerkClient } from "@clerk/nextjs/server"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { notFound } from "next/navigation"
import { getCommentCountsByAuthor } from "@/lib/db/comments"
import { isAdmin } from "@/lib/auth"

export const runtime = "nodejs"

function roleFromMetadata(metadata: UserMetadata) {
  const role = metadata.role
  return typeof role === "string" && role.trim() ? role : "membro"
}

function formatJoinDate(value: number | Date | null | undefined) {
  if (!value) return "Sem data"
  return format(new Date(value), "dd MMM yyyy", { locale: ptBR })
}

type UserMetadata = Record<string, unknown>

function roleClass(role: string) {
  return `admin-role ${role === "admin" ? "is-admin" : role === "moderator" ? "is-moderator" : "is-member"}`
}

export default async function AdminUsersPage() {
  if (!(await isAdmin())) notFound()

  const client = await clerkClient()
  const usersResponse = await client.users.getUserList({ limit: 100, orderBy: "-created_at" })
  const users = usersResponse.data
  const commentCounts = await getCommentCountsByAuthor(users.map((user) => user.id))

  return (
    <>
      <header className="admin-page-header"><div><h1>Pessoas</h1><p>Contas do Clerk, papéis e atividade de comentários.</p></div></header>

      <section className="admin-list admin-users-list">
        <div className="admin-list-toolbar">
          <div><strong>Todos os usuários</strong><small>{users.length} registros encontrados</small></div>
        </div>

        <div className="admin-user-mobile-list">
          {users.map((user) => {
            const email = user.emailAddresses.find((item) => item.id === user.primaryEmailAddressId)?.emailAddress
              ?? user.emailAddresses[0]?.emailAddress
              ?? "Sem email"
            const name = user.fullName ?? user.username ?? email
            const role = roleFromMetadata(user.publicMetadata as UserMetadata)
            const commentCount = commentCounts.get(user.id) ?? 0

            return (
              <article key={user.id} className="admin-user-card">
                <div className="admin-user-card-main">
                  {user.imageUrl ? (
                    <span className="admin-person-avatar">
                      <img src={user.imageUrl} alt="" />
                    </span>
                  ) : (
                    <span className="admin-person-avatar admin-person-initial">
                      {name.slice(0, 1).toUpperCase()}
                    </span>
                  )}
                  <div className="admin-user-card-copy">
                    <div className="admin-person-name">
                      <h2>{name}</h2>
                      <span className={roleClass(role)}>{role}</span>
                    </div>
                    <p className="admin-person-email">{email}</p>
                    <p className="admin-person-id">{user.id}</p>
                    <dl className="admin-user-facts">
                      <div>
                        <dt>Comentários</dt>
                        <dd>{commentCount}</dd>
                      </div>
                      <div>
                        <dt>Criado em</dt>
                        <dd>{formatJoinDate(user.createdAt)}</dd>
                      </div>
                    </dl>
                  </div>
                </div>
              </article>
            )
          })}
          {users.length === 0 && (
            <div className="admin-empty">Nenhum usuário encontrado.</div>
          )}
        </div>

        <div className="admin-user-table-wrap">
          <table className="admin-user-table">
            <thead>
              <tr>
                <th scope="col">Usuário</th>
                <th scope="col">Email</th>
                <th scope="col">Papel</th>
                <th scope="col">Comentários</th>
                <th scope="col">Criado em</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => {
                const email = user.emailAddresses.find((item) => item.id === user.primaryEmailAddressId)?.emailAddress
                  ?? user.emailAddresses[0]?.emailAddress
                  ?? "Sem email"
                const name = user.fullName ?? user.username ?? email
                const role = roleFromMetadata(user.publicMetadata as UserMetadata)
                const commentCount = commentCounts.get(user.id) ?? 0

                return (
                  <tr key={user.id}>
                    <td>
                      <div className="admin-person-cell">
                        {user.imageUrl ? (
                          <span className="admin-person-avatar">
                            <img src={user.imageUrl} alt="" />
                          </span>
                        ) : (
                          <span className="admin-person-avatar admin-person-initial">
                            {name.slice(0, 1).toUpperCase()}
                          </span>
                        )}
                        <div>
                          <strong>{name}</strong>
                          <small>{user.id}</small>
                        </div>
                      </div>
                    </td>
                    <td>{email}</td>
                    <td><span className={roleClass(role)}>{role}</span></td>
                    <td className="admin-user-number">{commentCount}</td>
                    <td><time>{formatJoinDate(user.createdAt)}</time></td>
                  </tr>
                )
              })}
              {users.length === 0 && (
                <tr>
                  <td colSpan={5} className="admin-empty">Nenhum usuário encontrado.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  )
}
