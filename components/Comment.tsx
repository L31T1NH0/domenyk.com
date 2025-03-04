"use client"; // Marca o componente como Client Component

import React, { useState, useEffect } from "react";
import CommentForm from "@components/CommentForm";
import CommentList from "@components/CommentList";
import useComments from "./useComments";

interface CommentProps {
  postId: string;
}

const Comment: React.FC<CommentProps> = ({ postId }) => {
  const { comments, error } = useComments(postId);
  const [isClient, setIsClient] = useState(false);

  // Carrega estado do cliente ao montar
  useEffect(() => {
    setIsClient(true);
  }, [postId, ]);

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
      <CommentForm postId={postId} isClient={isClient} />
      <div className="mt-6 max-sm:mt-3">
        <CommentList comments={comments} postId={postId} isClient={isClient} />
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
