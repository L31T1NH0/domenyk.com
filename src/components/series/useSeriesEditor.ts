"use client";
import { useMemo, useState } from "react";

import { useRouter } from "next/navigation";

import type { SerializedPostSummary } from "@/lib/db/posts";
import type { SerializedEditorialSeries } from "@/lib/db/series";
import { slugifyPostTitle } from "@/lib/post-locales";
type Props = {
    series?: SerializedEditorialSeries;
    posts: SerializedPostSummary[];
};
export function useSeriesEditor({ series, posts }: Props) {
    const router = useRouter();
    const [title, setTitle] = useState(series?.title ?? "");
    const [slug, setSlug] = useState(series?.slug ?? "");
    const [slugTouched, setSlugTouched] = useState(Boolean(series));
    const [description, setDescription] = useState(series?.description ?? "");
    const [published, setPublished] = useState(series?.published ?? false);
    const [postIds, setPostIds] = useState(series?.postIds ?? []);
    const [query, setQuery] = useState("");
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const byId = useMemo(() => new Map(posts.map((post) => [post._id, post])), [posts]);
    const selectedPosts = postIds.flatMap((id) => {
        const post = byId.get(id);
        return post ? [post] : [];
    });
    const normalizedQuery = query.trim().toLocaleLowerCase("pt-BR");
    const availablePosts = posts.filter((post) => (!postIds.includes(post._id)
        && `${post.title} ${post.slug}`.toLocaleLowerCase("pt-BR").includes(normalizedQuery)));
    const totalReadingTime = selectedPosts.reduce((total, post) => total + post.readingTimeMinutes, 0);
    function move(index: number, direction: -1 | 1) {
        const target = index + direction;
        if (target < 0 || target >= postIds.length)
            return;
        setPostIds((current) => {
            const next = [...current];
            [next[index], next[target]] = [next[target], next[index]];
            return next;
        });
    }
    async function save() {
        if (saving)
            return;
        setSaving(true);
        setError("");
        try {
            const response = await fetch(series ? `/api/admin/series/${series._id}` : "/api/admin/series", {
                method: series ? "PATCH" : "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ title, slug, description, published, postIds }),
            });
            const data = await response.json().catch(() => null) as {
                _id?: string;
                error?: string;
            } | null;
            if (!response.ok)
                throw new Error(data?.error ?? "Não foi possível salvar a série.");
            router.push(`/admin/series/${data?._id ?? series?._id}`);
            router.refresh();
        }
        catch (caughtError) {
            setError(caughtError instanceof Error ? caughtError.message : "Não foi possível salvar a série.");
        }
        finally {
            setSaving(false);
        }
    }
    async function remove() {
        if (!series)
            return;
        const response = await fetch(`/api/admin/series/${series._id}`, { method: "DELETE" });
        if (!response.ok) {
            const message = "Não foi possível excluir a série.";
            setError(message);
            throw new Error(message);
        }
        router.push("/admin/series");
        router.refresh();
    }
    function changeTitle(value: string) {
        setTitle(value);
        if (!slugTouched) setSlug(slugifyPostTitle(value));
    }
    function changeSlug(value: string) {
        setSlugTouched(true);
        setSlug(slugifyPostTitle(value));
    }
    function addPost(id: string) {
        setPostIds(ids => [...ids, id]);
    }
    function removePost(id: string) {
        setPostIds(ids => ids.filter(postId => postId !== id));
    }
    return {
        changeTitle,
        changeSlug,
        addPost,
        removePost,
        router,
        title,
        setTitle,
        slug,
        setSlug,
        slugTouched,
        setSlugTouched,
        description,
        setDescription,
        published,
        setPublished,
        postIds,
        setPostIds,
        query,
        setQuery,
        saving,
        setSaving,
        error,
        setError,
        byId,
        selectedPosts,
        normalizedQuery,
        availablePosts,
        totalReadingTime,
        move,
        save,
        remove
    };
}
