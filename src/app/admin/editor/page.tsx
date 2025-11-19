"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import DOMPurify from "dompurify";
import { remark } from "remark";
import remarkGfm from "remark-gfm";
import remarkHtml from "remark-html";

import LexicalEditor from "../../../../components/editor/LexicalEditor";
import Toggle from "../../../../components/Toggle";

export default function Editor() {
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [postId, setPostId] = useState("");
  const [cape, setCape] = useState("");
  const [friendImage, setFriendImage] = useState("");
  const [tags, setTags] = useState("");
  const [hasAudio, setHasAudio] = useState(false);
  const [audioUrl, setAudioUrl] = useState("");
  const [hidden, setHidden] = useState(false);
  const [paragraphCommentsEnabled, setParagraphCommentsEnabled] = useState(true);
  const [content, setContent] = useState("");
  const [previewHtml, setPreviewHtml] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEditorFocused, setIsEditorFocused] = useState(false);

  const inputStyle =
    "w-full rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3 text-sm text-zinc-100 shadow-inner shadow-black/20 transition focus:border-emerald-400/80 focus:outline-none focus:ring-2 focus:ring-emerald-500/25 placeholder:text-zinc-500";

  const labelStyle = "text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500";

  const hintText = "text-sm text-zinc-400";

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (isSubmitting) return;

    try {
      setIsSubmitting(true);
      setError(null);
      setSuccess(null);

      const formData = new FormData();
      formData.append("title", title);
      formData.append("subtitle", subtitle);
      formData.append("postId", postId);
      formData.append("content", content);
      formData.append("tags", tags);
      formData.append("cape", cape);
      formData.append("friendImage", friendImage);
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
      setTags("");
      setHasAudio(false);
      setAudioUrl("");
      setHidden(false);
      setParagraphCommentsEnabled(true);
      setContent("");
    } catch (error) {
      setError("Falha ao criar o post: " + (error as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleContentChange = (value: string) => {
    setContent(value);
  };

  useEffect(() => {
    const convert = async () => {
      const processed = await remark()
        .use(remarkGfm)
        .use(remarkHtml)
        .process(content || "");

      setPreviewHtml(DOMPurify.sanitize(String(processed)));
    };

    convert();
  }, [content]);

  const editorBorder = useMemo(
    () =>
      isEditorFocused
        ? "ring-2 ring-emerald-500/40 border-emerald-500/40"
        : "border-white/5",
    [isEditorFocused]
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0c0e14] via-[#0f1118] to-[#0c0f14] py-14 text-zinc-100">
      <div className="mx-auto max-w-6xl px-6">
        <header className="mb-12 space-y-3 text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">
            Painel editorial
          </p>
          <h1 className="text-4xl font-semibold leading-tight text-zinc-50 sm:text-5xl">
            Novo post
          </h1>
          <p className="mx-auto max-w-2xl text-base text-zinc-400">
            Estruture seu artigo, adicione detalhes na barra lateral e publique com um toque.
          </p>
        </header>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-[1.6fr,1fr]">
            <div className="space-y-4">
              <div className="rounded-3xl border border-white/5 bg-white/[0.02] p-6 shadow-xl shadow-black/30 backdrop-blur-md">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-zinc-200">Conteúdo</p>
                  <span className="text-xs uppercase tracking-[0.2em] text-emerald-400/90">
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
                      onChange={(e) => setTitle(e.target.value)}
                      required
                    />
                  </label>
                  <label className="flex flex-col gap-2">
                    <span className={labelStyle}>Subtítulo</span>
                    <input
                      name="subtitle"
                      className={inputStyle}
                      type="text"
                      placeholder="Complemento do título"
                      value={subtitle}
                      onChange={(e) => setSubtitle(e.target.value)}
                    />
                  </label>
                </div>

                <div className="mt-6 rounded-2xl border border-white/5 bg-gradient-to-b from-white/5 via-white/[0.02] to-white/[0.01] p-2 shadow-inner shadow-black/40 transition-all">
                  <div
                    className={`rounded-2xl bg-[#0f1117] ${editorBorder} transition duration-200`}
                  >
                    <div className="flex items-center justify-between px-4 pb-3 pt-4">
                      <div>
                        <p className="text-sm font-semibold text-zinc-200">Editor</p>
                        <p className={hintText}>Espaço inspirado no Notion e Obsidian.</p>
                      </div>
                      <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-200">
                        Focus
                      </span>
                    </div>
                    <LexicalEditor
                      value={content}
                      onChange={handleContentChange}
                      onFocusChange={setIsEditorFocused}
                    />
                  </div>
                </div>

                <div className="mt-4 rounded-2xl border border-white/5 bg-white/[0.02] p-4 shadow-inner shadow-black/30">
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-zinc-200">Preview</p>
                      <p className={hintText}>Renderização em tempo real em Markdown.</p>
                    </div>
                    <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-200">
                      Live
                    </span>
                  </div>
                  <div
                    className="min-h-[160px] space-y-3 rounded-xl border border-white/5 bg-black/20 px-4 py-3 text-sm leading-relaxed text-zinc-100"
                    dangerouslySetInnerHTML={{
                      __html:
                        previewHtml ||
                        "<p class='text-zinc-500'>Nada para pré-visualizar ainda.</p>",
                    }}
                  />
                </div>
              </div>
            </div>

            <aside className="space-y-4 lg:sticky lg:top-8">
              <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-5 shadow-lg shadow-black/30 backdrop-blur-md">
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
                    <Toggle checked={hidden} onChange={setHidden} ariaLabel="Ocultar post nas listagens públicas" />
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
                      onChange={setParagraphCommentsEnabled}
                      ariaLabel="Permitir comentários por parágrafo"
                    />
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-5 shadow-lg shadow-black/30 backdrop-blur-md">
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
                      onChange={(e) => setCape(e.target.value)}
                    />
                  </label>
                  <label className="flex flex-col gap-2">
                    <span className={labelStyle}>Foto do amigo</span>
                    <input
                      name="friendImage"
                      className={inputStyle}
                      type="text"
                      placeholder="URL da foto do amigo"
                      value={friendImage}
                      onChange={(e) => setFriendImage(e.target.value)}
                    />
                  </label>
                  <label className="flex flex-col gap-2">
                    <span className={labelStyle}>Tags</span>
                    <input
                      name="tags"
                      className={inputStyle}
                      type="text"
                      placeholder="separe por vírgulas"
                      value={tags}
                      onChange={(e) => setTags(e.target.value)}
                    />
                  </label>
                </div>
              </div>

              <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-5 shadow-lg shadow-black/30 backdrop-blur-md">
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
                      onChange={setHasAudio}
                      ariaLabel="Este post possui áudio"
                    />
                  </div>
                  {hasAudio && (
                    <input
                      name="audioUrl"
                      className={inputStyle}
                      type="text"
                      placeholder="URL do áudio"
                      value={audioUrl}
                      onChange={(e) => setAudioUrl(e.target.value)}
                    />
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-5 shadow-lg shadow-black/30 backdrop-blur-md">
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
                      onChange={(e) => setPostId(e.target.value)}
                      required
                    />
                  </label>

                  <button
                    type="submit"
                    className="group inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 via-emerald-400 to-teal-300 px-4 py-3 text-sm font-semibold text-zinc-950 shadow-lg shadow-emerald-500/20 transition duration-200 hover:from-emerald-400 hover:via-emerald-300 hover:to-emerald-200 disabled:cursor-not-allowed disabled:opacity-60"
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
            <div className="rounded-2xl border border-white/10 bg-emerald-500/5 p-4 text-center shadow-md shadow-black/30 backdrop-blur">
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
