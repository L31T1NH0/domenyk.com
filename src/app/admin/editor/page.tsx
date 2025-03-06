"use client";

import { useState } from "react";
import { Layout } from "@components/layout";

export default function Editor() {
  const [title, setTitle] = useState("");
  const [postId, setPostId] = useState("");
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false); // Estado para controlar o envio

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // Impede múltiplos envios enquanto a requisição está em andamento
    if (isSubmitting) return;

    try {
      setIsSubmitting(true); // Desativa o botão
      setError(null);
      setSuccess(null);

      const formData = new FormData();
      formData.append("title", title);
      formData.append("postId", postId);
      formData.append("content", content);

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
    } catch (error) {
      setError("Falha ao criar o post: " + (error as Error).message);
    } finally {
      setIsSubmitting(false); // Reativa o botão após a requisição
    }
  };

  return (
    <Layout>
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

              <div>
                <div>
                  <textarea
                    name="content"
                    className="w-full h-70 resize-none p-2 rounded outline-none bg-zinc-700"
                    placeholder="Content"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex justify-end mt-2 gap-4">
                <button
                  type="submit"
                  className={`p-2 bg-green-600 hover:bg-green-700 text-zinc-300 rounded ${
                    isSubmitting ? "opacity-50 cursor-not-allowed" : ""
                  }`}
                  disabled={isSubmitting} // Desativa o botão durante o envio
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
    </Layout>
  );
}
