"use client";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
type PreviewItem = {
    id: string;
    seoTitle: string;
    status: "update" | "unchanged" | "missing";
    detail?: string;
};
type Preview = {
    canApply: boolean;
    counts: {
        total: number;
        update: number;
        unchanged: number;
        missing: number;
    };
    items: PreviewItem[];
};
export function useSeoImport() {
    const router = useRouter();
    const inputRef = useRef<HTMLInputElement>(null);
    const [bundle, setBundle] = useState<unknown>(null);
    const [fileName, setFileName] = useState("");
    const [preview, setPreview] = useState<Preview | null>(null);
    const [busy, setBusy] = useState(false);
    const [confirming, setConfirming] = useState(false);
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");
    async function inspect(file: File) {
        setBusy(true);
        setError("");
        setMessage("");
        setPreview(null);
        setConfirming(false);
        setFileName(file.name);
        try {
            const parsed = JSON.parse(await file.text());
            setBundle(parsed);
            const response = await fetch("/api/admin/notes/seo-import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode: "preview", bundle: parsed }) });
            const data = await response.json() as Preview & {
                error?: string;
            };
            if (!response.ok)
                throw new Error(data.error ?? "Não foi possível ler o arquivo.");
            setPreview(data);
        }
        catch (cause) {
            setBundle(null);
            setError(cause instanceof Error ? cause.message : "Não foi possível ler o arquivo.");
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
            const response = await fetch("/api/admin/notes/seo-import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode: "apply", bundle }) });
            const data = await response.json() as {
                error?: string;
                applied?: number;
            };
            if (!response.ok)
                throw new Error(data.error ?? "Não foi possível aplicar o SEO.");
            setMessage(`${data.applied ?? 0} nota(s) atualizada(s).`);
            setBundle(null);
            setPreview(null);
            setFileName("");
            setConfirming(false);
            if (inputRef.current)
                inputRef.current.value = "";
            router.refresh();
        }
        catch (cause) {
            setError(cause instanceof Error ? cause.message : "Não foi possível aplicar o SEO.");
        }
        finally {
            setBusy(false);
        }
    }
    return {
        router,
        inputRef,
        bundle,
        setBundle,
        fileName,
        setFileName,
        preview,
        setPreview,
        busy,
        setBusy,
        confirming,
        setConfirming,
        message,
        setMessage,
        error,
        setError,
        inspect,
        apply
    };
}
