"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import type { SerializedPostSummary } from "@/lib/db/posts";
import type { SerializedTheme } from "@/lib/db/themes";
type Props = {
    theme?: SerializedTheme;
    posts: SerializedPostSummary[];
};
export function slugify(value: string) {
    return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
export function useThemeEditor({ theme, posts }: Props) {
    const router = useRouter();
    const [name, setName] = useState(theme?.name ?? "");
    const [slug, setSlug] = useState(theme?.slug ?? "");
    const [slugTouched, setSlugTouched] = useState(Boolean(theme));
    const [description, setDescription] = useState(theme?.description ?? "");
    const [active, setActive] = useState(theme?.active ?? false);
    const [postIds, setPostIds] = useState(theme?.postIds ?? []);
    const [query, setQuery] = useState("");
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const byId = useMemo(() => new Map(posts.map((post) => [post._id, post])), [posts]);
    const selectedPosts = postIds.flatMap((id) => {
        const post = byId.get(id);
        return post ? [post] : [];
    });
    const availablePosts = posts.filter((post) => !postIds.includes(post._id) && `${post.title} ${post.slug}`.toLowerCase().includes(query.trim().toLowerCase()));
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
        setSaving(true);
        setError("");
        const response = await fetch(theme ? `/api/admin/themes/${theme._id}` : "/api/admin/themes", {
            method: theme ? "PATCH" : "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, slug, description, active, postIds }),
        });
        const data = await response.json().catch(() => null) as {
            _id?: string;
            error?: string;
        } | null;
        setSaving(false);
        if (!response.ok)
            return setError(data?.error ?? "Não foi possível salvar o tema.");
        router.push(`/admin/temas/${data?._id ?? theme?._id}`);
        router.refresh();
    }
    async function remove() {
        if (!theme)
            return;
        const response = await fetch(`/api/admin/themes/${theme._id}`, { method: "DELETE" });
        if (!response.ok) {
            const message = "Não foi possível excluir o tema.";
            setError(message);
            throw new Error(message);
        }
        router.push("/admin/temas");
        router.refresh();
    }
    function changeName(value: string) {
        setName(value);
        if (!slugTouched) setSlug(slugify(value));
    }
    function changeSlug(value: string) {
        setSlugTouched(true);
        setSlug(slugify(value));
    }
    function addPost(id: string) {
        setPostIds(ids => [...ids, id]);
    }
    function removePost(id: string) {
        setPostIds(ids => ids.filter(postId => postId !== id));
    }
    return {
        changeName,
        changeSlug,
        addPost,
        removePost,
        router,
        name,
        setName,
        slug,
        setSlug,
        slugTouched,
        setSlugTouched,
        description,
        setDescription,
        active,
        setActive,
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
        availablePosts,
        move,
        save,
        remove
    };
}
