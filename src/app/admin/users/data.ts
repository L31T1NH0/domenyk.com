import "server-only"

import { clerkClient } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";
import { getCommentCountsByAuthor } from "@/lib/db/comments";
import { isAdmin } from "@/lib/auth";
import { formatSiteDate } from "@/lib/datetime";
export const runtime = "nodejs";
export function roleFromMetadata(metadata: UserMetadata) {
    const role = metadata.role;
    return typeof role === "string" && role.trim() ? role : "membro";
}
export function formatJoinDate(value: number | Date | null | undefined) {
    if (!value)
        return "Sem data";
    return formatSiteDate(value, { day: "2-digit", month: "short", year: "numeric" });
}
type UserMetadata = Record<string, unknown>;
export async function loadAdminUsersPage() {
    if (!(await isAdmin()))
        notFound();
    const client = await clerkClient();
    const usersResponse = await client.users.getUserList({ limit: 100, orderBy: "-created_at" });
    const users = usersResponse.data;
    const commentCounts = await getCommentCountsByAuthor(users.map((user) => user.id));
    return {
        client,
        usersResponse,
        users,
        commentCounts
    };
}
