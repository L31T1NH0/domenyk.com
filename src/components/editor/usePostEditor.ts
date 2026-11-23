"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import type { LexicalEditor as LexicalEditorInstance } from "lexical";
import { POST_LOCALES, POST_LOCALE_DETAILS, isTranslationRevisionStale, slugifyPostTitle, type PostLocale, type TranslationLocale } from "@/lib/post-locales";
import { assertPublicationCssIsValid, readHtmlFromEditor } from "./LexicalEditor";
type CoAuthorOption = {
    id: string;
    name: string;
    imageUrl: string | null;
};
type ThemeOption = {
    _id: string;
    name: string;
    active: boolean;
};
type SeriesOption = {
    publicId: string;
    title: string;
    published: boolean;
};
type LocalizedDraft = {
    title: string;
    seoTitle: string;
    seoDescription: string;
    localizedSlug: string;
    subtitle: string;
    excerpt: string;
    coverAlt: string;
    tags: string;
    sources: string;
    content: string;
};
type StoredTranslation = Partial<Omit<LocalizedDraft, "tags">> & {
    slug?: string;
    title: string;
    content: string;
    tags?: string[];
    sources?: Array<{
        label?: string;
        url: string;
    }>;
    published: boolean;
    publishedAt?: string;
    sourceUpdatedAt: string;
    updatedAt: string;
};
type PostData = {
    id?: string;
    title: string;
    content: string;
    slug: string;
    seoTitle?: string;
    seoDescription?: string;
    excerpt?: string;
    subtitle?: string;
    tags: string[];
    sources?: Array<{
        label?: string;
        url: string;
    }>;
    style: "standard" | "editorial" | "opinion";
    cover?: {
        url: string;
        alt?: string;
    };
    showCoverInTimeline?: boolean;
    hiddenFromTimeline?: boolean;
    friendImage?: string;
    coAuthorUserId?: string | null;
    audioUrl?: string;
    published?: boolean;
    publishedAt?: string;
    originalContentUpdatedAt?: string;
    translations?: Partial<Record<TranslationLocale, StoredTranslation>>;
    themeIds?: string[];
    series?: {
        id: string;
        slug: string;
        title: string;
        position: number;
        published: boolean;
    };
};
type Props = {
    post?: PostData;
    initialSeriesPublicId?: string;
};
type VersionState = {
    exists: boolean;
    published: boolean;
    publishedAt?: string;
    sourceUpdatedAt?: string;
    updatedAt?: string;
};
type VersionStates = Record<PostLocale, VersionState>;
export function emptyDraft(): LocalizedDraft {
    return { title: "", seoTitle: "", seoDescription: "", localizedSlug: "", subtitle: "", excerpt: "", coverAlt: "", tags: "", sources: "", content: "" };
}
export function sourcesToText(sources?: Array<{
    label?: string;
    url: string;
}>): string {
    return sources?.map((source) => source.label ? `${source.label} | ${source.url}` : source.url).join("\n") ?? "";
}
export function sourcesFromText(value: string): Array<{
    label?: string;
    url: string;
}> {
    return value.split("\n").flatMap((line) => {
        const trimmed = line.trim();
        if (!trimmed)
            return [];
        const separator = trimmed.lastIndexOf("|");
        if (separator === -1)
            return [{ url: trimmed }];
        const label = trimmed.slice(0, separator).trim();
        const url = trimmed.slice(separator + 1).trim();
        return [{ url, ...(label ? { label } : {}) }];
    });
}
export function initialDrafts(post?: PostData): Record<PostLocale, LocalizedDraft> {
    const drafts: Record<PostLocale, LocalizedDraft> = {
        pt: {
            title: post?.title ?? "",
            seoTitle: post?.seoTitle ?? "",
            seoDescription: post?.seoDescription ?? "",
            localizedSlug: post?.slug ?? "",
            subtitle: post?.subtitle ?? "",
            excerpt: post?.excerpt ?? "",
            coverAlt: post?.cover?.alt ?? "",
            tags: post?.tags.join(", ") ?? "",
            sources: sourcesToText(post?.sources),
            content: post?.content ?? "",
        },
        en: emptyDraft(),
        de: emptyDraft(),
        id: emptyDraft(),
    };
    for (const locale of ["en", "de", "id"] as const) {
        const translation = post?.translations?.[locale];
        if (!translation)
            continue;
        drafts[locale] = {
            title: translation.title,
            seoTitle: translation.seoTitle ?? "",
            seoDescription: translation.seoDescription ?? "",
            localizedSlug: translation.slug ?? "",
            subtitle: translation.subtitle ?? "",
            excerpt: translation.excerpt ?? "",
            coverAlt: translation.coverAlt ?? "",
            tags: translation.tags?.join(", ") ?? "",
            sources: sourcesToText(translation.sources),
            content: translation.content,
        };
    }
    return drafts;
}
export function initialVersionStates(post?: PostData): VersionStates {
    const states: VersionStates = {
        pt: {
            exists: Boolean(post?.id),
            published: post?.published === true,
            publishedAt: post?.publishedAt,
            updatedAt: post?.originalContentUpdatedAt,
        },
        en: { exists: false, published: false },
        de: { exists: false, published: false },
        id: { exists: false, published: false },
    };
    for (const locale of ["en", "de", "id"] as const) {
        const translation = post?.translations?.[locale];
        if (!translation)
            continue;
        states[locale] = {
            exists: true,
            published: translation.published,
            publishedAt: translation.publishedAt,
            sourceUpdatedAt: translation.sourceUpdatedAt,
            updatedAt: translation.updatedAt,
        };
    }
    return states;
}
export function draftsMatch(left: LocalizedDraft, right: LocalizedDraft): boolean {
    return left.title === right.title &&
        left.seoTitle === right.seoTitle &&
        left.seoDescription === right.seoDescription &&
        left.localizedSlug === right.localizedSlug &&
        left.subtitle === right.subtitle &&
        left.excerpt === right.excerpt &&
        left.coverAlt === right.coverAlt &&
        left.tags === right.tags &&
        left.sources === right.sources &&
        left.content === right.content;
}
const ACCEPTED_COVER_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
export function usePostEditor({ post, initialSeriesPublicId = "" }: Props) {
    const [postId, setPostId] = useState(post?.id);
    const [activeLocale, setActiveLocale] = useState<PostLocale>("pt");
    const [drafts, setDrafts] = useState<Record<PostLocale, LocalizedDraft>>(() => initialDrafts(post));
    const [savedDrafts, setSavedDrafts] = useState<Record<PostLocale, LocalizedDraft>>(() => initialDrafts(post));
    const [versions, setVersions] = useState<VersionStates>(() => initialVersionStates(post));
    const [originalContentUpdatedAt, setOriginalContentUpdatedAt] = useState(post?.originalContentUpdatedAt);
    const [slug, setSlug] = useState(post?.slug ?? "");
    const [slugEdited, setSlugEdited] = useState(Boolean(post?.id));
    const [localizedSlugEdited, setLocalizedSlugEdited] = useState<Record<TranslationLocale, boolean>>({
        en: Boolean(post?.translations?.en?.slug),
        de: Boolean(post?.translations?.de?.slug),
        id: Boolean(post?.translations?.id?.slug),
    });
    const [style, setStyle] = useState<PostData["style"]>(post?.style ?? "standard");
    const [visibleInTimeline, setVisibleInTimeline] = useState(post?.hiddenFromTimeline !== true);
    const [coverUrl, setCoverUrl] = useState(post?.cover?.url ?? "");
    const [showCoverInTimeline, setShowCoverInTimeline] = useState(post?.showCoverInTimeline ?? true);
    const [friendImage, setFriendImage] = useState(post?.friendImage ?? "");
    const [coAuthorUserId, setCoAuthorUserId] = useState(post?.coAuthorUserId ?? "");
    const [coAuthors, setCoAuthors] = useState<CoAuthorOption[]>([]);
    const [loadingCoAuthors, setLoadingCoAuthors] = useState(true);
    const [coAuthorsError, setCoAuthorsError] = useState("");
    const [themes, setThemes] = useState<ThemeOption[]>([]);
    const [selectedThemeIds, setSelectedThemeIds] = useState<string[]>(post?.themeIds ?? []);
    const [seriesOptions, setSeriesOptions] = useState<SeriesOption[]>([]);
    const [selectedSeriesPublicId, setSelectedSeriesPublicId] = useState(post?.series?.id ?? initialSeriesPublicId);
    const [loadingSeries, setLoadingSeries] = useState(true);
    const [audioUrl, setAudioUrl] = useState(post?.audioUrl ?? "");
    const [saving, setSaving] = useState(false);
    const [uploadingCover, setUploadingCover] = useState(false);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");
    const initialSharedSignature = useMemo(() => JSON.stringify({
        slug: post?.slug ?? "",
        style: post?.style ?? "standard",
        visibleInTimeline: post?.hiddenFromTimeline !== true,
        coverUrl: post?.cover?.url ?? "",
        showCoverInTimeline: post?.showCoverInTimeline ?? true,
        friendImage: post?.friendImage ?? "",
        coAuthorUserId: post?.coAuthorUserId ?? "",
        audioUrl: post?.audioUrl ?? "",
        themeIds: [...(post?.themeIds ?? [])].sort(),
        seriesPublicId: post?.series?.id ?? initialSeriesPublicId,
    }), [initialSeriesPublicId, post]);
    const [savedSharedSignature, setSavedSharedSignature] = useState(initialSharedSignature);
    const fieldId = useId();
    const coverFileRef = useRef<HTMLInputElement>(null);
    const titleRef = useRef<HTMLInputElement>(null);
    const errorRef = useRef<HTMLParagraphElement>(null);
    const editorRef = useRef<LexicalEditorInstance | null>(null);
    const activeDraft = drafts[activeLocale];
    const currentSharedSignature = JSON.stringify({
        slug,
        style,
        visibleInTimeline,
        coverUrl,
        showCoverInTimeline,
        friendImage,
        coAuthorUserId,
        audioUrl,
        themeIds: [...selectedThemeIds].sort(),
        seriesPublicId: selectedSeriesPublicId,
    });
    const dirtyLocales = useMemo(() => new Set(POST_LOCALES.filter((locale) => (!draftsMatch(drafts[locale], savedDrafts[locale]) ||
        (locale === "pt" && currentSharedSignature !== savedSharedSignature)))), [currentSharedSignature, drafts, savedDrafts, savedSharedSignature]);
    const hasUnsavedChanges = dirtyLocales.size > 0;
    function updateDraft(locale: PostLocale, patch: Partial<LocalizedDraft>) {
        setDrafts((current) => ({
            ...current,
            [locale]: { ...current[locale], ...patch },
        }));
        setNotice("");
    }
    function updateActiveDraft(patch: Partial<LocalizedDraft>) {
        updateDraft(activeLocale, patch);
    }
    function handleTitleChange(value: string) {
        updateActiveDraft({ title: value });
        if (activeDraft.seoTitle.trim())
            return;
        if (activeLocale === "pt" && !slugEdited)
            setSlug(slugifyPostTitle(value));
        if (activeLocale !== "pt" && !localizedSlugEdited[activeLocale]) {
            updateActiveDraft({ title: value, localizedSlug: slugifyPostTitle(value) });
        }
    }
    function handleSeoTitleChange(value: string) {
        const patch: Partial<LocalizedDraft> = { seoTitle: value };
        if (activeLocale === "pt" && !slugEdited)
            setSlug(slugifyPostTitle(value || activeDraft.title));
        if (activeLocale !== "pt" && !localizedSlugEdited[activeLocale]) {
            patch.localizedSlug = slugifyPostTitle(value || activeDraft.title);
        }
        updateActiveDraft(patch);
    }
    const handleContentChange = useCallback((nextContent: string) => {
        setDrafts((current) => ({
            ...current,
            [activeLocale]: { ...current[activeLocale], content: nextContent },
        }));
        setNotice("");
    }, [activeLocale]);
    function readCurrentDraft(): LocalizedDraft {
        const content = editorRef.current
            ? readHtmlFromEditor(editorRef.current)
            : drafts[activeLocale].content;
        const next = { ...drafts[activeLocale], content };
        setDrafts((current) => ({ ...current, [activeLocale]: next }));
        return next;
    }
    function selectLocale(locale: PostLocale) {
        if (locale === activeLocale)
            return;
        readCurrentDraft();
        setActiveLocale(locale);
        setError("");
        setNotice("");
    }
    useEffect(() => {
        if (!hasUnsavedChanges)
            return;
        const warnBeforeUnload = (event: BeforeUnloadEvent) => {
            event.preventDefault();
            event.returnValue = true;
        };
        window.addEventListener("beforeunload", warnBeforeUnload);
        return () => window.removeEventListener("beforeunload", warnBeforeUnload);
    }, [hasUnsavedChanges]);
    useEffect(() => {
        const controller = new AbortController();
        async function loadCoAuthors() {
            setLoadingCoAuthors(true);
            setCoAuthorsError("");
            try {
                const response = await fetch("/api/admin/users", { signal: controller.signal });
                if (!response.ok)
                    throw new Error("Não foi possível carregar os coautores.");
                const data = await response.json() as {
                    users?: CoAuthorOption[];
                };
                if (!controller.signal.aborted)
                    setCoAuthors(Array.isArray(data.users) ? data.users : []);
            }
            catch {
                if (!controller.signal.aborted) {
                    setCoAuthors([]);
                    setCoAuthorsError("Não foi possível carregar os coautores.");
                }
            }
            finally {
                if (!controller.signal.aborted)
                    setLoadingCoAuthors(false);
            }
        }
        void loadCoAuthors();
        return () => controller.abort();
    }, []);
    useEffect(() => {
        const controller = new AbortController();
        fetch("/api/admin/series", { signal: controller.signal })
            .then(async (response) => {
            if (!response.ok)
                throw new Error();
            return response.json() as Promise<SeriesOption[]>;
        })
            .then((items) => { if (!controller.signal.aborted)
            setSeriesOptions(items); })
            .catch(() => { if (!controller.signal.aborted)
            setSeriesOptions([]); })
            .finally(() => { if (!controller.signal.aborted)
            setLoadingSeries(false); });
        return () => controller.abort();
    }, []);
    useEffect(() => {
        const controller = new AbortController();
        fetch("/api/admin/themes/defaults", { method: "POST", signal: controller.signal })
            .then(() => fetch("/api/admin/themes", { signal: controller.signal }))
            .then(async (response) => {
            if (!response.ok)
                throw new Error();
            return response.json() as Promise<ThemeOption[]>;
        })
            .then((items) => { if (!controller.signal.aborted)
            setThemes(items); })
            .catch(() => { if (!controller.signal.aborted)
            setThemes([]); });
        return () => controller.abort();
    }, []);
    useEffect(() => {
        if (error)
            errorRef.current?.focus();
    }, [error]);
    function handleCoAuthorChange(value: string) {
        setCoAuthorUserId(value);
        const user = coAuthors.find((item) => item.id === value);
        setFriendImage(user?.imageUrl ?? "");
        setNotice("");
    }
    async function uploadCover(file: File) {
        if (!ACCEPTED_COVER_TYPES.has(file.type)) {
            setError("Selecione um arquivo de imagem válido.");
            if (coverFileRef.current)
                coverFileRef.current.value = "";
            return;
        }
        if (file.size > 4 * 1024 * 1024) {
            setError("A imagem deve ter no máximo 4 MB.");
            if (coverFileRef.current)
                coverFileRef.current.value = "";
            return;
        }
        setUploadingCover(true);
        setError("");
        try {
            const form = new FormData();
            form.append("file", file);
            const res = await fetch("/api/admin/media", { method: "POST", body: form });
            const data = await res.json().catch(() => null);
            if (!res.ok || !data?.url)
                throw new Error(data?.error ?? "Erro ao enviar imagem.");
            setCoverUrl(data.url);
        }
        catch (caughtError) {
            setError(caughtError instanceof Error ? caughtError.message : "Erro ao enviar imagem.");
        }
        finally {
            setUploadingCover(false);
            if (coverFileRef.current)
                coverFileRef.current.value = "";
        }
    }
    async function save(published?: boolean) {
        if (saving)
            return;
        const locale = activeLocale;
        const draft = readCurrentDraft();
        if (!draft.title.trim() || !draft.content.trim() || (locale === "pt" && !slug.trim())) {
            setError(locale === "pt"
                ? "Título, slug e conteúdo são obrigatórios."
                : "Título e conteúdo são obrigatórios para salvar a tradução.");
            if (!draft.title.trim())
                requestAnimationFrame(() => titleRef.current?.focus());
            return;
        }
        if (locale !== "pt" && !postId) {
            setError("Salve primeiro a versão original em português. Seu rascunho desta tradução foi mantido.");
            return;
        }
        const willBePublished = published ?? activeVersion.published;
        if (willBePublished && editorRef.current) {
            try {
                assertPublicationCssIsValid(editorRef.current);
            }
            catch (error) {
                setError(error instanceof Error ? error.message : "Confira o CSS da publicação.");
                return;
            }
        }
        if (willBePublished && coverUrl.trim() && (!draft.coverAlt.trim()
            || draft.coverAlt.trim().toLocaleLowerCase() === draft.title.trim().toLocaleLowerCase())) {
            setError("Descreva o que aparece na imagem de capa. O texto alternativo não deve repetir o título.");
            return;
        }
        setSaving(true);
        setError("");
        setNotice("");
        const localizedBody = {
            locale,
            title: draft.title,
            seoTitle: draft.seoTitle.trim() || null,
            seoDescription: draft.seoDescription.trim() || null,
            subtitle: draft.subtitle.trim() || null,
            excerpt: draft.excerpt.trim() || null,
            coverAlt: draft.coverAlt.trim() || null,
            tags: draft.tags.split(",").map((tag) => tag.trim()).filter(Boolean),
            sources: sourcesFromText(draft.sources),
            content: draft.content,
        };
        const body = locale === "pt" ? {
            ...localizedBody,
            slug,
            style,
            hiddenFromTimeline: !visibleInTimeline,
            cover: coverUrl.trim() ? { url: coverUrl.trim(), alt: draft.coverAlt.trim() } : null,
            showCoverInTimeline: Boolean(coverUrl.trim()) && showCoverInTimeline,
            friendImage: friendImage.trim() || undefined,
            coAuthorUserId: coAuthorUserId.trim() || null,
            audioUrl: audioUrl.trim() || undefined,
            seriesPublicId: selectedSeriesPublicId || null,
        } : {
            ...localizedBody,
            ...(draft.localizedSlug.trim() ? { slug: draft.localizedSlug.trim() } : {}),
        };
        try {
            const creating = !postId;
            const res = await fetch(creating ? "/api/admin/posts" : `/api/admin/posts/${postId}`, {
                method: creating ? "POST" : "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(published === undefined ? body : { ...body, published }),
            });
            const data = await res.json().catch(() => null);
            if (!res.ok)
                throw new Error(data?.error ?? "Erro ao salvar.");
            const resolvedPostId = postId ?? data?._id;
            if (locale === "pt" && resolvedPostId) {
                const themesResponse = await fetch(`/api/admin/posts/${resolvedPostId}/themes`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ themeIds: selectedThemeIds }),
                });
                const themesData = await themesResponse.json().catch(() => null);
                if (!themesResponse.ok)
                    throw new Error(themesData?.error ?? "O post foi salvo, mas os temas não foram atualizados.");
            }
            if (locale === "pt") {
                const nextId = postId ?? data?._id;
                if (!nextId)
                    throw new Error("O post foi salvo, mas o identificador não foi retornado.");
                if (!postId) {
                    setPostId(nextId);
                    window.history.replaceState(null, "", `/admin/posts/${nextId}/edit`);
                }
                const nextOriginalUpdatedAt = data?.originalContentUpdatedAt ?? originalContentUpdatedAt;
                setOriginalContentUpdatedAt(nextOriginalUpdatedAt);
                setVersions((current) => ({
                    ...current,
                    pt: {
                        exists: true,
                        published: data?.published === true,
                        publishedAt: data?.publishedAt,
                        updatedAt: nextOriginalUpdatedAt,
                    },
                }));
                setSavedSharedSignature(currentSharedSignature);
            }
            else {
                const translation = data?.translation as StoredTranslation | undefined;
                if (!translation)
                    throw new Error("A tradução foi salva, mas seu estado não foi retornado.");
                setVersions((current) => ({
                    ...current,
                    [locale]: {
                        exists: true,
                        published: translation.published,
                        publishedAt: translation.publishedAt,
                        sourceUpdatedAt: translation.sourceUpdatedAt,
                        updatedAt: translation.updatedAt,
                    },
                }));
            }
            setSavedDrafts((current) => ({ ...current, [locale]: draft }));
            setNotice(`${POST_LOCALE_DETAILS[locale].adminLabel}: versão salva com sucesso.`);
        }
        catch (caughtError) {
            setError(caughtError instanceof Error ? caughtError.message : "Erro ao salvar.");
        }
        finally {
            setSaving(false);
        }
    }
    function localeStatus(locale: PostLocale) {
        const version = versions[locale];
        const dirty = dirtyLocales.has(locale);
        if (!version.exists) {
            return {
                label: locale === "pt" ? "Novo rascunho" : "Sem tradução",
                dirty,
            };
        }
        const stale = locale !== "pt" && version.exists && version.sourceUpdatedAt && originalContentUpdatedAt
            ? isTranslationRevisionStale(version.sourceUpdatedAt, originalContentUpdatedAt)
            : false;
        return {
            label: stale
                ? `${version.published ? "Publicado" : "Rascunho"} · revisão pendente`
                : version.published ? "Publicado" : "Rascunho",
            dirty,
        };
    }
    const activeVersion = versions[activeLocale];
    const activeStatus = localeStatus(activeLocale);
    const translationBlocked = activeLocale !== "pt" && !postId;
    function handleSlugChange(value: string) {
        if (activeLocale === "pt") {
            setSlug(value);
            setSlugEdited(true);
        } else {
            updateActiveDraft({ localizedSlug: value });
            setLocalizedSlugEdited(current => ({ ...current, [activeLocale]: true }));
        }
        setNotice("");
    }
    function toggleTheme(id: string, selected: boolean) {
        setSelectedThemeIds(current => selected ? [...current, id] : current.filter(value => value !== id));
        setNotice("");
    }
    return {
        handleSlugChange,
        toggleTheme,
        postId,
        setPostId,
        activeLocale,
        setActiveLocale,
        drafts,
        setDrafts,
        savedDrafts,
        setSavedDrafts,
        versions,
        setVersions,
        originalContentUpdatedAt,
        setOriginalContentUpdatedAt,
        slug,
        setSlug,
        slugEdited,
        setSlugEdited,
        localizedSlugEdited,
        setLocalizedSlugEdited,
        style,
        setStyle,
        visibleInTimeline,
        setVisibleInTimeline,
        coverUrl,
        setCoverUrl,
        showCoverInTimeline,
        setShowCoverInTimeline,
        friendImage,
        setFriendImage,
        coAuthorUserId,
        setCoAuthorUserId,
        coAuthors,
        setCoAuthors,
        loadingCoAuthors,
        setLoadingCoAuthors,
        coAuthorsError,
        setCoAuthorsError,
        themes,
        setThemes,
        selectedThemeIds,
        setSelectedThemeIds,
        seriesOptions,
        setSeriesOptions,
        selectedSeriesPublicId,
        setSelectedSeriesPublicId,
        loadingSeries,
        setLoadingSeries,
        audioUrl,
        setAudioUrl,
        saving,
        setSaving,
        uploadingCover,
        setUploadingCover,
        error,
        setError,
        notice,
        setNotice,
        initialSharedSignature,
        savedSharedSignature,
        setSavedSharedSignature,
        fieldId,
        coverFileRef,
        titleRef,
        errorRef,
        editorRef,
        activeDraft,
        currentSharedSignature,
        dirtyLocales,
        hasUnsavedChanges,
        updateDraft,
        updateActiveDraft,
        handleTitleChange,
        handleSeoTitleChange,
        handleContentChange,
        readCurrentDraft,
        selectLocale,
        handleCoAuthorChange,
        uploadCover,
        save,
        localeStatus,
        activeVersion,
        activeStatus,
        translationBlocked
    };
}
