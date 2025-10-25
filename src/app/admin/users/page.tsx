import { clerkClient } from "@clerk/nextjs/server";
import { setRole, removeRole } from "./actions";
import { getMongoDb } from "../../../lib/mongo";

export default async function UsersAdmin() {
  const client = await clerkClient();
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
          <h1 className="text-2xl font-semibold tracking-tight">Usuarios</h1>
          <p className="text-sm text-zinc-400">Gerencie papeis e permissoes.</p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-900/60">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-zinc-900/40 text-zinc-400">
            <tr>
              <th className="px-4 py-2 font-medium">Nome</th>
              <th className="px-4 py-2 font-medium">Email</th>
              <th className="px-4 py-2 font-medium">Papel</th>
              <th className="px-4 py-2 font-medium">Contribuições</th>
              <th className="px-4 py-2 text-right font-medium">Acoes</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => {
              const primaryEmail = user.emailAddresses.find(
                (e) => e.id === user.primaryEmailAddressId
              )?.emailAddress;
              const role = (user.publicMetadata as any)?.role as string | undefined;

              return (
                <tr key={user.id} className="border-t border-zinc-800 hover:bg-zinc-900/40">
                  <td className="px-4 py-3">
                    <div className="text-zinc-100">
                      {user.firstName} {user.lastName}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-zinc-300">{primaryEmail}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-0.5 text-xs text-zinc-300">
                      {role ?? "-"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {(() => {
                      const comments = commentsMap.get(user.id) ?? 0;
                      const total = comments + 0 + 0;
                      return (
                        <div className="flex flex-col">
                          <span className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-0.5 text-xs text-zinc-300">
                            Total: {total}
                          </span>
                          <span className="mt-1 text-xs text-zinc-400">
                            Comentários: {comments} • Posts: 0 • Sugestões: 0
                          </span>
                        </div>
                      );
                    })()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <form action={setRole} className="inline">
                        <input type="hidden" value={user.id} name="id" />
                        <input type="hidden" value="admin" name="role" />
                        <button
                          type="submit"
                          className="rounded-md border border-zinc-700 bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-900 hover:bg-zinc-200"
                        >
                          Tornar Admin
                        </button>
                      </form>
                      <form action={setRole} className="inline">
                        <input type="hidden" value={user.id} name="id" />
                        <input type="hidden" value="moderator" name="role" />
                        <button
                          type="submit"
                          className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-200 hover:bg-zinc-800"
                        >
                          Tornar Moderator
                        </button>
                      </form>
                      <form action={removeRole} className="inline">
                        <input type="hidden" value={user.id} name="id" />
                        <button
                          type="submit"
                          className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-red-300 hover:bg-zinc-800"
                        >
                          Remover Papel
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              );
            })}
            {users.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-zinc-400">
                  Nenhum usuario encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
