"use client";
import type { AdminWritingEntry } from "@/lib/db/writing-progress";
import { useId, useState, type FormEvent } from "react";
export function useWritingForm({ entry, onSaved }: {
    entry?: AdminWritingEntry;
    onSaved: (entry: AdminWritingEntry) => void;
}) {
    const id = useId();
    const [title, setTitle] = useState(entry?.title ?? "");
    const [progress, setProgress] = useState(String(entry?.progress ?? 0));
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");
    const dirty = entry ? title.trim() !== entry.title || Number(progress) !== entry.progress : true;
    async function save(completed = entry?.completed ?? false) {
        if (busy)
            return;
        const percentage = Number(progress);
        if (!title.trim() || title.trim().length > 180 || progress.trim() === "" || !Number.isInteger(percentage) || percentage < 0 || percentage > 100) {
            setError("Informe um título e uma porcentagem inteira entre 0 e 100.");
            return;
        }
        setBusy(true);
        setError("");
        setNotice("");
        try {
            const response = await fetch(entry ? `/api/admin/writing/${entry.id}` : "/api/admin/writing", {
                method: entry ? "PATCH" : "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ title: title.trim(), progress: percentage, completed }),
            });
            const data = await response.json().catch(() => null);
            if (!response.ok)
                throw new Error(data?.error ?? "Não foi possível salvar. Tente novamente.");
            if (entry) {
                onSaved({ ...entry, title: title.trim(), progress: percentage, completed });
                setTitle(title.trim());
                setNotice(completed ? "Concluído. O texto saiu da home." : "Salvo. O progresso aparece na home.");
            }
            else {
                onSaved(data as AdminWritingEntry);
                setTitle("");
                setProgress("0");
                setNotice("Texto adicionado à home.");
            }
        }
        catch (error) {
            setError(error instanceof Error ? error.message : "Não foi possível salvar. Tente novamente.");
        }
        finally {
            setBusy(false);
        }
    }
    function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        void save();
    }
    return {
        id,
        title,
        setTitle,
        progress,
        setProgress,
        busy,
        setBusy,
        error,
        setError,
        notice,
        setNotice,
        dirty,
        save,
        submit
    };
}
export function useWritingManager({ initialEntries }: {
    initialEntries: AdminWritingEntry[];
}) {
    const [entries, setEntries] = useState(initialEntries);
    const active = entries.filter((entry) => !entry.completed);
    const completed = entries.filter((entry) => entry.completed);
    function handleSaved(entry: AdminWritingEntry) {
        setEntries((current) => current.some((item) => item.id === entry.id)
            ? current.map((item) => item.id === entry.id ? entry : item)
            : [entry, ...current]);
    }
    return {
        entries,
        setEntries,
        active,
        completed,
        handleSaved
    };
}
