"use client";
import { siteDateKey } from "@/lib/datetime";
import type { NoteMetrics } from "@/lib/db/note-metrics";
import type { SerializedNote } from "@/lib/db/notes";
import { useMemo, useState } from "react";
type AdminNote = SerializedNote & {
    metrics: Omit<NoteMetrics, "updatedAt">;
};
export function useAdminNotesTable({ notes }: {
    notes: AdminNote[];
}) {
    const [query, setQuery] = useState("");
    const [downloading, setDownloading] = useState(false);
    const [actionError, setActionError] = useState("");
    const filtered = useMemo(() => notes.filter((note) => `${note.title ?? ""} ${note.seoTitle ?? ""} ${note.content}`.toLowerCase().includes(query.trim().toLowerCase())), [notes, query]);
    async function downloadNotes() {
        setDownloading(true);
        setActionError("");
        try {
            const response = await fetch("/api/admin/notes/download", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ids: filtered.map((note) => note._id) }),
            });
            if (!response.ok) {
                const data = await response.json().catch(() => null) as {
                    error?: string;
                } | null;
                throw new Error(data?.error ?? "Não foi possível exportar as notas.");
            }
            const url = URL.createObjectURL(await response.blob());
            const anchor = document.createElement("a");
            anchor.href = url;
            anchor.download = `notas-${siteDateKey()}.md`;
            document.body.append(anchor);
            anchor.click();
            anchor.remove();
            URL.revokeObjectURL(url);
        }
        catch (error) {
            setActionError(error instanceof Error ? error.message : "Não foi possível exportar as notas.");
        }
        finally {
            setDownloading(false);
        }
    }
    return {
        query,
        setQuery,
        downloading,
        setDownloading,
        actionError,
        setActionError,
        filtered,
        downloadNotes
    };
}
