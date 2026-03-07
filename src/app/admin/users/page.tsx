import { notFound } from "next/navigation";
import { setRole, removeRole } from "./actions";
import { getMongoDb } from "../../../lib/mongo";
import { getClerkServerClient } from "../../../lib/clerk-server";
import { resolveAdminStatus } from "../../../lib/admin";

export const runtime = "nodejs";

export default async function UsersAdmin() {
  const { isAdmin } = await resolveAdminStatus();
  if (!isAdmin) {
    notFound();
  }

  const client = await getClerkServerClient();
  const users = (await client.users.getUserList()).data;

  // Aggregate contributions (comments only for now)
  const db = await getMongoDb();
  const authComments = db.collection("auth-comments");
  const userIds = users.map((u) => u.id);
  const contribAgg = await authComments
    .aggregate<{ _id: string; comments: number }>([
      { $match: { userId: { $in: userIds } } },
      { $group: { _id: "$userId", comments: { $sum: 1 } } },
    ])
    .toArray();
  const commentsMap = new Map(contribAgg.map((c) => [c._id, c.comments]));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-[#f1f1f1]">Usuários</h1>
          <p className="text-sm text-[#A8A095]">Gerencie papéis e permissões.</p>
        </div>
      </div>

      <div className="border border-white/8 rounded-lg overflow-hidden">
        <table className="min-w-full text-left text-xs">
          <thead className="border-b border-white/6">
            <tr>
              <th className="px-4 py-2.5 font-bold uppercase tracking-[0.14em] text-[#A8A095]">Nome</th>
              <th className="px-4 py-2.5 font-bold uppercase tracking-[0.14em] text-[#A8A095]">Email</th>
              <th className="px-4 py-2.5 font-bold uppercase tracking-[0.14em] text-[#A8A095]">Papel</th>
              <th className="px-4 py-2.5 font-bold uppercase tracking-[0.14em] text-[#A8A095]">Comentários</th>
              <th className="px-4 py-2.5 font-bold uppercase tracking-[0.14em] text-[#A8A095] text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/6">
            {users.map((user) => {
              const primaryEmail = user.emailAddresses.find(
                (e) => e.id === user.primaryEmailAddressId
              )?.emailAddress;
              const role = (user.publicMetadata as any)?.role as string | undefined;
              const comments = commentsMap.get(user.id) ?? 0;

              return (
                <tr key={user.id} className="hover:bg-white/2 transition-colors">
                  <td className="px-4 py-3 text-[#f1f1f1] font-medium">
                    {user.firstName} {user.lastName}
                  </td>
                  <td className="px-4 py-3 text-[#A8A095]">{primaryEmail}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                        role === "admin"
                          ? "border-[#E00070]/40 bg-[#E00070]/10 text-[#E00070]"
                          : role === "moderator"
                            ? "border-white/20 bg-white/5 text-[#f1f1f1]"
                            : "border-white/10 text-[#A8A095]"
                      }`}
                    >
                      {role ?? "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3 tabular-nums text-[#A8A095]">{comments}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <form action={setRole} className="inline">
                        <input type="hidden" value={user.id} name="id" />
                        <input type="hidden" value="admin" name="role" />
                        <button
                          type="submit"
                          className="rounded-md bg-[#E00070] px-3 py-1.5 text-xs font-medium text-white hover:opacity-80 transition-opacity"
                        >
                          Admin
                        </button>
                      </form>
                      <form action={setRole} className="inline">
                        <input type="hidden" value={user.id} name="id" />
                        <input type="hidden" value="moderator" name="role" />
                        <button
                          type="submit"
                          className="rounded-md border border-white/10 px-3 py-1.5 text-xs text-[#A8A095] hover:border-white/20 hover:text-[#f1f1f1] transition-colors"
                        >
                          Moderador
                        </button>
                      </form>
                      <form action={removeRole} className="inline">
                        <input type="hidden" value={user.id} name="id" />
                        <button
                          type="submit"
                          className="rounded-md border border-white/10 px-3 py-1.5 text-xs text-red-400 hover:border-red-400/30 hover:bg-red-400/5 transition-colors"
                        >
                          Remover
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              );
            })}
            {users.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-[#A8A095]">
                  Nenhum usuário encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
