import "server-only"

import { notFound } from "next/navigation";

import { getPostById } from "@/lib/db/posts";
import { getThemesForPost } from "@/lib/db/themes";
import { descriptionFromMarkdown } from "@/lib/seo";

import { formatSiteDate } from "@/lib/datetime";
import { getGoAdminPost, getGoAdminPostThemes, usesGoAdmin } from "@/lib/go-admin-posts";
export function date(value: Date) {
    return formatSiteDate(value, { dateStyle: "long", timeStyle: "short", hourCycle: "h23" });
}
export async function loadAdminPostPage({ params }: {
    params: Promise<{
        id: string;
    }>;
}) {
    const { id } = await params;
    const post = usesGoAdmin() ? await getGoAdminPost(id) : await getPostById(id);
    if (!post)
        notFound();
    const themes = usesGoAdmin() ? await getGoAdminPostThemes(id) : await getThemesForPost(post._id);
    const summary = post.excerpt || post.subtitle || descriptionFromMarkdown(post.content);
    const seoReady = Boolean(post.seoTitle?.trim() && post.seoDescription?.trim());
    const indexable = post.published && post.hiddenFromTimeline !== true;
    return {
        id,
        post,
        themes,
        summary,
        seoReady,
        indexable
    };
}
