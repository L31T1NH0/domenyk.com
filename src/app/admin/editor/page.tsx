"use client";

import { useState } from "react";

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
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEditorFocused, setIsEditorFocused] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
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

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-950 via-zinc-950 to-neutral-900 py-12 text-zinc-100">
      <div className="mx-auto max-w-6xl px-6">
        <header className="mb-10 text-center">
          <p className="text-sm uppercase tracking-[0.2em] text-zinc-500">
            Painel Editorial
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-zinc-50 sm:text-5xl">
            Novo post
          </h1>
          <p className="mt-3 text-base text-zinc-400">
            Preencha os campos principais e organize os detalhes na barra lateral.
          </p>
        </header>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-[1.6fr,1fr]">
            <div className="space-y-4">
              <div className="rounded-2xl border border-zinc-800/70 bg-zinc-900/70 shadow-lg shadow-black/30 backdrop-blur">
                <div className="border-b border-zinc-800/70 px-6 pb-5 pt-6">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                    Conteúdo principal
                  </p>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <label className="flex flex-col gap-2">
                      <span className="text-sm font-medium text-zinc-300">Título</span>
                      <input
                        name="title"
                        className="rounded-lg border border-zinc-800 bg-zinc-950/80 px-4 py-2.5 text-sm text-zinc-50 placeholder:text-zinc-600 transition focus:border-emerald-500/70 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                        type="text"
                        placeholder="Digite o título do post"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        required
                      />
                    </label>
                    <label className="flex flex-col gap-2">
                      <span className="text-sm font-medium text-zinc-300">Subtítulo</span>
                      <input
                        name="subtitle"
                        className="rounded-lg border border-zinc-800 bg-zinc-950/80 px-4 py-2.5 text-sm text-zinc-50 placeholder:text-zinc-600 transition focus:border-emerald-500/70 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                        type="text"
                        placeholder="Resumo curto do post"
                        value={subtitle}
                        onChange={(e) => setSubtitle(e.target.value)}
                      />
                    </label>
                  </div>
                </div>

                <div className="px-6 pb-8 pt-5">
                  <div className="flex items-baseline justify-between gap-4">
                    <div>
                      <p className="text-lg font-semibold text-zinc-100">Editor</p>
                      <p className="text-sm text-zinc-500">
                        Bloco com estilo obsidiano para manter o foco na escrita.
                      </p>
                    </div>
                    <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-200">
                      Canvas
                    </span>
                  </div>

                  <div className="mt-5 rounded-xl border border-zinc-800/80 bg-gradient-to-b from-zinc-950 via-zinc-950 to-zinc-900 shadow-[0_20px_60px_-35px_rgba(0,0,0,0.8)]">
                    <label className="block px-4 pb-2 pt-4 text-sm font-medium text-zinc-300">
                      Conteúdo
                    </label>
                    <div className="relative overflow-hidden rounded-b-xl border-t border-zinc-800/80 bg-zinc-950/80">
                      {!content && !isEditorFocused && (
                        <span className="pointer-events-none absolute left-5 top-4 text-sm text-zinc-600">
                          Insira o conteúdo do post...
                        </span>
                      )}
                      <div
                        name="content"
                        className="min-h-[420px] w-full bg-transparent px-5 pb-6 pt-4 text-base leading-relaxed text-zinc-100 caret-emerald-400 focus:outline-none font-[\"IAWriterQuattroV-Italic\",serif]"
                        contentEditable
                        suppressContentEditableWarning
                        spellCheck={false}
                        onFocus={() => setIsEditorFocused(true)}
                        onBlur={() => setIsEditorFocused(false)}
                        onInput={(e) => setContent((e.target as HTMLDivElement).innerHTML)}
                        dangerouslySetInnerHTML={{ __html: content }}
                        aria-label="Área principal de conteúdo"
                      />
                      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-black/40 to-transparent" />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <aside className="space-y-4 lg:sticky lg:top-8">
              <div className="rounded-2xl border border-zinc-800/70 bg-zinc-900/70 p-5 shadow-md shadow-black/30">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-zinc-200">Visibilidade</p>
                  <span className="text-xs uppercase tracking-[0.18em] text-zinc-500">Meta</span>
                </div>
                <div className="mt-4 space-y-3 divide-y divide-zinc-800/70">
                  <label className="flex items-start gap-3 pt-1 text-sm text-zinc-200">
                    <input
                      type="checkbox"
                      id="hidden"
                      checked={hidden}
                      onChange={(e) => setHidden(e.target.checked)}
                      className="mt-1 h-4 w-4 rounded border-zinc-700 bg-zinc-950 text-emerald-400 focus:ring-emerald-500"
                    />
                    <span className="leading-5">Ocultar post nas listagens públicas</span>
                  </label>
                  <label
                    htmlFor="paragraph-comments"
                    className="flex items-start gap-3 pt-3 text-sm text-zinc-200"
                  >
                    <input
                      type="checkbox"
                      id="paragraph-comments"
                      checked={paragraphCommentsEnabled}
                      onChange={(e) => setParagraphCommentsEnabled(e.target.checked)}
                      className="mt-1 h-4 w-4 rounded border-zinc-700 bg-zinc-950 text-emerald-400 focus:ring-emerald-500"
                    />
                    <span className="leading-5">Permitir comentários por parágrafo</span>
                  </label>
                </div>
              </div>

              <div className="rounded-2xl border border-zinc-800/70 bg-zinc-900/70 p-5 shadow-md shadow-black/30">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-zinc-200">Midia & tags</p>
                  <span className="text-xs uppercase tracking-[0.18em] text-zinc-500">Detalhes</span>
                </div>
                <div className="mt-4 space-y-4">
                  <label className="flex flex-col gap-2">
                    <span className="text-xs uppercase tracking-wide text-zinc-500">Capa</span>
                    <input
                      name="cape"
                      className="rounded-lg border border-zinc-800 bg-zinc-950/80 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500/70 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                      type="text"
                      placeholder="URL da imagem de capa"
                      value={cape}
                      onChange={(e) => setCape(e.target.value)}
                    />
                  </label>
                  <label className="flex flex-col gap-2">
                    <span className="text-xs uppercase tracking-wide text-zinc-500">Foto do amigo</span>
                    <input
                      name="friendImage"
                      className="rounded-lg border border-zinc-800 bg-zinc-950/80 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500/70 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                      type="text"
                      placeholder="URL da foto do amigo"
                      value={friendImage}
                      onChange={(e) => setFriendImage(e.target.value)}
                    />
                  </label>
                  <label className="flex flex-col gap-2">
                    <span className="text-xs uppercase tracking-wide text-zinc-500">Tags</span>
                    <input
                      name="tags"
                      className="rounded-lg border border-zinc-800 bg-zinc-950/80 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500/70 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                      type="text"
                      placeholder="separe por vírgulas"
                      value={tags}
                      onChange={(e) => setTags(e.target.value)}
                    />
                  </label>
                </div>
              </div>

              <div className="rounded-2xl border border-zinc-800/70 bg-zinc-900/70 p-5 shadow-md shadow-black/30">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-zinc-200">Áudio</p>
                  <span className="text-xs uppercase tracking-[0.18em] text-zinc-500">Opcional</span>
                </div>
                <div className="mt-4 space-y-3">
                  <label className="flex items-center justify-between gap-3 text-sm text-zinc-200">
                    <span>Este post possui áudio?</span>
                    <input
                      type="checkbox"
                      id="hasAudio"
                      checked={hasAudio}
                      onChange={(e) => setHasAudio(e.target.checked)}
                      className="h-4 w-4 rounded border-zinc-700 bg-zinc-950 text-emerald-400 focus:ring-emerald-500"
                    />
                  </label>
                  {hasAudio && (
                    <input
                      name="audioUrl"
                      className="w-full rounded-lg border border-zinc-800 bg-zinc-950/80 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500/70 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                      type="text"
                      placeholder="URL do Áudio"
                      value={audioUrl}
                      onChange={(e) => setAudioUrl(e.target.value)}
                    />
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-zinc-800/70 bg-zinc-900/70 p-5 shadow-md shadow-black/30">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-zinc-200">Publicação</p>
                  <span className="text-xs uppercase tracking-[0.18em] text-zinc-500">Controle</span>
                </div>
                <div className="mt-4 space-y-4">
                  <label className="flex flex-col gap-2">
                    <span className="text-xs uppercase tracking-wide text-zinc-500">Post ID</span>
                    <input
                      name="postId"
                      className="rounded-lg border border-zinc-800 bg-zinc-950/80 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500/70 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                      type="text"
                      placeholder="Identificador único do post"
                      value={postId}
                      onChange={(e) => setPostId(e.target.value)}
                      required
                    />
                  </label>

                  <button
                    type="submit"
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-400 px-4 py-3 text-sm font-semibold text-zinc-950 shadow-lg shadow-emerald-500/20 transition hover:from-emerald-400 hover:to-emerald-300 disabled:cursor-not-allowed disabled:opacity-70"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? "Publicando..." : "Publicar post"}
                  </button>
                </div>
              </div>
            </aside>
          </div>

          {(success || error) && (
            <div className="rounded-2xl border border-zinc-800/70 bg-zinc-900/70 p-4 text-center shadow-md shadow-black/30">
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
