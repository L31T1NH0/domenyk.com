"use client";
import { siteDateKey } from "@/lib/datetime";
import { useEffect, useState } from "react";
type Entry = {
    _id: string;
    authorName: string;
    body: string;
    createdAt: string;
    readAt?: string;
    isOwn: boolean;
};
type Thread = {
    _id: string;
    ownerName: string;
    subject: string;
    category: string;
    status: string;
    entries?: Entry[];
    updatedAt: string;
    lastMessage?: {
        body: string;
    } | null;
};
export function useAdminMessages() {
    const [threads, setThreads] = useState<Thread[] | null>(null);
    const [selected, setSelected] = useState<string | null>(null);
    const [reply, setReply] = useState("");
    const [busy, setBusy] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [actionError, setActionError] = useState("");
    const [cursor, setCursor] = useState<string | null>(null);
    const [hasMore, setHasMore] = useState(false);
    const [archived, setArchived] = useState(false);
    const thread = threads?.find((item) => item._id === selected);
    async function selectThread(id: string) {
        setSelected(id);
        setActionError("");
        const response = await fetch(`/api/messages/${id}/read`, { method: "POST" });
        if (!response.ok)
            return;
        const detail = await response.json();
        setThreads((current) => current?.map((item) => item._id === id ? detail : item) ?? []);
    }
    useEffect(() => {
        fetch(`/api/admin/messages${archived ? "?archived=1" : ""}`, { cache: "no-store" })
            .then((response) => response.json())
            .then((data) => {
            setThreads(data.items);
            setCursor(data.nextCursor);
            setHasMore(data.hasMore);
            const fromHash = window.location.hash.slice(1);
            const initial = data.items.some((item: Thread) => item._id === fromHash) ? fromHash : data.items[0]?._id ?? null;
            setSelected(initial);
            if (initial)
                void selectThread(initial);
        });
    }, [archived]);
    async function answer() {
        if (!thread || !reply.trim())
            return;
        setBusy(true);
        const response = await fetch(`/api/messages/${thread._id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body: reply }) });
        const updated = await response.json();
        setBusy(false);
        if (response.ok) {
            setThreads((current) => current?.map((item) => item._id === updated._id ? updated : item) ?? []);
            setReply("");
        }
    }
    async function patchThread(payload: object) {
        if (!thread)
            return null;
        setBusy(true);
        const response = await fetch(`/api/messages/${thread._id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        const updated = await response.json();
        setBusy(false);
        return response.ok ? updated : null;
    }
    async function changeStatus(status: "open" | "accepted" | "declined" | "closed") {
        const updated = await patchThread({ status });
        if (updated)
            setThreads((current) => current?.map((item) => item._id === updated._id ? updated : item) ?? []);
    }
    async function archiveThread() {
        const updated = await patchThread({ archived: !archived });
        if (updated) {
            setThreads((current) => current?.filter((item) => item._id !== updated._id) ?? []);
            setSelected(null);
        }
    }
    async function deleteThread() {
        if (!thread)
            return;
        setBusy(true);
        const response = await fetch(`/api/messages/${thread._id}`, { method: "DELETE" });
        setBusy(false);
        if (!response.ok)
            throw new Error("Não foi possível excluir o assunto.");
        setThreads((current) => current?.filter((item) => item._id !== thread._id) ?? []);
        setSelected(null);
    }
    async function downloadThread() {
        if (!thread)
            return;
        setExporting(true);
        setActionError("");
        try {
            const response = await fetch("/api/admin/messages/download", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ids: [thread._id] }),
            });
            if (!response.ok) {
                const data = await response.json().catch(() => null) as {
                    error?: string;
                } | null;
                throw new Error(data?.error ?? "Não foi possível exportar a conversa.");
            }
            const url = URL.createObjectURL(await response.blob());
            const anchor = document.createElement("a");
            anchor.href = url;
            anchor.download = `conversa-${siteDateKey()}.md`;
            document.body.append(anchor);
            anchor.click();
            anchor.remove();
            URL.revokeObjectURL(url);
        }
        catch (error) {
            setActionError(error instanceof Error ? error.message : "Não foi possível exportar a conversa.");
        }
        finally {
            setExporting(false);
        }
    }
    async function loadMore() {
        if (!cursor)
            return;
        const params = new URLSearchParams({ cursor, ...(archived ? { archived: "1" } : {}) });
        const response = await fetch(`/api/admin/messages?${params}`, { cache: "no-store" });
        if (!response.ok)
            return;
        const data = await response.json();
        setThreads((current) => [...(current ?? []), ...data.items]);
        setCursor(data.nextCursor);
        setHasMore(data.hasMore);
    }
    return {
        threads,
        setThreads,
        selected,
        setSelected,
        reply,
        setReply,
        busy,
        setBusy,
        exporting,
        setExporting,
        actionError,
        setActionError,
        cursor,
        setCursor,
        hasMore,
        setHasMore,
        archived,
        setArchived,
        thread,
        selectThread,
        answer,
        patchThread,
        changeStatus,
        archiveThread,
        deleteThread,
        downloadThread,
        loadMore
    };
}
export function statusLabel(status: string) { return status === "open" ? "aguardando" : status === "accepted" ? "aceita" : status === "declined" ? "negada" : status === "closed" ? "encerrada" : "respondida"; }
