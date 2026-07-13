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

export default async function AdminUsersPage() {
  if (!(await isAdmin())) notFound()

  const client = await clerkClient()
  const usersResponse = await client.users.getUserList({ limit: 100, orderBy: "-created_at" })
  const users = usersResponse.data
  const commentCounts = await getCommentCountsByAuthor(users.map((user) => user.id))

  return (
    <>
      <header className="admin-page-header"><div><h1>Pessoas</h1><p>Contas do Clerk, papéis e atividade de comentários.</p></div></header>

      <section className="overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm dark:border-white/10 dark:bg-[#080808]">
        <div className="border-b border-neutral-200 px-4 py-3 dark:border-white/10">
          <p className="text-sm font-semibold">Todos os usuários</p>
          <p className="mt-0.5 text-xs text-neutral-500">{users.length} registros encontrados</p>
        </div>

        <div className="divide-y divide-neutral-100 dark:divide-white/10 md:hidden">
          {users.map((user) => {
            const email = user.emailAddresses.find((item) => item.id === user.primaryEmailAddressId)?.emailAddress
              ?? user.emailAddresses[0]?.emailAddress
              ?? "Sem email"
            const name = user.fullName ?? user.username ?? email
            const role = roleFromMetadata(user.publicMetadata as UserMetadata)
            const commentCount = commentCounts.get(user.id) ?? 0

            return (
              <article key={user.id} className="px-4 py-4">
                <div className="flex items-start gap-3">
                  {user.imageUrl ? (
                    <span className="block size-10 shrink-0 overflow-hidden rounded-full bg-neutral-100 dark:bg-white/10">
                      <img src={user.imageUrl} alt="" className="h-full w-full rounded-full object-cover" />
                    </span>
                  ) : (
                    <div className="grid size-10 shrink-0 place-items-center rounded-full bg-neutral-100 text-xs font-semibold text-neutral-500 dark:bg-white/10">
                      {name.slice(0, 1).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="min-w-0 break-words text-sm font-medium text-neutral-950 dark:text-neutral-100">{name}</h2>
                      <span className={[
                        "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                        role === "admin"
                          ? "bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300"
                          : role === "moderator"
                            ? "bg-sky-100 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300"
                            : "bg-neutral-100 text-neutral-600 dark:bg-white/10 dark:text-neutral-300",
                      ].join(" ")}>
                        {role}
                      </span>
                    </div>
                    <p className="mt-1 break-all text-xs text-neutral-500">{email}</p>
                    <p className="mt-1 break-all text-xs text-neutral-400">{user.id}</p>
                    <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <dt className="text-neutral-400">Comentários</dt>
                        <dd className="mt-0.5 tabular-nums text-neutral-600 dark:text-neutral-300">{commentCount}</dd>
                      </div>
                      <div className="text-right">
                        <dt className="text-neutral-400">Criado em</dt>
                        <dd className="mt-0.5 text-neutral-600 dark:text-neutral-300">{formatJoinDate(user.createdAt)}</dd>
                      </div>
                    </dl>
                  </div>
                </div>
              </article>
            )
          })}
          {users.length === 0 && (
            <div className="px-4 py-10 text-center text-sm text-neutral-500">Nenhum usuário encontrado.</div>
          )}
        </div>

        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-neutral-200 bg-neutral-50 text-xs font-medium uppercase tracking-wide text-neutral-500 dark:border-white/10 dark:bg-white/[0.03] dark:text-neutral-400">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">Usuário</th>
                <th scope="col" className="px-4 py-3 font-medium">Email</th>
                <th scope="col" className="px-4 py-3 font-medium">Papel</th>
                <th scope="col" className="px-4 py-3 font-medium text-right">Comentários</th>
                <th scope="col" className="px-4 py-3 font-medium">Criado em</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-white/10">
              {users.map((user) => {
                const email = user.emailAddresses.find((item) => item.id === user.primaryEmailAddressId)?.emailAddress
                  ?? user.emailAddresses[0]?.emailAddress
                  ?? "Sem email"
                const name = user.fullName ?? user.username ?? email
                const role = roleFromMetadata(user.publicMetadata as UserMetadata)
                const commentCount = commentCounts.get(user.id) ?? 0

                return (
                  <tr key={user.id} className="transition-colors hover:bg-neutral-50 dark:hover:bg-white/[0.03]">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {user.imageUrl ? (
                          <span className="block size-9 shrink-0 overflow-hidden rounded-full bg-neutral-100 dark:bg-white/10">
                            <img src={user.imageUrl} alt="" className="h-full w-full rounded-full object-cover" />
                          </span>
                        ) : (
                          <div className="grid size-9 shrink-0 place-items-center rounded-full bg-neutral-100 text-xs font-semibold text-neutral-500 dark:bg-white/10">
                            {name.slice(0, 1).toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="truncate font-medium text-neutral-950 dark:text-neutral-100">{name}</p>
                          <p className="mt-0.5 truncate text-xs text-neutral-500">{user.id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-neutral-500">{email}</td>
                    <td className="px-4 py-3">
                      <span className={[
                        "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                        role === "admin"
                          ? "bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300"
                          : role === "moderator"
                            ? "bg-sky-100 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300"
                            : "bg-neutral-100 text-neutral-600 dark:bg-white/10 dark:text-neutral-300",
                      ].join(" ")}>
                        {role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-neutral-500">{commentCount}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-neutral-500">{formatJoinDate(user.createdAt)}</td>
                  </tr>
                )
              })}
              {users.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-sm text-neutral-500">Nenhum usuário encontrado.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  )
}
