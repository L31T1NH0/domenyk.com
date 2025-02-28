import { NextApiRequest, NextApiResponse } from "next";

interface Comment {
  _id: string;
  postId: string;
  nome: string;
  comentario: string;
  ip: string;
  createdAt: string;
  parentId: string | null;
}
import clientPromise from "../../../lib/mongo"; // Conexão com o MongoDB
import axios from "axios";
import { ObjectId } from "mongodb";
import { Redis } from "@upstash/redis"; // Cliente Redis Upstash

// Configuração do Redis Upstash
const redis = Redis.fromEnv();

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { postId } = req.query;

  if (!postId || typeof postId !== "string") {
    return res
      .status(400)
      .json({ error: "Post ID is required and must be a string" });
  }

  const client = await clientPromise;
  const db = client.db("blog");
  const commentsCollection = db.collection("comments");

  if (req.method === "GET") {
    try {
      // Busca comentários originais no MongoDB
      const originalComments = await commentsCollection
        .find({ postId, parentId: null }) // Apenas comentários de nível superior (raiz)
        .sort({ createdAt: -1 })
        .toArray();

      // Busca respostas no Redis para cada comentário original
      const commentsWithReplies = await Promise.all(
        originalComments.map(async (comment) => {
          const replies = await redis.zrange(
            `${postId}:${comment._id.toString()}:replies`,
            0,
            -1
          );
          // Converte explicitamente para string e valida antes de parsear
          const parsedReplies = replies
            .map((reply) => {
              let replyStr: string;
              if (typeof reply === "string") {
                replyStr = reply;
              } else if (typeof reply === "object" && reply !== null) {
                // Se for um objeto, converte para string (ex.: JSON.stringify se necessário)
                replyStr = JSON.stringify(reply);
              } else {
                console.warn(
                  "Unexpected reply format from Redis, converting to empty string:",
                  reply
                );
                return null; // Ignora formatos inválidos
              }
              try {
                return JSON.parse(replyStr);
              } catch (error) {
                console.error("Invalid JSON in Redis reply:", {
                  reply: replyStr,
                  error: (error as Error).message,
                });
                return null; // Ignora replies inválidos
              }
            })
            .filter((reply): reply is Comment => reply !== null); // Filtra nulls e tipa corretamente
          return {
            ...comment,
            replies: parsedReplies.sort((a, b) =>
              a.createdAt.localeCompare(b.createdAt)
            ),
          };
        })
      );

      res.status(200).json(commentsWithReplies);
    } catch (error) {
      console.error("Error fetching comments and replies (detailed):", {
        message: (error as Error).message,
        stack: (error as Error).stack,
      });
      res.status(500).json({ error: "Internal server error" });
    }
  } else if (req.method === "POST") {
    const { nome, comentario, parentId } = req.body;

    if (!nome || !comentario) {
      return res.status(400).json({ error: "Name and comment are required" });
    }

    try {
      // Obtém o IP do usuário usando a API ipify
      let ip = "Unknown";
      try {
        const ipResponse = await axios.get("https://api.ipify.org?format=json");
        ip = ipResponse.data.ip;
      } catch (ipError) {
        console.warn(
          "Failed to fetch IP, using 'Unknown':",
          (ipError as any).message
        );
      }

      const newCommentData = {
        nome,
        comentario,
        ip,
        createdAt: new Date().toISOString().split("T")[0], // Salva apenas a data (YYYY-MM-DD)
      };

      if (!parentId) {
        // Comentário de nível superior (salva no MongoDB)
        const newComment = {
          _id: new ObjectId(),
          postId,
          ...newCommentData,
          parentId: null,
        };

        await commentsCollection.insertOne(newComment);
        res.status(201).json({
          message: "Comment added successfully",
          comment: newComment,
        });
      } else {
        // Resposta (salva no Redis)
        const replyId = new ObjectId().toString(); // Gera um ID único para a resposta
        const replyData = {
          ...newCommentData,
          _id: replyId,
          parentId,
        };

        await redis.zadd(`${postId}:${parentId}:replies`, {
          score: Date.now(), // Usa timestamp para ordenação
          member: JSON.stringify(replyData), // Garante que é uma string JSON
        });

        res.status(201).json({
          message: "Reply added successfully",
          reply: replyData,
        });
      }
    } catch (error) {
      console.error("Error adding comment or reply (detailed):", {
        message: (error as Error).message,
        stack: (error as Error).stack,
      });
      res.status(500).json({ error: "Internal server error" });
    }
  } else {
    res.status(405).json({ error: "Method not allowed" });
  }
}
