import React, { useState, useEffect, useRef } from "react";
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
  replies?: Comment[]; // Adiciona suporte a respostas (opcional, para compatibilidade)
};

interface CommentProps {
  postId: string;
}

const Comment: React.FC<CommentProps> = ({ postId }) => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState({
    nome: "",
    comentario: "",
    ip: "",
    parentId: null as string | null,
  });
  const [error, setError] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<string | null>(null); // Estado para controlar a resposta a um comentário
  const [replyInput, setReplyInput] = useState<{
    [key: string]: { nome: string; comentario: string };
  }>({}); // Estado para campos de resposta dentro dos comentários, incluindo nome
  const [isClient, setIsClient] = useState(false); // Estado para verificar se está no cliente
  const [showAllReplies, setShowAllReplies] = useState<{
    [key: string]: boolean;
  }>({}); // Estado para controlar replies visíveis por comentário
  const replyInputRef = useRef<HTMLInputElement>(null); // Referência para o campo de resposta inline

  // Carrega nome e IP do localStorage, apenas no cliente
  useEffect(() => {
    setIsClient(true);
    const storedUser = localStorage.getItem(`user_${postId}`);
    if (storedUser) {
      const { nome, ip } = JSON.parse(storedUser);
      setNewComment((prev) => ({ ...prev, nome: nome || "", ip: ip || "" }));
    }
  }, [postId]);

  // Busca comentários ao montar o componente
  useEffect(() => {
    fetchComments();
  }, [postId]);

  const fetchComments = async () => {
    try {
      const response = await axios.get(`/api/comments/${postId}`);
      console.log("API response for comments (raw):", response.data);
      if (Array.isArray(response.data)) {
        setComments(response.data);
      } else if (response.data && typeof response.data === "object") {
        setComments(
          Array.isArray(response.data.comments)
            ? response.data.comments
            : [response.data]
        );
      } else {
        setComments([]);
        console.warn(
          "Unexpected API response format, setting comments to empty array"
        );
      }
      console.log("Comments with replies after setting:", comments);
    } catch (err) {
      console.error("Error fetching comments (detailed):", {
        message: (err as Error).message,
        response: (err as any).response?.data,
        status: (err as any).response?.status,
      });
      setError("Failed to load comments: " + (err as Error).message);
      setComments([]);
    }
  };

  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.nome || !newComment.comentario) {
      setError("Name and comment are required");
      return;
    }
    if (newComment.comentario.length > 120) {
      setError("Comment must not exceed 120 characters");
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
        parentId: newComment.parentId, // Envia parentId para criar um comentário ou resposta
      });

      if (isClient) {
        localStorage.setItem(
          `user_${postId}`,
          JSON.stringify({ nome: newComment.nome, ip })
        );
      }

      setComments((prev) => {
        if (newComment.parentId) {
          return prev.map((comment) => {
            if (comment._id === newComment.parentId) {
              return {
                ...comment,
                replies: [
                  response.data.reply || response.data.comment,
                  ...(comment.replies || []),
                ].sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
              };
            }
            return comment;
          });
        } else {
          return [response.data.comment, ...prev];
        }
      });
      setNewComment({
        nome: newComment.nome, // Mantém o nome para consistência
        comentario: "",
        ip: newComment.ip,
        parentId: null,
      });
      setReplyTo(null);
      setReplyInput({});
      setError(null);
    } catch (err) {
      console.error("Error adding comment or reply (detailed):", {
        message: (err as Error).message,
        response: (err as any).response?.data,
        status: (err as any).response?.status,
      });
      setError("Failed to add comment or reply: " + (err as Error).message);
    }
  };

  const handleReply = (commentId: string) => {
    setReplyTo(commentId);
    if (isClient) {
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
    // Foca no campo de resposta inline após abrir
    if (replyInputRef.current) {
      replyInputRef.current.focus();
    }
  };

  const handleReplySubmit = (
    commentId: string,
    e: React.FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault();
    const replyData = replyInput[commentId] || { nome: "", comentario: "" };
    const replyText = replyData.comentario || "";
    if (!replyText.trim()) return;
    if (replyText.length > 120) {
      setError("Reply must not exceed 120 characters");
      return;
    }

    // Envia apenas os dados da resposta, mantendo newComment intocado
    const response = axios.post(`/api/comments/${postId}`, {
      nome: replyData.nome || newComment.nome, // Usa o nome do replyInput ou o nome atual
      comentario: replyText,
      parentId: commentId,
    });

    response
      .then((res) => {
        setComments((prev) => {
          return prev.map((comment) => {
            if (comment._id === commentId) {
              return {
                ...comment,
                replies: [
                  res.data.reply || res.data.comment,
                  ...(comment.replies || []),
                ].sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
              };
            }
            return comment;
          });
        });
        if (isClient) {
          const storedUser = localStorage.getItem(`user_${postId}`);
          const currentIp = newComment.ip || "Unknown";
          const currentName = replyData.nome || newComment.nome;
          localStorage.setItem(
            `user_${postId}`,
            JSON.stringify({ nome: currentName, ip: currentIp })
          );
        }
        setReplyInput((prev) => {
          const newInput = { ...prev };
          delete newInput[commentId];
          return newInput;
        });
        setReplyTo(null); // Fecha o campo de resposta
        setError(null);
      })
      .catch((err) => {
        console.error("Error adding reply (detailed):", {
          message: (err as Error).message,
          response: (err as any).response?.data,
          status: (err as any).response?.status,
        });
        setError("Failed to add reply: " + (err as Error).message);
      });

    // Mantém o foco no campo ou evita redirecionamento visual
    if (replyInputRef.current) {
      replyInputRef.current.blur(); // Remove o foco para evitar redirecionamento visual
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

  const renderComments = (
    comments: Comment[],
    parentId: string | null = null
  ) => {
    const hasUserCommented =
      isClient &&
      comments.some(
        (comment) =>
          comment.ip === newComment.ip && comment.nome === newComment.nome
      );
    const hasNameInLocalStorage =
      isClient && !!localStorage.getItem(`user_${postId}`);

    return comments
      .filter((comment) => comment.parentId === parentId)
      .map((comment) => {
        const showReplyAlert =
          replyTo === comment._id &&
          !hasUserCommented &&
          !hasNameInLocalStorage;

        const replyCount = comment.replies?.length || 0;
        const shouldShowToggleButton = replyCount > 2; // Mostra o botão apenas se houver mais de 2 replies
        const visibleReplies = showAllReplies[comment._id]
          ? comment.replies || []
          : (comment.replies || []).slice(0, 2); // Mostra apenas os 2 primeiros replies por padrão

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
          </div>
        );
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
          maxLength={120}
          placeholder={replyTo ? "Seu comentário..." : "Seu comentário"}
          value={newComment.comentario}
          onChange={(e) =>
            setNewComment({ ...newComment, comentario: e.target.value })
          }
          className="p-2 bg-zinc-700 text-white rounded resize-none w-full h-56 max-sm:h-32 max-sm:p-1 max-sm:text-sm"
          onFocus={() => setReplyTo(null)} // Remove o foco do reply ao interagir com o textarea principal
        />
      </form>
      <div className="mt-6 max-sm:mt-3">
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
