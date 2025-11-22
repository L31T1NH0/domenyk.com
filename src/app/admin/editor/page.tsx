"use client";

import Image from "next/image";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import { Layout } from "@components/layout";
import { BackHome } from "@components/back-home";
import LexicalEditor from "../../../../components/editor/LexicalEditor";
import Toggle from "../../../../components/Toggle";
import PostContentShell from "../../posts/[id]/post-content-interactive";

const FALLBACK_IMAGE = "/images/profile.jpg";

function calculateReadingTime(markdown: string): string {
  const wordsPerMinute = 200;
  const words = markdown.trim() ? markdown.trim().split(/\s+/).length : 0;
  const minutes = Math.max(1, Math.ceil(words / wordsPerMinute));
  return `${minutes} min`;
}

type EditableHeaderProps = {
  title: string;
  subtitle: string;
  cape: string;
  friendImage: string;
  coAuthorImage?: string | null;
  onTitleChange: (value: string) => void;
  onSubtitleChange: (value: string) => void;
  onCapeEditRequest: () => void;
  titleError?: string;
};

function EditablePostHeader({
  title,
  subtitle,
  cape,
  friendImage,
  coAuthorImage,
  onTitleChange,
  onSubtitleChange,
  onCapeEditRequest,
  titleError,
}: EditableHeaderProps) {
  const secondaryImage = coAuthorImage || friendImage || undefined;

  return (
    <div className="relative overflow-hidden rounded-3xl border border-white/5 bg-[#0c0e14]">
      {cape && (
        <Image
          src={cape}
          alt="Capa do post"
          width={1920}
          height={1080}
          className="banner w-full h-auto object-cover"
          priority
        />
      )}

      <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-[#040404]/70 via-[#040404]/40 to-[#040404]/90" />

      <div className="absolute right-4 top-4 z-10 flex gap-2">
        <button
          type="button"
          onClick={onCapeEditRequest}
          className="pointer-events-auto rounded-full border border-white/20 bg-black/40 px-4 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-white backdrop-blur transition hover:border-white/40"
        >
          Trocar capa
        </button>
      </div>

      <div className="absolute bottom-3 left-4 z-10 flex flex-col gap-3 max-w-[80%]">
        <div className="flex -space-x-4">
          <Image
            priority
            src={FALLBACK_IMAGE}
            className="foto-post"
            height={56}
            width={56}
            alt="Domenyk"
          />
          {secondaryImage && (
            <Image
              src={secondaryImage}
              className="foto-post"
              height={56}
              width={56}
              alt="Coautor"
            />
          )}
        </div>

        <input
          className="bg-transparent text-xl text-white focus:outline-none focus:ring-0 font-semibold placeholder:text-zinc-400"
          placeholder="Título do post"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
        />
        {titleError && <span className="text-xs text-red-300">{titleError}</span>}
        <input
          className="bg-transparent text-sm text-zinc-200 focus:outline-none focus:ring-0 placeholder:text-zinc-500"
          placeholder="Subtítulo (opcional)"
          value={subtitle}
          onChange={(e) => onSubtitleChange(e.target.value)}
        />
      </div>

      {!cape && (
        <div className="flex flex-col items-center gap-3 px-6 py-8 text-center">
          <div className="flex -space-x-4">
            <Image
              priority
              src={FALLBACK_IMAGE}
              className="rounded-full brightness-125 foto"
              height={148}
              width={148}
              alt="Domenyk"
            />
            {secondaryImage && (
              <Image
                src={secondaryImage}
                className="rounded-full brightness-125 foto"
                height={148}
                width={148}
                alt="Coautor"
              />
            )}
          </div>
          <input
            className="w-full bg-transparent text-center text-3xl font-semibold text-zinc-50 focus:outline-none placeholder:text-zinc-500"
            placeholder="Título do post"
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
          />
          <input
            className="w-full bg-transparent text-center text-base text-zinc-400 focus:outline-none placeholder:text-zinc-600"
            placeholder="Subtítulo (opcional)"
            value={subtitle}
            onChange={(e) => onSubtitleChange(e.target.value)}
          />
          {titleError && <span className="text-xs text-red-300">{titleError}</span>}
        </div>
      )}
    </div>
  );
}

type MetadataPanelProps = {
  isOpen: boolean;
  onClose: () => void;
  inputStyle: string;
  labelStyle: string;
  hintText: string;
  hidden: boolean;
  paragraphCommentsEnabled: boolean;
  hasAudio: boolean;
  audioUrl: string;
  cape: string;
  tags: string;
  postId: string;
  coAuthorUserId: string;
  coAuthors: { id: string; name: string; imageUrl: string | null }[];
  coAuthorError: string | null;
  validationErrors: Record<string, string>;
  onToggleHidden: (value: boolean) => void;
  onToggleParagraphComments: (value: boolean) => void;
  onToggleHasAudio: (value: boolean) => void;
  onAudioUrlChange: (value: string) => void;
  onCapeChange: (value: string) => void;
  onTagsChange: (value: string) => void;
  onPostIdChange: (value: string) => void;
  onSelectCoAuthor: (value: string) => void;
};

function MetadataPanel({
  isOpen,
  onClose,
  inputStyle,
  labelStyle,
  hintText,
  hidden,
  paragraphCommentsEnabled,
  hasAudio,
  audioUrl,
  cape,
  tags,
  postId,
  coAuthorUserId,
  coAuthors,
  coAuthorError,
  validationErrors,
  onToggleHidden,
  onToggleParagraphComments,
  onToggleHasAudio,
  onAudioUrlChange,
  onCapeChange,
  onTagsChange,
  onPostIdChange,
  onSelectCoAuthor,
}: MetadataPanelProps) {
  return (
    <div
      className={`pointer-events-auto fixed right-4 top-20 z-30 w-80 max-h-[calc(100vh-6rem)] overflow-y-auto rounded-2xl border border-white/10 bg-[#0b0d12]/95 p-4 shadow-2xl shadow-black/40 backdrop-blur transition duration-200 ${
        isOpen ? "opacity-100 translate-y-0" : "pointer-events-none opacity-0 translate-y-4"
      }`}
    >
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold text-zinc-100">Metadados do post</p>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full border border-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-300 hover:border-white/30"
        >
          Fechar
        </button>
      </div>

      <div className="space-y-4 text-sm">
        <div className="flex items-start justify-between gap-3 rounded-lg bg-white/[0.02] p-3">
          <div className="space-y-1">
            <p className="text-sm font-medium text-zinc-100">Ocultar post</p>
            <p className={hintText}>Mantém o conteúdo fora das listagens públicas.</p>
          </div>
          <Toggle
            checked={hidden}
            onChange={onToggleHidden}
            ariaLabel="Ocultar post nas listagens públicas"
          />
        </div>

        <div className="flex items-start justify-between gap-3 rounded-lg bg-white/[0.02] p-3">
          <div className="space-y-1">
            <p className="text-sm font-medium text-zinc-100">Comentários por parágrafo</p>
            <p className={hintText}>Ativa as anotações nos blocos de texto.</p>
          </div>
          <Toggle
            checked={paragraphCommentsEnabled}
            onChange={onToggleParagraphComments}
            ariaLabel="Permitir comentários por parágrafo"
          />
        </div>

        <label className="flex flex-col gap-2">
          <span className={labelStyle}>Capa</span>
          <input
            name="cape"
            className={inputStyle}
            type="text"
            placeholder="URL da imagem de capa"
            value={cape}
            onChange={(e) => onCapeChange(e.target.value)}
          />
          {validationErrors.cape && <span className="text-xs text-red-400">{validationErrors.cape}</span>}
        </label>

        <label className="flex flex-col gap-2">
          <span className={labelStyle}>Co-autor</span>
          <div className="rounded-lg border border-white/10 bg-[#0d1017] px-3 py-2">
            <select
              name="coAuthorUserId"
              className="w-full bg-transparent py-2 text-sm text-zinc-100 outline-none"
              value={coAuthorUserId}
              onChange={(e) => onSelectCoAuthor(e.target.value)}
            >
              <option value="" className="bg-[#0c0e14] text-zinc-200">
                Selecionar co-autor (opcional)
              </option>
              {coAuthors.map((user) => (
                <option key={user.id} value={user.id} className="bg-[#0c0e14] text-zinc-100">
                  {user.name}
                </option>
              ))}
            </select>
            <div className="mt-2 flex items-center justify-between text-xs text-zinc-500">
              <span>{coAuthorUserId ? "Co-autor vinculado" : "Sem co-autor"}</span>
              {coAuthorUserId && <span className="text-emerald-300">Ativo</span>}
            </div>
            {coAuthorError && <p className="mt-2 text-xs text-red-400">{coAuthorError}</p>}
          </div>
        </label>

        <label className="flex flex-col gap-2">
          <span className={labelStyle}>Tags</span>
          <input
            name="tags"
            className={inputStyle}
            type="text"
            placeholder="separe por vírgulas"
            value={tags}
            onChange={(e) => onTagsChange(e.target.value)}
          />
        </label>

        <div className="space-y-3 rounded-lg border border-white/10 bg-white/[0.02] p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <p className="text-sm font-medium text-zinc-100">Este post possui áudio?</p>
              <p className={hintText}>Habilite para adicionar uma trilha ou narração.</p>
            </div>
            <Toggle
              checked={hasAudio}
              onChange={onToggleHasAudio}
              ariaLabel="Este post possui áudio"
            />
          </div>
          {hasAudio && (
            <div className="space-y-1">
              <input
                name="audioUrl"
                className={inputStyle}
                type="text"
                placeholder="URL do áudio"
                value={audioUrl}
                onChange={(e) => onAudioUrlChange(e.target.value)}
              />
              {validationErrors.audioUrl && <span className="text-xs text-red-400">{validationErrors.audioUrl}</span>}
            </div>
          )}
        </div>

        <label className="flex flex-col gap-2">
          <span className={labelStyle}>Post ID</span>
          <input
            name="postId"
            className={inputStyle}
            type="text"
            placeholder="Identificador único do post"
            value={postId}
            onChange={(e) => onPostIdChange(e.target.value)}
            required
          />
          {validationErrors.postId && <span className="text-xs text-red-400">{validationErrors.postId}</span>}
        </label>
      </div>
    </div>
  );
}

export default function Editor() {
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [postId, setPostId] = useState("");
  const [cape, setCape] = useState("");
  const [friendImage, setFriendImage] = useState("");
  const [coAuthorUserId, setCoAuthorUserId] = useState("");
  const [coAuthors, setCoAuthors] = useState<
    { id: string; name: string; imageUrl: string | null }[]
  >([]);
  const [tags, setTags] = useState("");
  const [hasAudio, setHasAudio] = useState(false);
  const [audioUrl, setAudioUrl] = useState("");
  const [hidden, setHidden] = useState(false);
  const [paragraphCommentsEnabled, setParagraphCommentsEnabled] = useState(true);
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEditorFocused, setIsEditorFocused] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [coAuthorError, setCoAuthorError] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [isMetadataOpen, setIsMetadataOpen] = useState(false);
  const markDirty = useCallback(() => setIsDirty(true), []);
  const clearFieldError = useCallback((field: string) => {
    setValidationErrors((prev) => {
      if (!(field in prev)) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }, []);

  const inputStyle =
    "w-full rounded-lg border border-white/10 bg-[#0d1017] px-3 py-2.5 text-sm text-zinc-100 transition focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 placeholder:text-zinc-500";

  const labelStyle = "text-xs font-medium uppercase tracking-[0.12em] text-zinc-500";

  const hintText = "text-sm text-zinc-500";

  const validateUrl = useCallback((value: string) => {
    if (!value.trim()) return true;
    try {
      const parsed = new URL(value.trim());
      return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch {
      return false;
    }
  }, []);

  const validateForm = useCallback(() => {
    const nextErrors: Record<string, string> = {};

    if (!title.trim()) {
      nextErrors.title = "Título é obrigatório.";
    }

    if (!postId.trim()) {
      nextErrors.postId = "Post ID é obrigatório.";
    }

    if (!content.trim()) {
      nextErrors.content = "Escreva algo antes de publicar.";
    }

    if (cape && !validateUrl(cape)) {
      nextErrors.cape = "Informe uma URL válida para a capa.";
    }

    if (hasAudio && !audioUrl.trim()) {
      nextErrors.audioUrl = "Informe a URL do áudio.";
    } else if (audioUrl && !validateUrl(audioUrl)) {
      nextErrors.audioUrl = "URL de áudio inválida.";
    }

    setValidationErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }, [audioUrl, cape, content, hasAudio, postId, title, validateUrl]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (isSubmitting) return;

    const isValid = validateForm();
    if (!isValid) {
      setError("Corrija os campos destacados antes de publicar.");
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      setSuccess(null);
      setValidationErrors({});

      const formData = new FormData();
      formData.append("title", title);
      formData.append("subtitle", subtitle);
      formData.append("postId", postId);
      formData.append("contentMarkdown", content);
      formData.append("tags", tags);
      formData.append("cape", cape);
      if (friendImage) {
        formData.append("friendImage", friendImage);
      }
      if (coAuthorUserId) {
        formData.append("coAuthorUserId", coAuthorUserId);
      }
      if (hasAudio && audioUrl) {
        formData.append("audioUrl", audioUrl);
      }

      formData.append("hidden", hidden ? "true" : "false");
      formData.append(
        "paragraphCommentsEnabled",
        paragraphCommentsEnabled ? "true" : "false"
      );

      const response = await fetch("/admin/api/editor", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create post");
      }

      await response.json();
      setSuccess("Post criado com sucesso!");
      setTitle("");
      setSubtitle("");
      setPostId("");
      setCape("");
      setFriendImage("");
      setCoAuthorUserId("");
      setTags("");
      setHasAudio(false);
      setAudioUrl("");
      setHidden(false);
      setParagraphCommentsEnabled(true);
      setContent("");
      setIsDirty(false);
    } catch (error) {
      setError("Falha ao criar o post: " + (error as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleContentChange = (value: string) => {
    clearFieldError("content");
    markDirty();
    setContent(value);
  };

  const editorBorder = useMemo(
    () =>
      isEditorFocused
        ? "border-emerald-400/50 ring-2 ring-emerald-500/20"
        : "border-white/10",
    [isEditorFocused]
  );

  useEffect(() => {
    const loadCoAuthors = async () => {
      try {
        setCoAuthorError(null);
        const response = await fetch("/admin/api/users");
        if (!response.ok) {
          setCoAuthors([]);
          setCoAuthorError("Não foi possível carregar os co-autores.");
          return;
        }
        const data = await response.json();
        const parsed = (data?.users ?? []).map(
          (user: { id: string; firstName?: string | null; lastName?: string | null; imageUrl?: string | null }) => ({
            id: user.id,
            name: `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || "Usuário sem nome",
            imageUrl: user.imageUrl ?? null,
          })
        );
        setCoAuthors(parsed);
      } catch (coAuthorLoadError) {
        console.error("Failed to fetch co-authors", coAuthorLoadError);
        setCoAuthorError("Não foi possível carregar os co-autores.");
      }
    };

    loadCoAuthors();
  }, []);

  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (!isDirty || isSubmitting) return;
      event.preventDefault();
      // eslint-disable-next-line no-param-reassign
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty, isSubmitting]);

  const handleSelectCoAuthor = (userId: string) => {
    markDirty();
    setCoAuthorUserId(userId);
    const selected = coAuthors.find((user) => user.id === userId);
    setFriendImage(selected?.imageUrl ?? "");
  };

  const readingTime = useMemo(() => calculateReadingTime(content), [content]);
  const draftDate = useMemo(() => new Date().toISOString(), []);
  const audioSource = hasAudio ? audioUrl : undefined;

  return (
    <Layout title={title || "Novo post"} description={subtitle || undefined} url="/admin/editor">
      <form onSubmit={handleSubmit} className="relative space-y-6 pb-10">
        <EditablePostHeader
          title={title}
          subtitle={subtitle}
          cape={cape}
          friendImage={friendImage || ""}
          coAuthorImage={friendImage || null}
          onTitleChange={(value) => {
            clearFieldError("title");
            markDirty();
            setTitle(value);
          }}
          onSubtitleChange={(value) => {
            markDirty();
            setSubtitle(value);
          }}
          onCapeEditRequest={() => setIsMetadataOpen(true)}
          titleError={validationErrors.title}
        />

        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-zinc-400">
          <div className="flex items-center gap-3">
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-200">
              Modo edição
            </span>
            <p className="text-zinc-500">Visualize o texto final enquanto escreve.</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsMetadataOpen((open) => !open)}
              className="rounded-full border border-white/10 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-200 transition hover:border-white/30"
            >
              Metadados
            </button>
            <button
              type="submit"
              className="rounded-full bg-emerald-400 px-5 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-70"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Publicando..." : "Publicar post"}
            </button>
          </div>
        </div>

        <PostContentShell
          postId={postId || "rascunho"}
          date={draftDate}
          readingTime={readingTime}
          initialViews={0}
          audioUrl={audioSource}
          disableViewTracking
          hideShareButton
        >
          <div
            className={`rounded-2xl border bg-white/[0.02] ${editorBorder} transition duration-200`}
          >
            <div className="flex items-center justify-between px-4 pb-2 pt-4">
              <div>
                <p className="text-sm font-semibold text-zinc-200">Conteúdo</p>
                <p className={hintText}>O texto acima é exatamente o que será publicado.</p>
              </div>
              {validationErrors.content && (
                <span className="text-xs text-red-400">{validationErrors.content}</span>
              )}
            </div>
            <div className="border-t border-white/5">
              <LexicalEditor
                value={content}
                onChange={handleContentChange}
                onFocusChange={setIsEditorFocused}
                appearance="inline"
              />
            </div>
          </div>
        </PostContentShell>

        {(success || error) && (
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 text-center">
            {success && <p className="text-sm font-medium text-emerald-400">{success}</p>}
            {error && <p className="text-sm font-medium text-red-400">{error}</p>}
          </div>
        )}

        <BackHome />

        <MetadataPanel
          isOpen={isMetadataOpen}
          onClose={() => setIsMetadataOpen(false)}
          inputStyle={inputStyle}
          labelStyle={labelStyle}
          hintText={hintText}
          hidden={hidden}
          paragraphCommentsEnabled={paragraphCommentsEnabled}
          hasAudio={hasAudio}
          audioUrl={audioUrl}
          cape={cape}
          tags={tags}
          postId={postId}
          coAuthorUserId={coAuthorUserId}
          coAuthors={coAuthors}
          coAuthorError={coAuthorError}
          validationErrors={validationErrors}
          onToggleHidden={(value) => {
            markDirty();
            setHidden(value);
          }}
          onToggleParagraphComments={(value) => {
            markDirty();
            setParagraphCommentsEnabled(value);
          }}
          onToggleHasAudio={(value) => {
            markDirty();
            clearFieldError("audioUrl");
            setHasAudio(value);
            if (!value) {
              setAudioUrl("");
            }
          }}
          onAudioUrlChange={(value) => {
            markDirty();
            clearFieldError("audioUrl");
            setAudioUrl(value);
          }}
          onCapeChange={(value) => {
            markDirty();
            clearFieldError("cape");
            setCape(value);
          }}
          onTagsChange={(value) => {
            markDirty();
            setTags(value);
          }}
          onPostIdChange={(value) => {
            clearFieldError("postId");
            markDirty();
            setPostId(value);
          }}
          onSelectCoAuthor={(userId) => {
            handleSelectCoAuthor(userId);
          }}
        />
      </form>
    </Layout>
  );
}
