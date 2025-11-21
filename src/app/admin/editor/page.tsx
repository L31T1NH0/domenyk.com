"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import DOMPurify from "dompurify";

import LexicalEditor from "../../../../components/editor/LexicalEditor";
import Toggle from "../../../../components/Toggle";
import { renderMarkdown } from "../../../lib/renderers/markdown";

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
  const [isLoadingCoAuthors, setIsLoadingCoAuthors] = useState(false);
  const [tags, setTags] = useState("");
  const [hasAudio, setHasAudio] = useState(false);
  const [audioUrl, setAudioUrl] = useState("");
  const [hidden, setHidden] = useState(false);
  const [paragraphCommentsEnabled, setParagraphCommentsEnabled] = useState(true);
  const [content, setContent] = useState("");
  const [previewHtml, setPreviewHtml] = useState("");
  const [previewStatus, setPreviewStatus] = useState<"idle" | "loading" | "error">(
    "idle"
  );
  const [showPreview, setShowPreview] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEditorFocused, setIsEditorFocused] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [coAuthorError, setCoAuthorError] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const previewTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
    "w-full rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3 text-sm text-zinc-100 shadow-inner shadow-black/20 transition focus:border-emerald-400/80 focus:outline-none focus:ring-2 focus:ring-emerald-500/25 placeholder:text-zinc-500";

  const labelStyle = "text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500";

  const hintText = "text-sm text-zinc-400";

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

  useEffect(() => {
    if (previewTimeoutRef.current) {
      clearTimeout(previewTimeoutRef.current);
    }

    if (!content.trim()) {
      setPreviewHtml("");
      setPreviewStatus("idle");
      return;
    }

    setPreviewStatus("loading");

    previewTimeoutRef.current = setTimeout(async () => {
      try {
        const rendered = await renderMarkdown(content);
        setPreviewHtml(DOMPurify.sanitize(rendered));
        setPreviewStatus("idle");
      } catch (previewError) {
        console.error("Preview render failed", previewError);
        setPreviewStatus("error");
      }
    }, 300);

    return () => {
      if (previewTimeoutRef.current) {
        clearTimeout(previewTimeoutRef.current);
      }
    };
  }, [content]);

  const editorBorder = useMemo(
    () =>
      isEditorFocused
        ? "ring-2 ring-emerald-500/40 border-emerald-500/40"
        : "border-white/5",
    [isEditorFocused]
  );

  useEffect(() => {
    const loadCoAuthors = async () => {
      try {
        setIsLoadingCoAuthors(true);
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
      } finally {
        setIsLoadingCoAuthors(false);
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

  return (
    <div className="min-h-screen bg-[#0c0e14] py-12 text-zinc-100">
      <div className="mx-auto max-w-6xl px-5">
        <header className="mb-10 flex flex-col gap-3 text-center lg:flex-row lg:items-end lg:justify-between lg:text-left">
          <div className="space-y-2">
            <p className="text-[11px] uppercase tracking-[0.28em] text-zinc-500">
              Painel editorial
            </p>
            <h1 className="text-4xl font-semibold leading-tight text-zinc-50 sm:text-5xl">
              Novo post
            </h1>
            <p className="max-w-2xl text-base text-zinc-400">
              Estruture seu artigo e preencha os metadados essenciais de forma direta.
            </p>
          </div>
          <div className="flex items-center gap-3 self-start rounded-2xl border border-white/5 bg-white/5 px-4 py-3 text-sm text-zinc-200 shadow-sm shadow-black/20">
            <div>
              <p className="text-[11px] uppercase tracking-[0.16em] text-emerald-300/80">
                Preview
              </p>
              <p className="text-xs text-zinc-400">Visualização opcional do conteúdo</p>
            </div>
            <Toggle
              checked={showPreview}
              onChange={setShowPreview}
              ariaLabel="Alternar pré-visualização"
            />
          </div>
        </header>

        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="grid gap-6 lg:grid-cols-[1.5fr,1fr] xl:grid-cols-[1.6fr,1fr]">
            <div className="space-y-4">
              <div className="rounded-2xl border border-white/5 bg-white/5 p-6 shadow-lg shadow-black/20">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-zinc-200">Conteúdo</p>
                  <span className="text-xs uppercase tracking-[0.2em] text-emerald-300/90">
                    Canvas
                  </span>
                </div>

                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <label className="flex flex-col gap-2">
                    <span className={labelStyle}>Título</span>
                    <input
                      name="title"
                      className={inputStyle}
                      type="text"
                      placeholder="Um título marcante"
                      value={title}
                      onChange={(e) => {
                        clearFieldError("title");
                        markDirty();
                        setTitle(e.target.value);
                      }}
                      required
                    />
                    {validationErrors.title && (
                      <span className="text-xs text-red-400">{validationErrors.title}</span>
                    )}
                  </label>
                  <label className="flex flex-col gap-2">
                    <span className={labelStyle}>Subtítulo</span>
                    <input
                      name="subtitle"
                      className={inputStyle}
                      type="text"
                      placeholder="Complemento do título"
                      value={subtitle}
                      onChange={(e) => {
                        markDirty();
                        setSubtitle(e.target.value);
                      }}
                    />
                  </label>
                </div>

                <div className="mt-6 rounded-2xl border border-white/5 bg-black/30 p-2 shadow-inner shadow-black/30 transition-all">
                  <div
                    className={`rounded-2xl bg-[#0f1117] ${editorBorder} transition duration-200`}
                  >
                    <div className="flex items-center justify-between px-4 pb-3 pt-4">
                      <div>
                        <p className="text-sm font-semibold text-zinc-200">Editor</p>
                        <p className={hintText}>Espaço inspirado no Notion e Obsidian.</p>
                      </div>
                      <span className="rounded-full border border-emerald-400/30 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-200">
                        Focus
                      </span>
                    </div>
                    <LexicalEditor
                      value={content}
                      onChange={handleContentChange}
                      onFocusChange={setIsEditorFocused}
                    />
                    {validationErrors.content && (
                      <p className="px-4 pb-2 text-xs text-red-400">{validationErrors.content}</p>
                    )}
                  </div>
                </div>
                {showPreview && (
                  <div className="mt-4 rounded-2xl border border-white/5 bg-white/5 p-4 shadow-inner shadow-black/20">
                    <div className="mb-3 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-zinc-200">Preview</p>
                        <p className={hintText}>
                          {previewStatus === "loading"
                            ? "Renderizando preview..."
                            : previewStatus === "error"
                              ? "Falha ao gerar preview."
                              : "Renderização em tempo real em Markdown."}
                        </p>
                      </div>
                      <span className="rounded-full border border-emerald-400/30 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-200">
                        Live
                      </span>
                    </div>
                    <div
                      className="min-h-[160px] space-y-3 rounded-xl border border-white/5 bg-black/30 px-4 py-3 text-sm leading-relaxed text-zinc-100"
                      dangerouslySetInnerHTML={{
                        __html:
                          previewStatus === "error"
                            ? "<p class='text-red-400'>Erro ao gerar preview. Verifique o conteúdo.</p>"
                            : previewHtml ||
                              "<p class='text-zinc-500'>Nada para pré-visualizar ainda.</p>",
                      }}
                    />
                  </div>
                )}
              </div>
            </div>

            <aside className="space-y-4 lg:sticky lg:top-4">
              <div className="rounded-2xl border border-white/5 bg-white/5 p-5 shadow-lg shadow-black/20">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-zinc-200">Visibilidade</p>
                  <span className="text-xs uppercase tracking-[0.2em] text-zinc-500">Meta</span>
                </div>
                <div className="mt-4 space-y-4">
                  <div className="flex items-start justify-between gap-3 rounded-xl border border-white/5 bg-white/[0.01] p-4">
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-zinc-100">Ocultar post</p>
                      <p className={hintText}>Mantém o conteúdo fora das listagens públicas.</p>
                    </div>
                    <Toggle
                      checked={hidden}
                      onChange={(value) => {
                        markDirty();
                        setHidden(value);
                      }}
                      ariaLabel="Ocultar post nas listagens públicas"
                    />
                  </div>
                  <div className="flex items-start justify-between gap-3 rounded-xl border border-white/5 bg-white/[0.01] p-4">
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-zinc-100">
                        Permitir comentários por parágrafo
                      </p>
                      <p className={hintText}>Ativa as anotações nos blocos de texto.</p>
                    </div>
                    <Toggle
                      checked={paragraphCommentsEnabled}
                      onChange={(value) => {
                        markDirty();
                        setParagraphCommentsEnabled(value);
                      }}
                      ariaLabel="Permitir comentários por parágrafo"
                    />
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-white/5 bg-white/5 p-5 shadow-lg shadow-black/20">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-zinc-200">Mídia & tags</p>
                  <span className="text-xs uppercase tracking-[0.2em] text-zinc-500">Detalhes</span>
                </div>
                <div className="mt-5 space-y-4">
                  <label className="flex flex-col gap-2">
                    <span className={labelStyle}>Capa</span>
                    <input
                      name="cape"
                      className={inputStyle}
                      type="text"
                      placeholder="URL da imagem de capa"
                      value={cape}
                      onChange={(e) => {
                        markDirty();
                        clearFieldError("cape");
                        setCape(e.target.value);
                      }}
                    />
                    {validationErrors.cape && (
                      <span className="text-xs text-red-400">{validationErrors.cape}</span>
                    )}
                  </label>
                  <label className="flex flex-col gap-3">
                    <span className={labelStyle}>Co-autor</span>
                    <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2">
                      <select
                        name="coAuthorUserId"
                        className="w-full bg-transparent py-2 text-sm text-zinc-100 outline-none"
                        value={coAuthorUserId}
                        onChange={(e) => handleSelectCoAuthor(e.target.value)}
                      >
                        <option value="" className="bg-[#0c0e14] text-zinc-200">
                          Selecionar co-autor (opcional)
                        </option>
                        {coAuthors.map((user) => (
                          <option
                            key={user.id}
                            value={user.id}
                            className="bg-[#0c0e14] text-zinc-100"
                          >
                            {user.name}
                          </option>
                        ))}
                      </select>
                      <div className="mt-2 flex items-center justify-between text-xs text-zinc-400">
                        <span>
                          {isLoadingCoAuthors
                            ? "Carregando usuários..."
                            : coAuthorUserId
                              ? "Co-autor vinculado"
                              : "Sem co-autor"}
                        </span>
                        {friendImage && (
                          <span className="text-emerald-300">Foto aplicada</span>
                        )}
                      </div>
                      {coAuthorError && (
                        <p className="mt-2 text-xs text-red-400">{coAuthorError}</p>
                      )}
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
                      onChange={(e) => {
                        markDirty();
                        setTags(e.target.value);
                      }}
                    />
                  </label>
                </div>
              </div>

              <div className="rounded-2xl border border-white/5 bg-white/5 p-5 shadow-lg shadow-black/20">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-zinc-200">Áudio</p>
                  <span className="text-xs uppercase tracking-[0.2em] text-zinc-500">Opcional</span>
                </div>
                <div className="mt-4 space-y-3">
                  <div className="flex items-start justify-between gap-3 rounded-xl border border-white/5 bg-white/[0.01] p-4">
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-zinc-100">Este post possui áudio?</p>
                      <p className={hintText}>Habilite para adicionar uma trilha ou narração.</p>
                    </div>
                    <Toggle
                      checked={hasAudio}
                      onChange={(value) => {
                        markDirty();
                        clearFieldError("audioUrl");
                        setHasAudio(value);
                        if (!value) {
                          setAudioUrl("");
                        }
                      }}
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
                        onChange={(e) => {
                          markDirty();
                          clearFieldError("audioUrl");
                          setAudioUrl(e.target.value);
                        }}
                      />
                      {validationErrors.audioUrl && (
                        <span className="text-xs text-red-400">{validationErrors.audioUrl}</span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-white/5 bg-white/5 p-5 shadow-lg shadow-black/20">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-zinc-200">Publicação</p>
                  <span className="text-xs uppercase tracking-[0.2em] text-zinc-500">Controle</span>
                </div>
                <div className="mt-5 space-y-4">
                  <label className="flex flex-col gap-2">
                    <span className={labelStyle}>Post ID</span>
                    <input
                      name="postId"
                      className={inputStyle}
                      type="text"
                      placeholder="Identificador único do post"
                      value={postId}
                      onChange={(e) => {
                        clearFieldError("postId");
                        markDirty();
                        setPostId(e.target.value);
                      }}
                      required
                    />
                    {validationErrors.postId && (
                      <span className="text-xs text-red-400">{validationErrors.postId}</span>
                    )}
                  </label>

                  <button
                    type="submit"
                    className="group inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-400 px-4 py-3 text-sm font-semibold text-zinc-950 shadow-lg shadow-emerald-500/25 transition duration-200 hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={isSubmitting}
                  >
                    <span className="transition group-hover:translate-y-[-1px]">
                      {isSubmitting ? "Publicando..." : "Publicar post"}
                    </span>
                  </button>
                </div>
              </div>
            </aside>
          </div>

          {(success || error) && (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center shadow-md shadow-black/20">
              {success && (
                <p className="text-sm font-medium text-emerald-400">{success}</p>
              )}
              {error && (
                <p className="text-sm font-medium text-red-400">{error}</p>
              )}
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
