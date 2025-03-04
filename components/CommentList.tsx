"use client"; // Marca o componente como Client Component

import React from "react";
import CommentItem from "@components/CommentItem";

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

interface CommentListProps {
  comments: Comment[];
  postId: string;
  isClient: boolean;
}

const CommentList: React.FC<CommentListProps> = ({
  comments,
  postId,
  isClient,
}) => {
  const renderComments = (
    comments: Comment[],
    parentId: string | null = null
  ) => {
    return comments
      .filter((comment) => comment.parentId === parentId)
      .map((comment) => (
        <CommentItem
          key={comment._id}
          comment={comment}
          postId={postId}
          isClient={isClient}
          renderComments={renderComments}
        />
      ));
  };

  return <>{renderComments(comments)}</>;
};

export default CommentList;
