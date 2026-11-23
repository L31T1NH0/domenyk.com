"use client";
import type { ContentKind, LinkContent } from "@/lib/link-page";
import { useEffect, useRef, useState } from "react";
export async function linkEditorRequest<T = unknown>(url: string, method = "GET", body?: unknown): Promise<T> {
    const response = await fetch(url, { method, headers: body === undefined ? {} : { "Content-Type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const data = await response.json();
    if (!response.ok)
        throw new Error(data.error || "Não foi possível concluir a operação.");
    return data as T;
}
export function useContentPicker({ onSelect, onClose, allowLinks = false }: {
    onSelect: (content: LinkContent) => void;
    onClose: () => void;
    allowLinks?: boolean;
}) {
    const dialog = useRef<HTMLDialogElement>(null);
    const searchRef = useRef<HTMLInputElement>(null);
    const [search, setSearch] = useState("");
    const [kind, setKind] = useState<ContentKind | "all">("all");
    const [items, setItems] = useState<LinkContent[]>([]);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(true);
    useEffect(() => { dialog.current?.showModal(); searchRef.current?.focus(); }, []);
    useEffect(() => {
        const controller = new AbortController();
        const timeout = setTimeout(() => {
            fetch(`/api/admin/links/content?q=${encodeURIComponent(search)}`, { signal: controller.signal })
                .then(async (response) => { const data = await response.json(); if (!response.ok)
                throw new Error(data.error); return data.items as LinkContent[]; })
                .then(data => { setItems(data); setError(""); })
                .catch(error => { if (!controller.signal.aborted)
                setError(error instanceof Error ? error.message : "Não foi possível carregar os conteúdos."); })
                .finally(() => { if (!controller.signal.aborted)
                setLoading(false); });
        }, 250);
        return () => { clearTimeout(timeout); controller.abort(); };
    }, [search]);
    const visible = items.filter(item => (allowLinks || item.kind !== "link") && (kind === "all" || item.kind === kind));
    function select(content: LinkContent) {
        onSelect(content);
        onClose();
    }
    function changeSearch(value: string) {
        setSearch(value);
        setLoading(true);
    }
    return {
        select,
        close: onClose,
        changeSearch,
        dialog,
        searchRef,
        search,
        setSearch,
        kind,
        setKind,
        items,
        setItems,
        error,
        setError,
        loading,
        setLoading,
        visible
    };
}
export function useCoverField({ url, alt, onChange, onBusyChange, disabled = false }: {
    url: string;
    alt: string;
    onChange: (url: string, alt: string) => void;
    disabled?: boolean;
    onBusyChange?: (busy: boolean) => void;
}) {
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [library, setLibrary] = useState<{
        url: string;
    }[] | null>(null);
    const [mediaCursor, setMediaCursor] = useState<string | null>(null);
    function pending(value: boolean) { setBusy(value); onBusyChange?.(value); }
    async function upload(file: File) {
        pending(true);
        setError("");
        try {
            const response = await fetch("/api/admin/links/media", { method: "POST", headers: { "Content-Type": file.type }, body: file });
            const data = await response.json();
            if (!response.ok)
                throw new Error(data.error);
            onChange(data.url, alt);
        }
        catch (error) {
            setError(error instanceof Error ? error.message : "Falha no envio da capa.");
        }
        finally {
            pending(false);
        }
    }
    async function toggleLibrary() {
        if (library) { setLibrary(null); return; }
        pending(true);
        setError("");
        try {
            const data = await linkEditorRequest<{ items: { url: string }[]; cursor: string | null }>("/api/admin/links/media");
            setLibrary(data.items);
            setMediaCursor(data.cursor);
        } catch (error) {
            setError(error instanceof Error ? error.message : "Falha na biblioteca.");
        } finally { pending(false); }
    }
    async function loadMoreImages() {
        if (!mediaCursor) return;
        pending(true);
        setError("");
        try {
            const data = await linkEditorRequest<{ items: { url: string }[]; cursor: string | null }>(`/api/admin/links/media?cursor=${encodeURIComponent(mediaCursor)}`);
            setLibrary(current => [...current || [], ...data.items]);
            setMediaCursor(data.cursor);
        } catch (error) {
            setError(error instanceof Error ? error.message : "Falha ao carregar imagens.");
        } finally { pending(false); }
    }
    function selectImage(imageUrl: string) {
        onChange(imageUrl, alt);
        setLibrary(null);
    }
    return {
        url,
        alt,
        disabled,
        toggleLibrary,
        loadMoreImages,
        selectImage,
        removeCover: () => onChange("", ""),
        changeUrl: (value: string) => onChange(value, alt),
        changeAlt: (value: string) => onChange(url, value),
        busy,
        setBusy,
        error,
        setError,
        library,
        setLibrary,
        mediaCursor,
        setMediaCursor,
        pending,
        upload
    };
}
