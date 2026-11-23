"use client";
import { contentSelection, parseLinkPageSettings, selectFeatured, type ContentSelection, type LinkContent, type LinkPageData, type LinkPageSettings } from "@/lib/link-page";
import { LINK_SECTIONS, type SiteLink } from "@/lib/links";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { linkEditorRequest } from "./useLinkEditorControls";
export function initialSettings(links: SiteLink[]): LinkPageSettings {
    // Legacy names are editable initial values, never a public-page fallback.
    const ids = [...new Set(links.length ? links.map(link => link.section) : Object.keys(LINK_SECTIONS))];
    return { heading: "", intro: "", metaTitle: "", metaDescription: "", featuredHeading: "", readingsHeading: "", includeLatest: true, featured: [], readings: [], sections: ids.map(id => ({ id, title: LINK_SECTIONS[id as keyof typeof LINK_SECTIONS] || id, layout: "row" })) };
}
export function selectionPreview(selection: ContentSelection, pool: LinkContent[]): LinkContent | undefined {
    const source = pool.find(item => item.kind === selection.kind && item.id === selection.id);
    if (!source)
        return undefined;
    return { ...source, title: selection.title || source.title, description: selection.description || source.description, cover: selection.coverMode === "none" ? "" : selection.coverMode === "custom" ? selection.cover : source.cover, coverAlt: selection.coverMode === "custom" ? selection.coverAlt : source.coverAlt };
}
export function useLinksManager({ links, settings: initial, pageData, catalog, latest }: {
    links: SiteLink[];
    settings: LinkPageSettings | null;
    pageData: LinkPageData;
    catalog: LinkContent[];
    latest: LinkContent | null;
}) {
    const router = useRouter();
    const [tab, setTab] = useState<"content" | "page" | "featured" | "stats">(initial ? "content" : "page");
    const [settings, setSettings] = useState(() => initial || initialSettings(links));
    const [saved, setSaved] = useState(initial);
    const [pool, setPool] = useState(() => [...catalog, ...pageData.featured, ...pageData.readings]);
    const [picker, setPicker] = useState<"featured" | "readings" | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");
    const [showPreview, setShowPreview] = useState(false);
    const selected = settings.featured.map(item => selectionPreview(item, pool)).filter((item): item is LinkContent => !!item);
    const preview: LinkPageData = { settings, featured: selectFeatured(settings.includeLatest ? latest : null, selected), readings: settings.readings.map(item => selectionPreview(item, pool)).filter((item): item is LinkContent => !!item) };
    function change<K extends keyof LinkPageSettings>(key: K, value: LinkPageSettings[K]) { setSettings(current => ({ ...current, [key]: value })); setNotice(""); }
    async function save(event: FormEvent) {
        event.preventDefault();
        setError("");
        setNotice("");
        let body: LinkPageSettings;
        try {
            body = parseLinkPageSettings(settings);
        }
        catch (error) {
            setError(error instanceof Error ? error.message : "Confira os campos.");
            return;
        }
        setBusy(true);
        try {
            await linkEditorRequest("/api/admin/links/settings", "PUT", body);
            setSaved(body);
            setSettings(body);
            setNotice("Página salva.");
            router.refresh();
        }
        catch (error) {
            setError(error instanceof Error ? error.message : "Não foi possível salvar a página.");
        }
        finally {
            setBusy(false);
        }
    }
    function updateSelection(group: "featured" | "readings", index: number, patch: Partial<ContentSelection>) {
        change(group, settings[group].map((entry, position) => position === index ? { ...entry, ...patch } : entry));
    }
    function moveSelection(group: "featured" | "readings", index: number) {
        if (index <= 0 || index >= settings[group].length) return;
        const next = [...settings[group]];
        [next[index - 1], next[index]] = [next[index], next[index - 1]];
        change(group, next);
    }
    function removeSelection(group: "featured" | "readings", index: number) {
        change(group, settings[group].filter((_, position) => position !== index));
    }
    function selectContent(content: LinkContent) {
        const group = picker;
        if (!group) return;
        if (settings[group].some(item => item.kind === content.kind && item.id === content.id)) {
            setError("Esse conteúdo já está nesta seleção.");
            return;
        }
        if (settings[group].length >= (group === "featured" ? 2 : 20)) return;
        setPool(current => [content, ...current.filter(item => item.kind !== content.kind || item.id !== content.id)]);
        change(group, [...settings[group], contentSelection(content)]);
        setError("");
        setPicker(null);
    }
    function updateSection(index: number, patch: Partial<LinkPageSettings["sections"][number]>) {
        change("sections", settings.sections.map((item, position) => position === index ? { ...item, ...patch } : item));
    }
    function moveSection(index: number, direction: -1 | 1) {
        const target = index + direction;
        if (target < 0 || target >= settings.sections.length) return;
        const next = [...settings.sections];
        [next[target], next[index]] = [next[index], next[target]];
        change("sections", next);
    }
    function removeSection(id: string) {
        if (links.some(link => link.section === id)) return;
        change("sections", settings.sections.filter(item => item.id !== id));
    }
    function addSection() {
        if (settings.sections.length >= 20) return;
        change("sections", [...settings.sections, { id: `section-${crypto.randomUUID().slice(0, 8)}`, title: "", layout: "row" }]);
    }
    return {
        moveSelection,
        removeSelection,
        selectContent,
        updateSection,
        moveSection,
        removeSection,
        addSection,
        router,
        tab,
        setTab,
        settings,
        setSettings,
        saved,
        setSaved,
        pool,
        setPool,
        picker,
        setPicker,
        busy,
        setBusy,
        error,
        setError,
        notice,
        setNotice,
        showPreview,
        setShowPreview,
        selected,
        preview,
        change,
        save,
        updateSelection
    };
}
