"use client";
import type { CommentParentSummary, SerializedComment } from "@/lib/db/comments";
import { useMemo, useRef, useState } from "react";
type AdminComment = SerializedComment & {
    parent: CommentParentSummary;
};
type Filter = "all" | "post" | "note";
export function useCommentsTable({ comments: initial }: {
    comments: AdminComment[];
}) {
    const [comments, setComments] = useState(initial);
    const [query, setQuery] = useState("");
    const [filter, setFilter] = useState<Filter>("all");
    const [error, setError] = useState("");
    const [detailId, setDetailId] = useState<string | null>(null);
    const [detailRecord, setDetailRecord] = useState<Record<string, unknown> | null>(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [detailError, setDetailError] = useState("");
    const detailRequest = useRef(0);
    const filtered = useMemo(() => comments.filter((comment) => {
        if (filter !== "all" && comment.parent.type !== filter)
            return false;
        const search = `${comment.authorName} ${comment.content} ${comment.parent.title}`.toLocaleLowerCase("pt-BR");
        return search.includes(query.trim().toLocaleLowerCase("pt-BR"));
    }), [comments, filter, query]);
    async function remove(id: string) {
        setError("");
        const response = await fetch(`/api/admin/comments/${id}`, { method: "DELETE" });
        if (response.ok)
            return setComments((current) => current.filter((comment) => comment._id !== id));
        const message = "Não foi possível excluir o comentário.";
        setError(message);
        throw new Error(message);
    }
    async function toggleDetails(id: string) {
        const request = ++detailRequest.current;
        if (detailId === id) {
            setDetailId(null);
            setDetailRecord(null);
            setDetailError("");
            return;
        }
        setDetailId(id);
        setDetailRecord(null);
        setDetailError("");
        setDetailLoading(true);
        const response = await fetch(`/api/admin/comments/${id}`, { cache: "no-store" });
        const data = await response.json().catch(() => null) as {
            record?: Record<string, unknown>;
            error?: string;
        } | null;
        if (request !== detailRequest.current)
            return;
        setDetailLoading(false);
        if (!response.ok || !data?.record)
            return setDetailError(data?.error ?? "Não foi possível carregar os detalhes.");
        setDetailRecord(data.record);
    }
    function detailValue(value: unknown) {
        if (value === null)
            return "null";
        if (value === undefined)
            return "undefined";
        if (typeof value === "string")
            return value;
        return JSON.stringify(value, null, 2);
    }
    return {
        comments,
        setComments,
        query,
        setQuery,
        filter,
        setFilter,
        error,
        setError,
        detailId,
        setDetailId,
        detailRecord,
        setDetailRecord,
        detailLoading,
        setDetailLoading,
        detailError,
        setDetailError,
        detailRequest,
        filtered,
        remove,
        toggleDetails,
        detailValue
    };
}
