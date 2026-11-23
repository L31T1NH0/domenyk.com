import "server-only"

import { notFound } from "next/navigation";
import { getPosts, serializePostSummary } from "@/lib/db/posts";
import { getSeriesById, serializeSeries } from "@/lib/db/series";

export async function loadEditSeriesPage({ params }: {
    params: Promise<{
        id: string;
    }>;
}) {
    const { id } = await params;
    const [series, { posts }] = await Promise.all([
        getSeriesById(id),
        getPosts({ includeUnpublished: true, limit: 200 }),
    ]);
    if (!series)
        notFound();
    return {
        id,
        series: serializeSeries(series),
        posts: posts.map((post) => serializePostSummary(post, { includeUnpublishedTranslations: true }))
    };
}
