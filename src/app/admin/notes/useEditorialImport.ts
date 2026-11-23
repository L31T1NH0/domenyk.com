"use client";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
type PreviewItem = {
    editorialId: string;
    title: string;
    action: "keep" | "update" | "archive";
    position: number;
    status: "matched" | "unchanged" | "missing" | "ambiguous" | "duplicate";
    detail?: string;
};
type Preview = {
    canApply: boolean;
    counts: {
        units: number;
        archive: number;
        update: number;
        unchanged: number;
        missing: number;
        ambiguous: number;
        duplicate: number;
    };
    items: PreviewItem[];
};
export function actionLabel(action: PreviewItem["action"]) {
    return action === "archive" ? "Excluir" : action === "update" ? "Atualizar" : "Manter";
}
export function statusLabel(status: PreviewItem["status"]) {
    return status === "matched" ? "Encontrada" : status === "unchanged" ? "Sem mudança" : status === "missing" ? "Ausente" : status === "ambiguous" ? "Ambígua" : "Duplicada";
}
export function useEditorialImport() {
    const router = useRouter();
    const inputRef = useRef<HTMLInputElement>(null);
    const [fileName, setFileName] = useState("");
    const [bundle, setBundle] = useState<unknown>(null);
    const [preview, setPreview] = useState<Preview | null>(null);
    const [confirming, setConfirming] = useState(false);
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");
    async function inspectFile(file: File) {
        setBusy(true);
        setError("");
        setMessage("");
        setPreview(null);
        setConfirming(false);
        setFileName(file.name);
        try {
            const parsed: unknown = JSON.parse(await file.text());
            setBundle(parsed);
            const response = await fetch("/api/admin/notes/editorial-import", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ mode: "preview", bundle: parsed }),
            });
            const data = await response.json() as Preview & {
                error?: string;
            };
            if (!response.ok)
                throw new Error(data.error ?? "Não foi possível ler o pacote.");
            setPreview(data);
        }
        catch (cause) {
            setBundle(null);
            setError(cause instanceof Error ? cause.message : "Não foi possível ler o pacote.");
        }
        finally {
            setBusy(false);
        }
    }
    async function apply() {
        if (!bundle || !preview?.canApply)
            return;
        setBusy(true);
        setError("");
        setMessage("");
        try {
            const response = await fetch("/api/admin/notes/editorial-import", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ mode: "apply", bundle }),
            });
            const data = await response.json() as {
                error?: string;
                applied?: number;
            };
            if (!response.ok)
                throw new Error(data.error ?? "Não foi possível aplicar o pacote.");
            setMessage(`${data.applied ?? 0} nota(s) aplicada(s).`);
            setPreview(null);
            setBundle(null);
            setFileName("");
            setConfirming(false);
            if (inputRef.current)
                inputRef.current.value = "";
            router.refresh();
        }
        catch (cause) {
            setError(cause instanceof Error ? cause.message : "Não foi possível aplicar o pacote.");
        }
        finally {
            setBusy(false);
        }
    }
    const unresolved = preview ? preview.counts.missing + preview.counts.ambiguous + preview.counts.duplicate : 0;
    return {
        router,
        inputRef,
        fileName,
        setFileName,
        bundle,
        setBundle,
        preview,
        setPreview,
        confirming,
        setConfirming,
        busy,
        setBusy,
        message,
        setMessage,
        error,
        setError,
        inspectFile,
        apply,
        unresolved
    };
}
