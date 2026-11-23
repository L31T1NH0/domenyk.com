"use client";
import type { LinkContent, LinkSection } from "@/lib/link-page";
import { LINK_ICONS, canonicalLinkURL, normalizeLinkURL, parseLinkInput, suggestLinkTitle, type LinkInput, type SiteLink } from "@/lib/links";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { linkEditorRequest } from "./useLinkEditorControls";
const emptyLink: LinkInput = { title: "", description: "", url: "", icon: "favicon", section: "", order: 0, published: true, appearance: "simple", cover: "", coverAlt: "", startsAt: null, endsAt: null };
export function dateInput(value: string | null) { if (!value)
    return ""; const date = new Date(value); return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16); }
export function useLinksEditor({ links, sections }: {
    links: SiteLink[];
    sections: LinkSection[];
}) {
    const router = useRouter();
    const formRef = useRef<HTMLFormElement>(null);
    const titleRef = useRef<HTMLInputElement>(null);
    function nextOrder(section: string) { return Math.min(10000, Math.max(-1, ...links.filter(link => link.section === section).map(link => link.order)) + 1); }
    const [input, setInput] = useState<LinkInput>(() => ({ ...emptyLink, section: sections[0]?.id ?? "", order: nextOrder(sections[0]?.id ?? "") }));
    const [editingId, setEditingId] = useState<string | null>(null);
    const [now] = useState(() => Date.now());
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");
    const [iconSearch, setIconSearch] = useState("");
    const [picker, setPicker] = useState(false);
    const [bulk, setBulk] = useState(false);
    const [addresses, setAddresses] = useState("");
    const [dragged, setDragged] = useState<string | null>(null);
    const [checks, setChecks] = useState<Record<string, string>>({});
    const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
    const visibleIcons = (Object.entries(LINK_ICONS) as [
        LinkInput["icon"],
        string
    ][]).filter(([icon, label]) => normalize(`${icon} ${label}`).includes(normalize(iconSearch)));
    const sectionId = sections.some(section => section.id === input.section) ? input.section : sections[0]?.id ?? "";
    const existingURLs = new Set(links.map(link => canonicalLinkURL(link.url)));
    const batchSeen = new Set<string>();
    const batch = addresses.split(/\r?\n/).map(line => line.trim()).filter(Boolean).slice(0, 50).map(raw => {
        const url = normalizeLinkURL(raw), key = canonicalLinkURL(url), duplicate = existingURLs.has(key) || batchSeen.has(key);
        batchSeen.add(key);
        let valid = true;
        try {
            parseLinkInput({ ...emptyLink, title: suggestLinkTitle(url) || url.slice(0, 100), section: sectionId, url });
        }
        catch {
            valid = false;
        }
        return { raw, url, duplicate, valid };
    });
    function reset(saved?: LinkInput) {
        const section = saved?.section ?? sections[0]?.id ?? "";
        setInput({ ...emptyLink, section, order: Math.min(10000, Math.max(nextOrder(section), saved ? saved.order + 1 : 0)) });
        setEditingId(null);
        setError("");
        setIconSearch("");
    }
    async function save(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError("");
        setNotice("");
        let body: LinkInput;
        try {
            body = parseLinkInput({ ...input, section: sectionId, url: normalizeLinkURL(input.url), title: input.title.trim() || suggestLinkTitle(input.url) });
        }
        catch (error) {
            setError(error instanceof Error ? error.message : "Confira os campos.");
            return;
        }
        const unchangedURL = editingId && links.find(link => link.id === editingId)?.url === body.url;
        if (!unchangedURL && links.some(link => link.id !== editingId && canonicalLinkURL(link.url) === canonicalLinkURL(body.url))) {
            setError("Esse endereço já está cadastrado. Edite o link existente.");
            return;
        }
        setBusy(true);
        try {
            await linkEditorRequest(`/api/admin/links${editingId ? `/${editingId}` : ""}`, editingId ? "PATCH" : "POST", body);
            reset(body);
            setNotice("Link salvo.");
            router.refresh();
        }
        catch (error) {
            setError(error instanceof Error ? error.message : "Não foi possível salvar o link.");
        }
        finally {
            setBusy(false);
        }
    }
    async function saveBatch(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError("");
        setNotice("");
        setBusy(true);
        const pending = batch.filter(item => item.valid && !item.duplicate);
        const completed = new Set<string>();
        try {
            let order = nextOrder(sectionId);
            for (const item of pending) {
                const body = parseLinkInput({ ...emptyLink, section: sectionId, url: item.url, title: suggestLinkTitle(item.url) || item.url.slice(0, 100), order: Math.min(10000, order++) });
                await linkEditorRequest("/api/admin/links", "POST", body);
                completed.add(item.raw);
            }
            setNotice(`${completed.size} link${completed.size === 1 ? " adicionado" : "s adicionados"}.`);
        }
        catch (error) {
            setError(`${error instanceof Error ? error.message : "Falha ao adicionar links."} ${completed.size} já foram salvos; os demais continuam abaixo.`);
        }
        finally {
            setAddresses(current => current.split(/\r?\n/).filter(line => !completed.has(line.trim())).join("\n"));
            setBusy(false);
            router.refresh();
        }
    }
    async function remove(link: SiteLink) {
        if (!window.confirm(`Excluir “${link.title}”?`))
            return;
        setBusy(true);
        setError("");
        setNotice("");
        try {
            await linkEditorRequest(`/api/admin/links/${link.id}`, "DELETE");
            if (editingId === link.id)
                reset();
            setNotice("Link excluído.");
            router.refresh();
        }
        catch (error) {
            setError(error instanceof Error ? error.message : "Não foi possível excluir o link.");
        }
        finally {
            setBusy(false);
        }
    }
    async function reorder(fromId: string, target: SiteLink) {
        if (busy || fromId === target.id)
            return;
        const ordered = sections.flatMap(section => links.filter(link => link.section === section.id).sort((a, b) => a.order - b.order));
        const from = ordered.findIndex(link => link.id === fromId), to = ordered.findIndex(link => link.id === target.id);
        if (from < 0 || to < 0)
            return;
        const [moved] = ordered.splice(from, 1);
        ordered.splice(to, 0, { ...moved, section: target.section });
        const positions: Record<string, number> = {};
        const items = ordered.map(link => ({ id: link.id, section: link.section, order: positions[link.section] = (positions[link.section] ?? -1) + 1 }));
        setBusy(true);
        setError("");
        try {
            await linkEditorRequest("/api/admin/links/order", "PUT", { items });
            setNotice("Ordem atualizada.");
            router.refresh();
        }
        catch (error) {
            setError(error instanceof Error ? error.message : "Não foi possível alterar a ordem.");
        }
        finally {
            setBusy(false);
            setDragged(null);
        }
    }
    async function check(link: SiteLink) {
        setBusy(true);
        setError("");
        try {
            const result = await linkEditorRequest<{ health: string }>(`/api/admin/links/${link.id}/check`, "POST", {});
            setChecks(current => ({ ...current, [link.id]: result.health }));
            router.refresh();
        } catch (error) {
            setError(error instanceof Error ? error.message : "Falha na verificação.");
        } finally { setBusy(false); }
    }
    function edit(link: SiteLink) {
        setBulk(false);
        setEditingId(link.id);
        setInput(parseLinkInput(link));
        setIconSearch("");
        setError("");
        setNotice("");
        formRef.current?.scrollIntoView({ block: "start" });
        titleRef.current?.focus({ preventScroll: true });
    }
    function selectContent(content: LinkContent) {
        setBulk(false);
        setEditingId(null);
        setInput({ ...emptyLink, section: sections[0]?.id ?? "", order: nextOrder(sections[0]?.id ?? ""), title: content.title.slice(0, 100), description: content.description.slice(0, 180), url: content.url, icon: content.kind === "post" ? "document" : "book", cover: content.cover, coverAlt: content.coverAlt.slice(0, 180), appearance: content.cover ? "image" : "description" });
        setPicker(false);
    }
    function normalizeAddress() {
        setInput(current => ({ ...current, url: normalizeLinkURL(current.url), title: current.title.trim() ? current.title : suggestLinkTitle(current.url) }));
    }
    function changeSection(section: string) {
        setInput(current => ({ ...current, section, order: editingId ? current.order : nextOrder(section) }));
    }
    return {
        check,
        edit,
        selectContent,
        normalizeAddress,
        changeSection,
        router,
        formRef,
        titleRef,
        nextOrder,
        input,
        setInput,
        editingId,
        setEditingId,
        now,
        busy,
        setBusy,
        error,
        setError,
        notice,
        setNotice,
        iconSearch,
        setIconSearch,
        picker,
        setPicker,
        bulk,
        setBulk,
        addresses,
        setAddresses,
        dragged,
        setDragged,
        checks,
        setChecks,
        normalize,
        visibleIcons,
        sectionId,
        existingURLs,
        batchSeen,
        batch,
        reset,
        save,
        saveBatch,
        remove,
        reorder
    };
}
