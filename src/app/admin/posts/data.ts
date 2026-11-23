import "server-only";

import { getPosts, serializePostSummary } from "@/lib/db/posts";
import { getGoAdminPosts, usesGoAdmin } from "@/lib/go-admin-posts";
export async function loadAdminPostsPage() {
    const posts = usesGoAdmin() ? await getGoAdminPosts() : (await getPosts({ includeUnpublished: true, limit: 100 })).posts;
    const serializedPosts = posts.map((post) => (serializePostSummary(post, { includeUnpublishedTranslations: true })));
    return {
        posts: serializedPosts,
        serializedPosts
    };
}
