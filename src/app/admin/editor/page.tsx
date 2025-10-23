"use client";

import { useState } from "react";

export default function Editor() {
  const [title, setTitle] = useState("");
  const [postId, setPostId] = useState("");
  const [cape, setCape] = useState("");
  const [friendImage, setFriendImage] = useState("");
  const [tags, setTags] = useState("");
  const [hasAudio, setHasAudio] = useState(false);
  const [audioUrl, setAudioUrl] = useState("");
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (isSubmitting) return;

    try {
      setIsSubmitting(true);
      setError(null);
      setSuccess(null);

      const formData = new FormData();
      formData.append("title", title);
      formData.append("postId", postId);
      formData.append("content", content);
      formData.append("tags", tags);
      formData.append("cape", cape);
      formData.append("friendImage", friendImage);
      if (hasAudio && audioUrl) {
        formData.append("audioUrl", audioUrl);
      }

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
      setPostId("");
      setCape("");
      setFriendImage("");
      setTags("");
      setHasAudio(false);
      setAudioUrl("");
      setContent("");
    } catch (error) {
      setError("Falha ao criar o post: " + (error as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 py-12">
      <div className="mx-auto max-w-3xl px-6">
        <header className="mb-8 text-center">
          <h1 className="text-3xl font-semibold tracking-tight">Novo post</h1>
          <p className="mt-2 text-sm text-zinc-400">
            Preencha os campos abaixo para publicar um novo conteúdo.
          </p>
        </header>

        <form
          onSubmit={handleSubmit}
          className="space-y-6 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-8 shadow-2xl shadow-black/20"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-zinc-300">Título</span>
              <input
                name="title"
                className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-500/40"
                type="text"
                placeholder="Digite o título do post"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-zinc-300">Post ID</span>
              <input
                name="postId"
                className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-500/40"
                type="text"
                placeholder="Identificador único"
                value={postId}
                onChange={(e) => setPostId(e.target.value)}
                required
              />
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-zinc-300">Capa</span>
              <input
                name="cape"
                className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-500/40"
                type="text"
                placeholder="URL da imagem de capa"
                value={cape}
                onChange={(e) => setCape(e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-zinc-300">Foto do amigo</span>
              <input
                name="friendImage"
                className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-500/40"
                type="text"
                placeholder="URL da foto do amigo"
                value={friendImage}
                onChange={(e) => setFriendImage(e.target.value)}
              />
            </label>
          </div>

          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-zinc-300">Tags</span>
            <input
              name="tags"
              className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-500/40"
              type="text"
              placeholder="separe por vírgulas"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
            />
          </label>

          <div className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-3">
            <label htmlFor="hasAudio" className="flex items-center gap-3 text-sm">
              <input
                type="checkbox"
                id="hasAudio"
                checked={hasAudio}
                onChange={(e) => setHasAudio(e.target.checked)}
                className="h-4 w-4 rounded border-zinc-700 bg-zinc-900 text-zinc-100 focus:ring-zinc-500"
              />
              Este post possui áudio
            </label>
            {hasAudio && (
              <input
                name="audioUrl"
                className="w-full max-w-xs rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-500/40"
                type="text"
                placeholder="URL do áudio"
                value={audioUrl}
                onChange={(e) => setAudioUrl(e.target.value)}
              />
            )}
          </div>

          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-zinc-300">Conteúdo</span>
            <textarea
              name="content"
              className="min-h-[260px] rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-3 text-sm leading-relaxed text-zinc-100 placeholder:text-zinc-500 focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-500/40"
              placeholder="Insira o conteúdo em HTML"
              spellCheck="false"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              required
            />
          </label>

          <button
            type="submit"
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-zinc-100 px-4 py-3 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Publicando..." : "Publicar post"}
          </button>

          {success && (
            <p className="text-center text-sm font-medium text-green-400">
              {success}
            </p>
          )}
          {error && (
            <p className="text-center text-sm font-medium text-red-400">{error}</p>
          )}
        </form>
      </div>
    </div>
  );
}