"use client";

import { useMemo, useState } from "react";

import type { SerializedPostSummary } from "@/lib/db/posts";
import { isTranslationRevisionStale, TRANSLATION_LOCALES } from "@/lib/post-locales";
import { formatSiteDate, siteDateKey } from "@/lib/datetime";
type Props = {
    posts: SerializedPostSummary[];
};
type StatusFilter = "all" | "published" | "draft";
type VisibilityFilter = "all" | "timeline" | "hidden";
type ColumnKey = "status" | "date" | "views" | "reading" | "style";
export function formatDate(value?: string) {
    if (!value)
        return "Sem data";
    return formatSiteDate(value, { day: "2-digit", month: "short", year: "numeric" });
}
export function postMatchesQuery(post: SerializedPostSummary, query: string) {
    const normalized = query.trim().toLowerCase();
    if (!normalized)
        return true;
    return [
        post.title,
        post.slug,
        post.publicId,
        post.excerpt,
        ...TRANSLATION_LOCALES.flatMap((locale) => {
            const translation = post.translations?.[locale];
            return translation ? [translation.title, translation.excerpt, translation.subtitle, ...(translation.tags ?? [])] : [];
        }),
        ...post.tags,
    ]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(normalized));
}
export function translationStatuses(post: SerializedPostSummary) {
    const originalUpdatedAt = post.originalContentUpdatedAt ?? post.updatedAt;
    return TRANSLATION_LOCALES.map(locale => {
        const translation = post.translations?.[locale];
        return {
            locale,
            exists: Boolean(translation),
            published: translation?.published === true,
            stale: translation ? isTranslationRevisionStale(translation.sourceUpdatedAt, originalUpdatedAt) : false,
        };
    });
}
export function usePostsTable({ posts: initial }: Props) {
    const [posts, setPosts] = useState(initial);
    const [selected, setSelected] = useState<Record<string, boolean>>({});
    const [query, setQuery] = useState("");
    const [status, setStatus] = useState<StatusFilter>("all");
    const [visibility, setVisibility] = useState<VisibilityFilter>("all");
    const [showConfig, setShowConfig] = useState(false);
    const [busyAction, setBusyAction] = useState<string | null>(null);
    const [actionError, setActionError] = useState("");
    const [visibleColumns, setVisibleColumns] = useState<Record<ColumnKey, boolean>>({
        status: true,
        date: true,
        views: true,
        reading: true,
        style: false,
    });
    const filteredPosts = useMemo(() => {
        return posts.filter((post) => {
            if (!postMatchesQuery(post, query))
                return false;
            if (status === "published" && !post.published)
                return false;
            if (status === "draft" && post.published)
                return false;
            if (visibility === "timeline" && post.hiddenFromTimeline === true)
                return false;
            if (visibility === "hidden" && post.hiddenFromTimeline !== true)
                return false;
            return true;
        });
    }, [posts, query, status, visibility]);
    const selectedIds = useMemo(() => Object.keys(selected).filter((id) => selected[id]), [selected]);
    const allFilteredSelected = filteredPosts.length > 0 && filteredPosts.every((post) => selected[post._id]);
    function setPostSelected(id: string, checked: boolean) {
        setSelected((prev) => ({ ...prev, [id]: checked }));
    }
    function toggleFilteredSelection() {
        setSelected((prev) => {
            const next = { ...prev };
            for (const post of filteredPosts)
                next[post._id] = !allFilteredSelected;
            return next;
        });
    }
    async function patchPost(id: string, body: Record<string, unknown>) {
        const res = await fetch(`/api/admin/posts/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        });
        if (!res.ok)
            throw new Error("Não foi possível atualizar o post.");
    }
    async function togglePostBoolean(id: string, key: "published" | "pinned", current: boolean) {
        setActionError("");
        try {
            await patchPost(id, { [key]: !current });
            setPosts((prev) => prev.map((post) => (post._id === id ? { ...post, [key]: !current } : post)));
        }
        catch (err) {
            setActionError(err instanceof Error ? err.message : "Não foi possível atualizar o post.");
        }
    }
    function togglePublish(post: SerializedPostSummary) {
        void togglePostBoolean(post._id, "published", post.published);
    }
    function togglePin(post: SerializedPostSummary) {
        void togglePostBoolean(post._id, "pinned", post.pinned);
    }
    async function hideFromTimeline(ids: string[]) {
        setBusyAction("hide");
        setActionError("");
        try {
            await Promise.all(ids.map((id) => patchPost(id, { hiddenFromTimeline: true })));
            setPosts((prev) => prev.map((post) => (ids.includes(post._id) ? { ...post, hiddenFromTimeline: true } : post)));
            setSelected({});
        }
        catch (err) {
            setActionError(err instanceof Error ? err.message : "Não foi possível ocultar os posts.");
        }
        finally {
            setBusyAction(null);
        }
    }
    async function remove(ids: string[]) {
        setBusyAction("delete");
        setActionError("");
        try {
            const responses = await Promise.all(ids.map((id) => fetch(`/api/admin/posts/${id}`, { method: "DELETE" })));
            if (responses.some((res) => !res.ok))
                throw new Error("Não foi possível deletar todos os posts.");
            setPosts((prev) => prev.filter((post) => !ids.includes(post._id)));
            setSelected({});
        }
        catch (err) {
            const message = err instanceof Error ? err.message : "Não foi possível deletar os posts.";
            setActionError(message);
            throw new Error(message);
        }
        finally {
            setBusyAction(null);
        }
    }
    async function download(ids: string[]) {
        setBusyAction("download");
        setActionError("");
        try {
            const res = await fetch("/api/admin/posts/download", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ids }),
            });
            if (!res.ok)
                throw new Error("Não foi possível exportar os posts.");
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const anchor = document.createElement("a");
            anchor.href = url;
            anchor.download = `posts-${siteDateKey()}.md`;
            anchor.click();
            URL.revokeObjectURL(url);
        }
        catch (err) {
            setActionError(err instanceof Error ? err.message : "Não foi possível exportar os posts.");
        }
        finally {
            setBusyAction(null);
        }
    }
    const actionIds = selectedIds.length > 0 ? selectedIds : filteredPosts.map((post) => post._id);
    return {
        posts,
        setPosts,
        selected,
        setSelected,
        query,
        setQuery,
        status,
        setStatus,
        visibility,
        setVisibility,
        showConfig,
        setShowConfig,
        busyAction,
        setBusyAction,
        actionError,
        setActionError,
        visibleColumns,
        setVisibleColumns,
        filteredPosts,
        selectedIds,
        allFilteredSelected,
        setPostSelected,
        toggleFilteredSelection,
        patchPost,
        togglePostBoolean,
        togglePublish,
        togglePin,
        hideFromTimeline,
        remove,
        download,
        actionIds
    };
}
