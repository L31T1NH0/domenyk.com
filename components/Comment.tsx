import React, { useState, useEffect } from "react";
import axios from "axios";
import { minidenticon } from "minidenticons"; // Biblioteca para gerar identicons

type Comment = {
  _id: string;
  postId: string;
  nome: string;
  comentario: string;
  ip: string;
  createdAt: string;
};

interface CommentProps {
  postId: string;
}

const Comment: React.FC<CommentProps> = ({ postId }) => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState({
    nome: "",
    comentario: "",
    ip: "Unknown",
  });
  const [error, setError] = useState<string | null>(null);

  // Busca comentários ao montar o componente
  useEffect(() => {
    fetchComments();
  }, [postId]);

  const fetchComments = async () => {
    try {
      const response = await axios.get(`/api/comments/${postId}`);
      setComments(response.data);
    } catch (err) {
      console.error("Error fetching comments:", err);
      setError("Failed to load comments");
    }
  };

  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.nome || !newComment.comentario) {
      setError("Name and comment are required");
      return;
    }

    try {
      // Simula o IP localmente (no frontend, o backend já obtém via API ipify, mas aqui simulamos para testes)
      const ipResponse = await axios.get("https://api.ipify.org?format=json");
      const ip = ipResponse.data.ip || "Unknown";

      const response = await axios.post(`/api/comments/${postId}`, {
        nome: newComment.nome,
        comentario: newComment.comentario,
      });

      setComments([response.data.comment, ...comments]);
      setNewComment({ nome: "", comentario: "", ip: "Unknown" });
      setError(null);
    } catch (err) {
      console.error("Error adding comment:", err);
      setError("Failed to add comment");
    }
  };

  // Função para gerar identicon com Minidenticons
  const generateIdenticon = (name: string, ip: string): string => {
    const value = `${name}${ip || "Unknown"}`; // Combina nome e IP para hash único
    const svg = minidenticon(value, 95, 45); // Saturação 95%, luminosidade 45% (padrão)
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`; // Base64 para <img>
  };

  // Função para formatar a data (YYYY-MM-DD para "DD de MMMM de YYYY")
  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("pt-BR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  return (
    <section
      className="mt-2 max-sm:mt-1" // Reduz margem em telas menores
      aria-label="Seção de comentários"
    >
      <h1 className="text-xl font-bold mb-4 max-sm:text-lg max-sm:mb-2">
        💬 Comentários
      </h1>
      {error && (
        <p className="text-red-500 mb-4 max-sm:mb-2 max-sm:text-sm">{error}</p>
      )}
      <form
        onSubmit={handleCommentSubmit}
        className="flex flex-col gap-4 max-sm:gap-2"
      >
        <div className="flex gap-4 max-sm:flex-col max-sm:gap-2">
          <input
            type="text"
            placeholder="Seu nome"
            value={newComment.nome}
            onChange={(e) =>
              setNewComment({ ...newComment, nome: e.target.value })
            }
            className="p-2 bg-zinc-700 text-white rounded w-full max-sm:p-1 max-sm:text-sm"
          />
          <button
            type="submit"
            className="w-full h-fit bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 transition-colors max-sm:px-3 max-sm:py-1 max-sm:text-sm"
          >
            Enviar Comentário
          </button>
        </div>
        <textarea
          maxLength={500}
          placeholder="Seu comentário"
          value={newComment.comentario}
          onChange={(e) =>
            setNewComment({ ...newComment, comentario: e.target.value })
          }
          className="p-2 bg-zinc-700 text-white rounded resize-none w-full h-56 max-sm:h-32 max-sm:p-1 max-sm:text-sm"
        />
      </form>
      <div className="mt-6 max-sm:mt-3">
        {comments.map((comment) => (
          <div
            key={comment._id}
            className="bg-zinc-700 p-3 rounded-lg mb-4 max-sm:p-2 max-sm:mb-2 max-sm:rounded-md flex gap-4 max-sm:gap-2 items-start"
          >
            <img
              src={generateIdenticon(comment.nome, comment.ip)}
              alt={`${comment.nome} avatar`}
              className="w-8 h-8 rounded-full max-sm:w-6 max-sm:h-6 icon"
            />
            <div>
              <div className="flex gap-2 max-sm:gap-1">
                <p className="text-white font-semibold max-sm:text-sm">
                  {comment.nome}
                </p>
                <small className="text-gray-400 text-sm max-sm:text-xs">
                  {formatDate(comment.createdAt)}
                </small>
              </div>
              <p className="text-gray-300 max-sm:text-sm">
                {comment.comentario}
              </p>
            </div>
          </div>
        ))}
        {comments.length === 0 && (
          <p className="bg-zinc-700 rounded p-2 mb-4 max-sm:p-1 max-sm:mb-2 max-sm:text-sm">
            Nenhum comentário ainda. Seja o primeiro!
          </p>
        )}
      </div>
    </section>
  );
};

export default Comment;
