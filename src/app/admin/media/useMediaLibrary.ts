"use client";
import type { SerializedMediaItem } from "@/lib/blob";
import { useRef, useState } from "react";
type Props = {
    initialMedia: SerializedMediaItem[];
};
export function formatBytes(value: number) {
    if (value < 1024)
        return `${value} B`;
    if (value < 1024 * 1024)
        return `${Math.round(value / 1024)} KB`;
    return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}
export function useMediaLibrary({ initialMedia }: Props) {
    const [media, setMedia] = useState(initialMedia);
    const [uploading, setUploading] = useState(false);
    const [deletingUrl, setDeletingUrl] = useState<string | null>(null);
    const [copied, setCopied] = useState<string | null>(null);
    const [error, setError] = useState("");
    const fileRef = useRef<HTMLInputElement>(null);
    async function upload(file: File) {
        setUploading(true);
        setError("");
        try {
            const form = new FormData();
            form.append("file", file);
            const res = await fetch("/api/admin/media", { method: "POST", body: form });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data.url)
                throw new Error(data.error ?? "Erro ao enviar imagem.");
            setMedia((prev) => [
                {
                    url: data.url,
                    pathname: file.name,
                    size: file.size,
                    uploadedAt: new Date().toISOString(),
                    contentType: data.contentType ?? file.type,
                },
                ...prev,
            ]);
            if (fileRef.current)
                fileRef.current.value = "";
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "Erro ao enviar imagem.");
        }
        finally {
            setUploading(false);
        }
    }
    async function copyUrl(url: string) {
        await navigator.clipboard.writeText(url);
        setCopied(url);
        setTimeout(() => setCopied(null), 2000);
    }
    async function remove(item: SerializedMediaItem) {
        setDeletingUrl(item.url);
        setError("");
        try {
            const res = await fetch("/api/admin/media", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ url: item.url }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok)
                throw new Error(data.error ?? "Erro ao deletar imagem.");
            setMedia((prev) => prev.filter((asset) => asset.url !== item.url));
        }
        catch (err) {
            const message = err instanceof Error ? err.message : "Erro ao deletar imagem.";
            setError(message);
            throw new Error(message);
        }
        finally {
            setDeletingUrl(null);
        }
    }
    return {
        media,
        setMedia,
        uploading,
        setUploading,
        deletingUrl,
        setDeletingUrl,
        copied,
        setCopied,
        error,
        setError,
        fileRef,
        upload,
        copyUrl,
        remove
    };
}
