import { NextResponse } from "next/server";
import { clientPromise } from "../../../../lib/mongo"; // Conexão com o MongoDB
import { Redis } from "@upstash/redis"; // Cliente Redis Upstash
import axios from "axios";
import { ObjectId } from "mongodb";

// Configuração do Redis Upstash
const redis = Redis.fromEnv();

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

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const paramsData = await params;
  const postId = paramsData.id;

  if (!postId || typeof postId !== "string") {
    return NextResponse.json(
      { error: "Post ID is required and must be a string" },
      { status: 400 }
    );
  }

  try {
    const client = await clientPromise;
    const db = client.db("blog");
    const commentsCollection = db.collection("comments");

    console.log("Iniciando busca de comentários para postId:", postId);

    // Busca comentários originais no MongoDB
    const originalComments = await commentsCollection
      .find({ postId, parentId: null }) // Apenas comentários de nível superior (raiz)
      .sort({ createdAt: -1 })
      .toArray();

    console.log(
      "Comentários originais encontrados no MongoDB:",
      originalComments
    );

    if (!originalComments.length) {
      console.log(
        "Nenhum comentário de nível superior encontrado para postId:",
        postId
      );
      return NextResponse.json([], { status: 200 }); // Retorna array vazio com status 200
    }

    // Busca respostas no Redis para cada comentário original
    const commentsWithReplies = await Promise.all(
      originalComments.map(async (comment) => {
        try {
          console.log(
            "Buscando replies no Redis para comentário ID:",
            comment._id.toString()
          );
          const replies = await redis.zrange(
            `${postId}:${comment._id.toString()}:replies`,
            0,
            -1
          );
          console.log("Replies brutos do Redis:", replies);

          const parsedReplies = replies
            .map((reply) => {
              let replyStr: string;
              if (typeof reply === "string") {
                replyStr = reply;
              } else if (typeof reply === "object" && reply !== null) {
                replyStr = JSON.stringify(reply);
              } else {
                console.warn(
                  "Unexpected reply format from Redis, converting to empty string:",
                  reply
                );
                return null; // Ignora formatos inválidos
              }
              try {
                return JSON.parse(replyStr) as Comment;
              } catch (parseError) {
                console.error("Invalid JSON in Redis reply:", {
                  reply: replyStr,
                  error: (parseError as Error).message,
                });
                return null; // Ignora replies inválidos
              }
            })
            .filter((reply): reply is Comment => reply !== null); // Filtra nulls e tipa corretamente

          console.log(
            "Replies parseados para comentário ID:",
            comment._id.toString(),
            parsedReplies
          );

          return {
            ...comment,
            replies: parsedReplies.sort((a, b) =>
              a.createdAt.localeCompare(b.createdAt)
            ),
          };
        } catch (redisError) {
          console.error(
            "Erro ao buscar replies no Redis para comentário ID:",
            comment._id.toString(),
            {
              message: (redisError as Error).message,
              stack: (redisError as Error).stack,
            }
          );
          return { ...comment, replies: [] }; // Retorna o comentário sem replies em caso de erro
        }
      })
    );

    console.log("Comentários com replies finais:", commentsWithReplies);

    return NextResponse.json(commentsWithReplies, { status: 200 });
  } catch (mongoError) {
    console.error(
      "Error fetching comments and replies from MongoDB (detailed):",
      {
        message: (mongoError as Error).message,
        stack: (mongoError as Error).stack,
      }
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const paramsData = await params;
  const postId = paramsData.id;

  if (!postId || typeof postId !== "string") {
    return NextResponse.json(
      { error: "Post ID is required and must be a string" },
      { status: 400 }
    );
  }

  const { nome, comentario, parentId } = await req.json();

  if (!nome || !comentario) {
    return NextResponse.json(
      { error: "Name and comment are required" },
      { status: 400 }
    );
  }

  try {
    // Obtém o IP do usuário usando a API ipify
    let ip = "Unknown";
    try {
      const ipResponse = await axios.get("https://api.ipify.org?format=json", {
        timeout: 5000, // Adiciona timeout para evitar hangs
      });
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

      const client = await clientPromise;
      const db = client.db("blog");
      const commentsCollection = db.collection("comments");

      await commentsCollection.insertOne(newComment);
      return NextResponse.json(
        {
          message: "Comment added successfully",
          comment: newComment,
        },
        { status: 201 }
      );
    } else {
      // Resposta (salva no Redis)
      const replyId = new ObjectId().toString(); // Gera um ID único para a resposta
      const replyData = {
        ...newCommentData,
        _id: replyId,
        parentId,
      };

      try {
        await redis.zadd(`${postId}:${parentId}:replies`, {
          score: Date.now(), // Usa timestamp para ordenação
          member: JSON.stringify(replyData), // Garante que é uma string JSON
        });
      } catch (redisError) {
        console.error("Erro ao salvar reply no Redis:", {
          message: (redisError as Error).message,
          stack: (redisError as Error).stack,
        });
        return NextResponse.json(
          { error: "Failed to save reply in Redis" },
          { status: 500 }
        );
      }

      return NextResponse.json(
        {
          message: "Reply added successfully",
          reply: replyData,
        },
        { status: 201 }
      );
    }
  } catch (error) {
    console.error("Error adding comment or reply (detailed):", {
      message: (error as Error).message,
      stack: (error as Error).stack,
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
