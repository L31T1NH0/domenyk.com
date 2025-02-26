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
      className="mt-8 rounded-lg shadow-md"
      aria-label="Seção de comentários"
    >
      <h2 className="text-xl font-bold text-white mb-4">Comentários</h2>
      {error && <p className="text-red-500 mb-4">{error}</p>}
      <form onSubmit={handleCommentSubmit} className="flex flex-col  gap-4">
        <div className="flex gap-4">
          <input
            type="text"
            placeholder="Seu nome"
            value={newComment.nome}
            onChange={(e) =>
              setNewComment({ ...newComment, nome: e.target.value })
            }
            className="p-2 bg-zinc-700 text-white rounded"
          />

          <button
            type="submit"
            className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 transition-colors"
          >
            Enviar Comentário
          </button>
        </div>

        <textarea
          placeholder="Seu comentário"
          value={newComment.comentario}
          onChange={(e) =>
            setNewComment({ ...newComment, comentario: e.target.value })
          }
          className="p-2 bg-zinc-700 text-white rounded h-24"
        />
      </form>
      <div className="mt-6">
        {comments.map((comment) => (
          <div
            key={comment._id}
            className="bg-zinc-700 p-3 rounded-lg mb-4 flex gap-4 items-start"
          >
            <img
              src={generateIdenticon(comment.nome, comment.ip)}
              alt={`${comment.nome} avatar`}
              className="w-10 h-10 rounded-full bg-amber-500"
            />
            <div>
              <div className="flex gap-2">
                <p className="text-white font-semibold">{comment.nome}</p>
                <small className="bg-zinc-700 text-sm">
                  {formatDate(comment.createdAt)}
                </small>
              </div>

              <p className="bg-zinc-700 mt-1">{comment.comentario}</p>
            </div>
          </div>
        ))}
        {comments.length === 0 && (
          <p className="bg-zinc-700 rounded p-2 mb-4">
            Nenhum comentário ainda. Seja o primeiro!
          </p>
        )}
      </div>
    </section>
  );
};

export default Comment;
