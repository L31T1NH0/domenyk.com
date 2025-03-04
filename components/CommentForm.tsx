"use client"; // Marca o componente como Client Component

import React, { useState, useRef, FormEvent } from "react";
import axios from "axios";

type CommentData = {
  nome: string;
  comentario: string;
  ip: string;
  parentId: string | null;
};

interface CommentFormProps {
  postId: string;
  isClient: boolean;
}

const CommentForm: React.FC<CommentFormProps> = ({ postId, isClient }) => {
  const [newComment, setNewComment] = useState<CommentData>({
    nome: "",
    comentario: "",
    ip: "",
    parentId: null,
  });
  const [error, setError] = useState<string | null>(null);
  const replyInputRef = useRef<HTMLInputElement>(null);

  const handleCommentSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!newComment.nome || !newComment.comentario) {
      setError("Name and comment are required");
      return;
    }
    if (newComment.comentario.length > 100) {
      setError("Comment must not exceed 100 characters");
      return;
    }

    try {
      let ip = newComment.ip;
      if (!ip && isClient) {
        const ipResponse = await axios.get("https://api.ipify.org?format=json");
        ip = ipResponse.data.ip || "Unknown";
      }

      const response = await axios.post(`/api/comments/${postId}`, {
        nome: newComment.nome,
        comentario: newComment.comentario,
        parentId: newComment.parentId,
      });

      if (isClient) {
        localStorage.setItem(
          `user_${postId}`,
          JSON.stringify({ nome: newComment.nome, ip })
        );
      }

      setNewComment({
        nome: newComment.nome,
        comentario: "",
        ip: ip,
        parentId: null,
      });
      setError(null);
    } catch (err) {
      console.error("Error adding comment:", (err as Error).message);
      setError("Failed to add comment: " + (err as Error).message);
    }
  };

  return (
    <form
      onSubmit={handleCommentSubmit}
      className="flex flex-col gap-4 max-sm:gap-2"
    >
      <div className="flex gap-4 max-sm:flex-col max-sm:gap-2">
        <input
          type="text"
          placeholder="Seu nome (último usado será salvo)"
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
        maxLength={100}
        placeholder="Seu comentário"
        value={newComment.comentario}
        onChange={(e) =>
          setNewComment({ ...newComment, comentario: e.target.value })
        }
        className="p-2 bg-zinc-700 text-white rounded resize-none w-full h-56 max-sm:h-32 max-sm:p-1 max-sm:text-sm"
      />
      {error && <p className="text-red-500 max-sm:text-sm">{error}</p>}
    </form>
  );
};

export default CommentForm;
