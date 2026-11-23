import "server-only"

import { notFound } from "next/navigation";
import { getPosts, serializePostSummary } from "@/lib/db/posts";
import { getThemeById, serializeTheme } from "@/lib/db/themes";

export async function loadEditThemePage({ params }: {
    params: Promise<{
        id: string;
    }>;
}) {
    const { id } = await params;
    const [theme, { posts }] = await Promise.all([getThemeById(id), getPosts({ includeUnpublished: true, limit: 200 })]);
    if (!theme)
        notFound();
    return {
        id,
        theme: serializeTheme(theme),
        posts: posts.map((post) => serializePostSummary(post, { includeUnpublishedTranslations: true }))
    };
}
