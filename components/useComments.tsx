"use client"; // Marca o hook como Client Component

import { useState, useCallback } from "react";
import axios from "axios";

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

export default function useComments(postId: string) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [error, setError] = useState<string | null>(null);



  return { comments, error };
}
