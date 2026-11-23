import "server-only"

import { getPosts, serializePostSummary } from "@/lib/db/posts";

export async function loadNewSeriesPage() {
    const { posts } = await getPosts({ includeUnpublished: true, limit: 200 });
    return {
        posts: posts.map((post) => serializePostSummary(post, { includeUnpublishedTranslations: true }))
    };
}
