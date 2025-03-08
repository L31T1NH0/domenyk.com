"use client"; // Marca o componente como Client Component

import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "@clerk/nextjs"; // Para verificar autenticação
import { minidenticon } from "minidenticons"; // Biblioteca para gerar identicons
import {
  CheckBadgeIcon,
  ChatBubbleLeftRightIcon,
  TrashIcon,
} from "@heroicons/react/24/solid";

type Comment = {
  _id: string; // O MongoDB retorna ObjectId, mas o frontend usa toString()
  postId: string;
  nome?: string; // Opcional para usuários não logados
  comentario: string;
  ip: string;
  createdAt: string;
  parentId: string | null;
  replies?: Comment[];
};

type AuthComment = {
  _id: string; // O MongoDB retorna ObjectId, mas o frontend usa toString()
  postId: string;
  firstName: string | null;
  role: "admin" | null;
  userId: string;
  imageURL: string;
  hasImage: boolean;
  comentario: string;
  ip: string;
  createdAt: string;
  parentId: string | null;
  replies?: (Comment | AuthComment)[];
};

interface CommentProps {
  postId: string;
}

const Comment: React.FC<CommentProps> = ({ postId }) => {
  const { userId, isLoaded } = useAuth(); // Apenas userId e isLoaded
  const [comments, setComments] = useState<(Comment | AuthComment)[]>([]);
  const [newComment, setNewComment] = useState({
    nome: "",
    comentario: "",
    ip: "",
    parentId: null as string | null,
  });
  const [error, setError] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyInput, setReplyInput] = useState<{
    [key: string]: { nome: string; comentario: string };
  }>({});
  const [isClient, setIsClient] = useState(false);
  const [showAllReplies, setShowAllReplies] = useState<{
    [key: string]: boolean;
  }>({});
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null); // Para o modal de confirmação
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null); // Estado para verificar administrador
  const replyInputRef = useRef<HTMLInputElement>(null);

  // Carrega nome e IP do localStorage apenas para usuários não logados
  useEffect(() => {
    setIsClient(true);
    if (!userId && isLoaded) {
      const storedUser = localStorage.getItem(`user_${postId}`);
      if (storedUser) {
        const { nome, ip } = JSON.parse(storedUser);
        setNewComment((prev) => ({ ...prev, nome: nome || "", ip: ip || "" }));
      }
    }
  }, [postId, userId, isLoaded]);

  // Verifica o status de administrador
  useEffect(() => {
    const checkAdminStatus = async () => {
      try {
        const response = await fetch("/admin/api/check", {
          method: "GET",
          headers: { "Content-Type": "application/json" },
        });
        if (!response.ok) {
          throw new Error("Failed to check admin status");
        }
        const data = await response.json();
        setIsAdmin(data.isAdmin);
        console.log("Admin status from API:", data.isAdmin); // Log para depuração
      } catch (error) {
        console.error("Error checking admin status:", error);
        setIsAdmin(false);
      }
    };

    if (isLoaded) {
      checkAdminStatus();
    }
  }, [isLoaded]);

  // Busca comentários ao montar o componente
  useEffect(() => {
    fetchComments();
  }, [postId]);

  const fetchComments = async () => {
    try {
      console.log("Fetching comments for postId:", postId); // Log para depuração
      const response = await fetch(`/api/comments/${postId}`);
      if (!response.ok) {
        const errorText = await response.text();
        console.warn(
          `Erro ao buscar comentários: ${response.status} - ${errorText}`
        );
        setComments([]);
        setError(
          `Não foi possível carregar os comentários: ${response.status} - ${errorText}`
        );
      } else {
        const commentsData = await response.json();
        console.log("Comments received from API:", commentsData);
        setComments(commentsData || []);
      }
    } catch (error) {
      console.error("Error fetching comments:", error);
      setError(`Falha ao carregar os comentários: ${(error as Error).message}`);
      setComments([]);
    }
  };

  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (userId && isLoaded) {
      if (!newComment.comentario.trim()) {
        setError("Comment is required");
        return;
      }
      if (newComment.comentario.length > 120) {
        setError("Comment must not exceed 120 characters");
        return;
      }
    } else {
      if (!newComment.nome || !newComment.comentario.trim()) {
        setError("Name and comment are required");
        return;
      }
      if (newComment.comentario.length > 120) {
        setError("Comment must not exceed 120 characters");
        return;
      }
    }

    try {
      let ip = newComment.ip;
      if (!ip && isClient) {
        const ipResponse = await fetch("https://api.ipify.org?format=json", {
          method: "GET",
        });
        const ipData = await ipResponse.json();
        ip = ipData.ip || "Unknown";
      }

      const data = {
        comentario: newComment.comentario,
        parentId: newComment.parentId || null,
        nome: userId ? undefined : newComment.nome,
      };

      const response = await fetch(`/api/comments/${postId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to add comment: ${errorText}`);
      }

      const responseData = await response.json();
      const newCommentData = userId
        ? responseData.comment
        : { ...responseData.comment, nome: newComment.nome, ip };

      if (isClient && !userId) {
        localStorage.setItem(
          `user_${postId}`,
          JSON.stringify({ nome: newComment.nome, ip })
        );
      }

      setComments((prev) => [
        newCommentData,
        ...prev.filter((c) => c._id !== newCommentData._id),
      ]);
      setNewComment({
        nome: newComment.nome,
        comentario: "",
        ip: ip || "",
        parentId: null,
      });
      setReplyTo(null);
      setReplyInput({});
      setError(null);
    } catch (error) {
      console.error("Error adding comment:", error);
      setError(`Failed to add comment: ${(error as Error).message}`);
    }
  };

  const handleReply = (commentId: string) => {
    setReplyTo(commentId);
    if (!userId && isClient) {
      const storedUser = localStorage.getItem(`user_${postId}`);
      if (storedUser) {
        const { nome, ip } = JSON.parse(storedUser);
        setReplyInput((prev) => ({
          ...prev,
          [commentId]: { nome: nome || "", comentario: "" },
        }));
      } else {
        setReplyInput((prev) => ({
          ...prev,
          [commentId]: { nome: "", comentario: "" },
        }));
      }
    }
    if (replyInputRef.current) {
      replyInputRef.current.focus();
    }
  };

  const handleReplySubmit = async (
    commentId: string,
    e: React.FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault();
    const replyData = replyInput[commentId] || { nome: "", comentario: "" };
    const replyText = replyData.comentario || "";
    if (!replyText.trim()) {
      setError("Reply cannot be empty");
      return;
    }
    if (replyText.length > 120) {
      setError("Reply must not exceed 120 characters");
      return;
    }

    const data = {
      comentario: replyText,
      parentId: commentId,
      nome: userId ? undefined : replyData.nome || newComment.nome,
    };

    try {
      const response = await fetch(`/api/comments/${postId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to add reply: ${errorText}`);
      }

      const res = await response.json();
      const newReply = userId
        ? res.reply
        : {
            ...res.reply,
            nome: replyData.nome || newComment.nome,
            ip: newComment.ip,
          };

      setComments((prev) =>
        prev.map((comment) =>
          comment._id === commentId
            ? {
                ...comment,
                replies: [newReply, ...(comment.replies || [])].sort((a, b) =>
                  a.createdAt.localeCompare(b.createdAt)
                ),
              }
            : comment
        )
      );

      if (!userId && isClient) {
        localStorage.setItem(
          `user_${postId}`,
          JSON.stringify({
            nome: replyData.nome || newComment.nome,
            ip: newComment.ip,
          })
        );
      }

      setReplyInput((prev) => {
        const newInput = { ...prev };
        delete newInput[commentId];
        return newInput;
      });
      setReplyTo(null);
      setError(null);
    } catch (error) {
      console.error("Error adding reply:", error);
      setError(`Failed to add reply: ${(error as Error).message}`);
    }

    if (replyInputRef.current) {
      replyInputRef.current.blur();
    }
  };

  const discardReply = (commentId: string) => {
    setReplyTo(null);
    setReplyInput((prev) => {
      const newInput = { ...prev };
      delete newInput[commentId];
      return newInput;
    });
  };

  const handleDelete = async (commentId: string, isReply: boolean = false) => {
    if (deleteConfirm === commentId) {
      // Confirmação via modal, prossegue com a exclusão
      console.log("Attempting to delete comment:", {
        commentId,
        postId,
        isReply,
        userId,
        isAdmin,
      }); // Depuração
      try {
        const response = await fetch(`/api/comments/${commentId}`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ postId, isReply }), // Envia o postId no corpo
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error("Delete response error:", errorText); // Depuração
          throw new Error(`Failed to delete comment: ${errorText}`);
        }

        const data = await response.json();
        console.log("Delete success:", data.message);

        setComments((prev) =>
          isReply
            ? prev.map((c) =>
                c._id ===
                (
                  prev.find((p) =>
                    p.replies?.some((r) => r._id === commentId)
                  ) || c
                )._id
                  ? {
                      ...c,
                      replies: c.replies?.filter((r) => r._id !== commentId),
                    }
                  : c
              )
            : prev.filter((c) => c._id !== commentId)
        );

        setDeleteConfirm(null);
        setError(null);
      } catch (error) {
        console.error("Error deleting comment:", error);
        setError(`Failed to delete comment: ${(error as Error).message}`);
      }
    } else {
      // Abre o modal de confirmação
      setDeleteConfirm(commentId);
    }
  };

  const closeModal = () => {
    setDeleteConfirm(null);
  };

  const generateIdenticon = (name: string, ip: string): string => {
    const value = `${name}${ip || "Unknown"}`;
    const svg = minidenticon(value, 100, 50);
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  };

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("pt-BR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  const canDelete = (comment: Comment | AuthComment): boolean => {
    if (!isLoaded || isAdmin === null) return false;
    const isAuthor = "userId" in comment && comment.userId === userId;
    console.log("canDelete check:", {
      commentId: comment._id,
      isAdmin,
      isAuthor,
      userId,
      commentUserId: "userId" in comment ? comment.userId : null,
    }); // Log para depuração
    return isAdmin || isAuthor; // Permite exclusão para admin ou autor
  };

  // Função recursiva para contar todos os comentários e replies
  const countTotalComments = (
    commentsList: (Comment | AuthComment)[]
  ): number => {
    return commentsList.reduce((total, comment) => {
      const baseCount = 1; // Conta o comentário atual
      const replyCount = comment.replies
        ? countTotalComments(comment.replies)
        : 0; // Conta recursivamente as replies
      return total + baseCount + replyCount;
    }, 0);
  };

  const renderComments = (
    comments: (Comment | AuthComment)[],
    parentId: string | null = null
  ) => {
    const hasUserCommented =
      isClient &&
      comments.some(
        (comment) =>
          (comment as any).ip === newComment.ip &&
          (comment as any).nome === newComment.nome
      );
    const hasNameInLocalStorage =
      isClient && !!localStorage.getItem(`user_${postId}`);

    return comments
      .filter((comment) => comment.parentId === parentId)
      .map((comment) => {
        const showReplyAlert =
          replyTo === comment._id &&
          !hasUserCommented &&
          !hasNameInLocalStorage &&
          !userId;
        const replyCount = (comment.replies?.length || 0) as number;
        const shouldShowToggleButton = replyCount > 2;
        const visibleReplies = showAllReplies[comment._id]
          ? comment.replies || []
          : (comment.replies || []).slice(0, 1);

        const displayName =
          (comment as AuthComment).firstName ||
          (comment as Comment).nome ||
          "Anonymous";
        const role = (comment as AuthComment).role;
        const imageURL = (comment as AuthComment).imageURL;
        const hasImage = (comment as AuthComment).hasImage;
        const ip = (comment as Comment).ip || (comment as AuthComment).ip;

        console.log("Rendering comment:", {
          commentId: comment._id,
          parentId: comment.parentId,
          canDelete: canDelete(comment),
        }); // Log para depuração

        return (
          <div
            key={comment._id}
            className="bg-zinc-700 p-3 rounded-lg mb-3 max-sm:p-2 max-sm:mb-2 max-sm:rounded-md flex flex-col gap-2 max-sm:gap-1 items-start group relative"
          >
            <div className="flex gap-4 max-sm:gap-2 items-start">
              {hasImage ? (
                <img
                  src={imageURL}
                  alt={`${displayName} avatar`}
                  className="w-8 h-8 rounded-full max-sm:w-6 max-sm:h-6 icon"
                />
              ) : (
                <img
                  src={generateIdenticon(displayName, ip)}
                  alt={`${displayName} avatar`}
                  className="w-8 h-8 rounded-full max-sm:w-6 max-sm:h-6 icon"
                />
              )}
              <div className="flex-1">
                <div className="flex gap-2 max-sm:gap-1 items-center">
                  <p className="text-white flex gap-0.5 font-semibold max-sm:text-sm">
                    {displayName}
                    {role === "admin" && (
                      <CheckBadgeIcon className="size-5 max-sm:size-4 text-yellow-400 hover:text-yellow-500" />
                    )}
                    {role === null && (
                      <CheckBadgeIcon className="size-5 max-sm:size-4 text-blue-400 hover:text-blue-500" />
                    )}
                  </p>
                  <small className="text-gray-400 text-sm max-sm:text-xs">
                    {formatDate(comment.createdAt)}
                  </small>
                  {canDelete(comment) && (
                    <button
                      onClick={() =>
                        handleDelete(comment._id, comment.parentId !== null)
                      }
                      className="text-red-500 opacity-0 group-hover:opacity-100 max-sm:opacity-100 transition-opacity duration-200 hover:text-red-600"
                    >
                      <TrashIcon className="size-4 max-sm:size-3" />
                    </button>
                  )}
                </div>
                <p className="text-gray-300 max-sm:text-sm">
                  {comment.comentario}
                </p>
                {comment.parentId === null && comment._id !== replyTo && (
                  <button
                    onClick={() => handleReply(comment._id)}
                    className="text-purple-400 hover:text-purple-300 text-sm mt-1 max-sm:text-xs"
                  >
                    Responder
                  </button>
                )}
                {showReplyAlert && (
                  <p className="text-gray-500 text-sm mt-1 max-sm:text-xs">
                    Faça um comentário primeiro ou ponha seu nome no campo
                    "nome"
                  </p>
                )}
              </div>
            </div>
            {replyTo === comment._id && (
              <form
                onSubmit={(e) => handleReplySubmit(comment._id, e)}
                className="mt-1"
              >
                <div className="flex items-center gap-2 max-sm:gap-1">
                  {!userId && (
                    <input
                      type="text"
                      maxLength={120}
                      placeholder="Seu nome..."
                      value={replyInput[comment._id]?.nome || ""}
                      onChange={(e) =>
                        setReplyInput((prev) => ({
                          ...prev,
                          [comment._id]: {
                            ...prev[comment._id],
                            nome: e.target.value,
                          },
                        }))
                      }
                      className="p-1 bg-zinc-700 text-white rounded border outline-none border-gray-600 w-full max-sm:p-0.5 max-sm:text-sm"
                    />
                  )}
                  <input
                    type="text"
                    maxLength={120}
                    placeholder="Sua resposta..."
                    value={replyInput[comment._id]?.comentario || ""}
                    onChange={(e) =>
                      setReplyInput((prev) => ({
                        ...prev,
                        [comment._id]: {
                          ...prev[comment._id],
                          comentario: e.target.value,
                        },
                      }))
                    }
                    ref={replyInputRef}
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
                    onClick={() => discardReply(comment._id)}
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
            {shouldShowToggleButton && (
              <button
                onClick={() =>
                  setShowAllReplies((prev) => ({
                    ...prev,
                    [comment._id]: !prev[comment._id],
                  }))
                }
                className="text-gray-400 hover:text-gray-300 text-sm mt-1 max-sm:text-xs"
              >
                {showAllReplies[comment._id] ? "Mostrar menos" : "Mostrar mais"}
              </button>
            )}
            {deleteConfirm === comment._id && (
              <div className="fixed inset-0 drop-shadow-2xl flex items-center justify-center z-50">
                <div className="bg-zinc-700 p-4 rounded-lg shadow-lg">
                  <h3 className="text-white text-lg mb-2">
                    Confirmar exclusão
                  </h3>
                  <p className="text-gray-300 mb-4">
                    Tem certeza de que deseja apagar este comentário?
                  </p>
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={closeModal}
                      className="bg-gray-600 text-white px-3 py-1 rounded hover:bg-gray-700"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={() =>
                        handleDelete(comment._id, comment.parentId !== null)
                      }
                      className="bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700"
                    >
                      Confirmar
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      });
  };

  return (
    <section className="mt-3 max-sm:mt-1" aria-label="Seção de comentários">
      <h1 className="text-xl flex font-bold mb-4 max-sm:text-lg max-sm:mb-2">
        <ChatBubbleLeftRightIcon className="size-4" /> Comentários (
        {countTotalComments(comments)})
      </h1>
      {error && (
        <p className="text-red-500 mb-4 max-sm:mb-2 max-sm:text-sm">{error}</p>
      )}
      <form
        onSubmit={handleCommentSubmit}
        className="flex flex-col gap-4 max-sm:gap-2"
      >
        <div className="flex gap-4 max-sm:flex-col max-sm:gap-2">
          {!userId && isLoaded && (
            <input
              type="text"
              placeholder="Seu nome (último usado será salvo)"
              value={newComment.nome}
              onChange={(e) =>
                setNewComment({ ...newComment, nome: e.target.value })
              }
              className="p-2 bg-zinc-700 text-white rounded w-full max-sm:p-1 max-sm:text-sm"
            />
          )}
          <button
            type="submit"
            className="w-full h-fit bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 transition-colors max-sm:px-3 max-sm:py-1 max-sm:text-sm"
          >
            Enviar Comentário
          </button>
        </div>
        <textarea
          maxLength={120}
          placeholder={replyTo ? "Sua resposta..." : "Seu comentário"}
          value={newComment.comentario}
          onChange={(e) =>
            setNewComment({ ...newComment, comentario: e.target.value })
          }
          className="p-2 bg-zinc-700 text-white rounded resize-none w-full h-56 max-sm:h-32 max-sm:p-1 max-sm:text-sm"
          onFocus={() => setReplyTo(null)}
        />
      </form>
      <div className="mt-4 max-sm:mt-3">
        {renderComments(comments)}
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
