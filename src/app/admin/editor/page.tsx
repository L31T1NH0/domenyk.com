"use client";

import { useState } from "react";
import { Layout } from "@components/layout";

export default function Editor() {
  const [title, setTitle] = useState("");
  const [postId, setPostId] = useState("");
  const [content, setContent] = useState("");
  const [hasAudio, setHasAudio] = useState(false);
  const [audioUrl, setAudioUrl] = useState("");
  const [tags, setTags] = useState(""); // Estado para as tags
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGeneratingTags, setIsGeneratingTags] = useState(false); // Estado para controle de geração de tags

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
      if (hasAudio && audioUrl) {
        formData.append("audioUrl", audioUrl);
      }
      // Adiciona as tags ao formData
      formData.append("tags", tags);

      const response = await fetch("/admin/api/editor", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create post");
      }

      const data = await response.json();
      setSuccess("Post criado com sucesso!");
      setTitle("");
      setPostId("");
      setContent("");
      setHasAudio(false);
      setAudioUrl("");
      setTags(""); // Reseta o campo de tags
    } catch (error) {
      setError("Falha ao criar o post: " + (error as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGenerateTags = async () => {
    if (!content.trim()) {
      setError("O conteúdo do post é necessário para gerar tags.");
      return;
    }

    try {
      setIsGeneratingTags(true);
      setError(null);

      const response = await fetch("/admin/api/ai-tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to generate tags");
      }

      const data = await response.json();
      const generatedTags = data.tags.join(", "); // Converte o array de tags em uma string separada por vírgulas
      setTags(generatedTags);
    } catch (error) {
      setError("Falha ao gerar tags: " + (error as Error).message);
    } finally {
      setIsGeneratingTags(false);
    }
  };

  return (
    <div className="flex container mx-auto p-2 mt-4 mb-8 rounded-xl bg-zinc-800">
      <div className="w-full">
        <div className="gap-4">
          <div className="mb-4">
            <div className="gap-4 flex">
              <h1 className="text-2xl font-bold hover">Editor</h1>
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="flex gap-2 mb-4">
              <input
                name="title"
                className="flex p-2 rounded outline-none bg-zinc-700"
                type="text"
                placeholder="titulo"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
              <input
                name="postId"
                className="flex w-full p-2 rounded outline-none bg-zinc-700"
                type="text"
                placeholder="post Id"
                value={postId}
                onChange={(e) => setPostId(e.target.value)}
              />
            </div>

            {/* Checkbox para confirmar se o post terá áudio */}
            <div className="mb-4 flex items-center gap-2">
              <input
                type="checkbox"
                id="hasAudio"
                checked={hasAudio}
                onChange={(e) => setHasAudio(e.target.checked)}
                className="h-5 w-5 text-green-600 bg-zinc-700 rounded"
              />
              <label htmlFor="hasAudio" className="text-zinc-300">
                Este post tem áudio?
              </label>
            </div>

            {/* Campo condicional para o URL do áudio */}
            {hasAudio && (
              <div className="mb-4">
                <input
                  name="audioUrl"
                  className="w-full p-2 rounded outline-none bg-zinc-700 text-zinc-300"
                  type="text"
                  placeholder="Insira o URL do áudio (Cloudinary)"
                  value={audioUrl}
                  onChange={(e) => setAudioUrl(e.target.value)}
                />
              </div>
            )}

            <div>
              <div>
                <textarea
                  name="content"
                  className="w-full h-140 resize-none p-2 rounded outline-none bg-zinc-700"
                  placeholder="Content"
                  spellCheck="false"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                />
              </div>
            </div>

            {/* Campo de tags e botão para gerar tags */}
            <div className="flex gap-2 mb-4">
              <input
                name="tags"
                className="flex w-full p-2 rounded outline-none bg-zinc-700 text-zinc-300"
                type="text"
                placeholder="Tags (separadas por vírgula)"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
              />
              <button
                type="button"
                onClick={handleGenerateTags}
                className={`w-10 h-10 rounded bg-purple-600 hover:bg-purple-700 text-zinc-300 flex items-center justify-center ${
                  isGeneratingTags || !content.trim()
                    ? "opacity-50 cursor-not-allowed"
                    : ""
                }`}
                disabled={isGeneratingTags || !content.trim()}
                title="Gerar tags com IA"
              >
                {isGeneratingTags ? (
                  <span className="animate-spin">⏳</span>
                ) : (
                  <span>IA</span>
                )}
              </button>
            </div>

            <div className="flex justify-end mt-2 gap-4">
              <button
                type="submit"
                className={`p-2 bg-green-600 hover:bg-green-700 text-zinc-300 rounded ${
                  isSubmitting ? "opacity-50 cursor-not-allowed" : ""
                }`}
                disabled={isSubmitting}
              >
                <h1>{isSubmitting ? "Postando..." : "Postar"}</h1>
              </button>
            </div>
          </form>

          {/* Exibe mensagens de sucesso ou erro */}
          {success && <p className="text-green-500 mt-2">{success}</p>}
          {error && <p className="text-red-500 mt-2">{error}</p>}
        </div>
      </div>
    </div>
  );
}