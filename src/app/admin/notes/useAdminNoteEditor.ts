"use client";
import { assertPublicationCssIsValid, readHtmlFromEditor } from "@/components/editor/LexicalEditor";
import type { NoteMetrics } from "@/lib/db/note-metrics";
import type { SerializedNote } from "@/lib/db/notes";
import type { LexicalEditor as EditorInstance } from "lexical";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
export function useAdminNoteEditor({ note, metrics }: {
    note: SerializedNote;
    metrics: Omit<NoteMetrics, "updatedAt">;
}) {
    const router = useRouter();
    const editorRef = useRef<EditorInstance | null>(null);
    const [title, setTitle] = useState(note.title ?? "");
    const [content, setContent] = useState(note.content);
    const [seoTitle, setSeoTitle] = useState(note.seoTitle ?? "");
    const [seoDescription, setSeoDescription] = useState(note.seoDescription ?? "");
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState("");
    const indexable = Boolean(seoTitle.trim() && seoDescription.trim());
    async function save() {
        if (saving)
            return;
        setMessage("");
        try {
            if (editorRef.current)
                assertPublicationCssIsValid(editorRef.current);
            setSaving(true);
            const response = await fetch(`/api/admin/notes/${note._id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title, content: editorRef.current ? readHtmlFromEditor(editorRef.current) : content, seoTitle, seoDescription }) });
            const data = await response.json().catch(() => null) as {
                error?: string;
            } | null;
            if (!response.ok)
                return setMessage(data?.error ?? "Não foi possível salvar a nota.");
            setMessage("Alterações salvas.");
            router.refresh();
        }
        catch (error) {
            setMessage(error instanceof Error ? error.message : "Não foi possível salvar a nota.");
        }
        finally {
            setSaving(false);
        }
    }
    async function remove() {
        const response = await fetch(`/api/admin/notes/${note._id}`, { method: "DELETE" });
        if (!response.ok) {
            const error = "Não foi possível excluir a nota.";
            setMessage(error);
            throw new Error(error);
        }
        router.push("/admin/notes");
        router.refresh();
    }
    return {
        note,
        metrics,
        router,
        editorRef,
        title,
        setTitle,
        content,
        setContent,
        seoTitle,
        setSeoTitle,
        seoDescription,
        setSeoDescription,
        saving,
        setSaving,
        message,
        setMessage,
        indexable,
        save,
        remove
    };
}
