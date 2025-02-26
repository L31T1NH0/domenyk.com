import { NextApiRequest, NextApiResponse } from "next";
import clientPromise from "../../../lib/mongo"; // Conexão com o MongoDB
import axios from "axios";
import { ObjectId } from "mongodb";

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
      const comments = await commentsCollection
        .find({ postId })
        .sort({ createdAt: -1 }) // Ordena por data, mais recentes primeiro
        .toArray();
      res.status(200).json(comments);
    } catch (error) {
      console.error("Error fetching comments:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  } else if (req.method === "POST") {
    const { nome, comentario } = req.body;

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
        console.warn("Failed to fetch IP, using 'Unknown':", (ipError as any).message);
      }

      const newComment = {
        _id: new ObjectId(), // Gera um ObjectId único para cada comentário
        postId,
        nome,
        comentario,
        ip, // Armazena o IP para segurança simples, mas não o identicon
        createdAt: new Date().toISOString().split("T")[0], // Salva apenas a data (YYYY-MM-DD)
      };

      await commentsCollection.insertOne(newComment);
      res.status(201).json({
        message: "Comment added successfully",
        comment: newComment, // Passa nome e ip para o frontend gerar o identicon
      });
    } catch (error) {
      console.error("Error adding comment:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  } else {
    res.status(405).json({ error: "Method not allowed" });
  }
}
