"use client"; // Marca o componente como Client Component

import React, { useState, useRef, FormEvent } from "react";
import axios from "axios";
import { minidenticon } from "minidenticons"; // Biblioteca para gerar identicons

type Comment = {
  _id: string;
  postId: string;
  nome: string;
  comentario: string;
  ip: string;
  createdAt: string;
  parentId: string | null;
  replies?: Comment[];
};

interface CommentItemProps {
  comment: Comment;
  postId: string;
  isClient: boolean;
  renderComments: (
    comments: Comment[],
    parentId?: string | null
  ) => React.ReactNode;
}

const CommentItem: React.FC<CommentItemProps> = ({
  comment,
  postId,
  isClient,
  renderComments,
}) => {
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyInput, setReplyInput] = useState<{
    nome: string;
    comentario: string;
  }>({
    nome: "",
    comentario: "",
  });
  const replyInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  const hasUserCommented =
    isClient &&
    comment.replies?.some(
      (reply) =>
        reply.ip === localStorage.getItem(`user_${postId}`)?.split(",")[1] &&
        reply.nome === localStorage.getItem(`user_${postId}`)?.split(",")[0]
    );
  const hasNameInLocalStorage =
    isClient && !!localStorage.getItem(`user_${postId}`);

  const showReplyAlert =
    replyTo === comment._id && !hasUserCommented && !hasNameInLocalStorage;

  const handleReply = () => {
    setReplyTo(comment._id);
    if (isClient) {
      const storedUser = localStorage.getItem(`user_${postId}`);
      if (storedUser) {
        const [nome, ip] = storedUser.split(",");
        setReplyInput({ nome: nome || "", comentario: "" });
      } else {
        setReplyInput({ nome: "", comentario: "" });
      }
    }
    if (replyInputRef.current) {
      replyInputRef.current.focus();
    }
  };

  const handleReplySubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!replyInput.comentario.trim()) return;
    if (replyInput.comentario.length > 100) {
      setError("Reply must not exceed 100 characters");
      return;
    }

    try {
      const response = await axios.post(`/api/comments/${postId}`, {
        nome:
          replyInput.nome ||
          (isClient
            ? localStorage.getItem(`user_${postId}`)?.split(",")[0] || ""
            : ""),
        comentario: replyInput.comentario,
        parentId: comment._id,
      });

      if (isClient) {
        const currentIp =
          localStorage.getItem(`user_${postId}`)?.split(",")[1] || "Unknown";
        localStorage.setItem(
          `user_${postId}`,
          `${
            replyInput.nome ||
            localStorage.getItem(`user_${postId}`)?.split(",")[0] ||
            ""
          },${currentIp}`
        );
      }

      setReplyTo(null);
      setReplyInput({ nome: "", comentario: "" });
      setError(null);
    } catch (err) {
      console.error("Error adding reply:", (err as Error).message);
      setError("Failed to add reply: " + (err as Error).message);
    }

    if (replyInputRef.current) {
      replyInputRef.current.blur();
    }
  };

  const discardReply = () => {
    setReplyTo(null);
    setReplyInput({ nome: "", comentario: "" });
  };

  // Função para gerar identicon com Minidenticons
  const generateIdenticon = (name: string, ip: string): string => {
    const value = `${name}${ip || "Unknown"}`; // Combina nome e IP para hash único
    const svg = minidenticon(value, 100, 50); // Saturação 95%, luminosidade 45% (padrão)
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

  const replyCount = comment.replies?.length || 0;
  const visibleReplies = comment.replies ? comment.replies.slice(0, 2) : []; // Mostra apenas os 2 primeiros replies por padrão

  return (
    <div
      key={comment._id}
      className="bg-zinc-700 p-3 rounded-lg mb-4 max-sm:p-2 max-sm:mb-2 max-sm:rounded-md flex flex-col gap-2 max-sm:gap-1 items-start"
    >
      <div className="flex gap-4 max-sm:gap-2 items-start">
        <img
          src={generateIdenticon(comment.nome, comment.ip)}
          alt={`${comment.nome} avatar`}
          className="w-8 h-8 rounded-full max-sm:w-6 max-sm:h-6 icon"
        />
        <div className="flex-1">
          <div className="flex gap-2 max-sm:gap-1">
            <p className="text-white font-semibold max-sm:text-sm">
              {comment.nome}
            </p>
            <small className="text-gray-400 text-sm max-sm:text-xs">
              {formatDate(comment.createdAt)}
            </small>
          </div>
          <p className="text-gray-300 max-sm:text-sm">{comment.comentario}</p>
          {comment.parentId === null && comment._id !== replyTo && (
            <button
              onClick={handleReply}
              className="text-purple-400 hover:text-purple-300 text-sm mt-1 max-sm:text-xs"
            >
              Responder
            </button>
          )}
          {showReplyAlert && (
            <p className="text-gray-500 text-sm mt-1 max-sm:text-xs">
              Faça um comentário primeiro ou ponha seu nome no campo "nome"
            </p>
          )}
        </div>
      </div>
      {replyTo === comment._id && (
        <form onSubmit={handleReplySubmit} className="mt-1">
          <div className="flex items-center gap-2 max-sm:gap-1">
            <input
              type="text"
              maxLength={100}
              placeholder="Sua resposta..."
              value={replyInput.comentario}
              onChange={(e) =>
                setReplyInput({ ...replyInput, comentario: e.target.value })
              }
              ref={replyInputRef} // Adiciona referência para manter o foco
              className="ml-14 p-1 bg-zinc-700 text-white rounded border outline-none border-gray-600 w-full max-sm:p-0.5 max-sm:text-sm"
            />
            <button
              type="submit"
              className="bg-purple-600 text-white px-2 py-1 rounded hover:bg-purple-700 transition-colors max-sm:px-1 max-sm:py-0.5 max-sm:text-xs"
            >
              Enviar
            </button>
            <button
              type="button"
              onClick={discardReply}
              className="bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700 transition-colors max-sm:px-2 max-sm:py-0.5 max-sm:text-xs"
            >
              X
            </button>
          </div>
        </form>
      )}
      {visibleReplies.length > 0 && (
        <div className="ml-4 max-sm:ml-2 border-l-2 border-gray-600 pl-2 mt-2">
          {renderComments(visibleReplies, comment._id)}
        </div>
      )}
      {replyCount > 2 && (
        <p className="text-gray-400 text-sm mt-1 max-sm:text-xs">
          +{replyCount - 2} mais respostas
        </p>
      )}
      {error && (
        <p className="text-red-500 text-sm mt-1 max-sm:text-xs">{error}</p>
      )}
    </div>
  );
};

export default CommentItem;
