import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { getMongoDb } from "../../../../lib/mongo";
import { Redis } from "@upstash/redis";
import axios from "axios";
import { ObjectId } from "mongodb";
import { remark } from "remark";
import html from "remark-html";
import { resolveAdminStatus } from "../../../../lib/admin";
import { deriveRateLimitIdentifier } from "./rate-limit";

// Configuração do Redis Upstash
const redis = Redis.fromEnv();

// Tipo para documentos que serão inseridos no MongoDB
type CommentInsert = {
  _id: ObjectId;
  postId: string;
  nome?: string;
  comentario: string;
  ip: string;
  createdAt: string;
  parentId: string | null;
};

type AuthCommentInsert = {
  _id: ObjectId;
  postId: string;
  firstName: string | null;
  role: "admin" | "moderator" | null;
  userId: string;
  imageURL: string;
  hasImage: boolean;
  comentario: string;
  ip: string;
  createdAt: string;
  parentId: string | null;
};

// Tipo para documentos retornados (após leitura do MongoDB ou Redis)
type Comment = {
  _id: string | ObjectId;
  postId: string;
  nome?: string;
  comentario: string;
  ip: string;
  createdAt: string;
  parentId: string | null;
  replies?: Comment[];
};

type AuthComment = {
  _id: string | ObjectId;
  postId: string;
  firstName: string | null;
  role: "admin" | "moderator" | null;
  userId: string;
  imageURL: string;
  hasImage: boolean;
  comentario: string;
  ip: string;
  createdAt: string;
  parentId: string | null;
  replies?: (Comment | AuthComment)[];
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
    const db = await getMongoDb();
    const commentsCollection = db.collection("comments");
    const authCommentsCollection = db.collection("auth-comments");

    // Busca comentários de usuários não logados
    const nonAuthComments = await commentsCollection
      .find({ postId, parentId: null })
      .sort({ createdAt: -1 })
      .toArray();

    // Busca comentários de usuários logados
    const authComments = await authCommentsCollection
      .find({ postId, parentId: null })
      .sort({ createdAt: -1 })
      .toArray();

    // Combina os comentários
    let allComments = [...nonAuthComments, ...authComments].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    // Mascaramento do IP no retorno
    allComments = allComments.map((comment) => ({
      ...comment,
      ip: maskIp(comment.ip),
    }));

    // Busca respostas no Redis para cada comentário
    const commentsWithReplies = await Promise.all(
      allComments.map(async (comment) => {
        const commentId = comment._id.toString();
        const replies = await redis.zrange(
          `${postId}:${commentId}:replies`,
          0,
          -1
        );

        const parsedReplies = replies
          .map((reply: unknown) => {
            if (reply === null || reply === undefined) {
              console.error("Reply is null or undefined, skipping:", reply);
              return null;
            }

            try {
              if (typeof reply === "string") {
                return JSON.parse(reply) as Comment | AuthComment;
              } else if (typeof reply === "object") {
                return reply as Comment | AuthComment;
              } else {
                console.error(
                  "Reply is neither a string nor an object, skipping:",
                  reply
                );
                return null;
              }
            } catch (parseError) {
              console.error("Invalid JSON in Redis reply:", {
                reply,
                error: (parseError as Error).message,
              });
              return null;
            }
          })
          .filter((reply): reply is Comment | AuthComment => reply !== null)
          .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
          .map((reply) => ({
            ...reply,
            ip: maskIp(reply.ip),
          }));

        return {
          ...comment,
          replies: parsedReplies.length > 0 ? parsedReplies : undefined,
        };
      })
    );

    return NextResponse.json(commentsWithReplies, { status: 200 });
  } catch (mongoError) {
    console.error("Error fetching comments:", {
      message: (mongoError as Error).message,
      stack: (mongoError as Error).stack,
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Função para mascarar o IP
function maskIp(ip: string): string {
  const parts = ip.split(".");
  if (parts.length === 4) {
    return `${parts[0]}.${parts[1]}.***.**`;
  }
  return ip; // Retorna o IP original se não for um formato válido
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const paramsData = await params;
  const postId = paramsData.id;

  console.log("Received POST request for postId:", postId);

  if (!postId || typeof postId !== "string") {
    console.log("Validation failed: postId is invalid or missing");
    return NextResponse.json(
      { error: "Post ID is required and must be a string" },
      { status: 400 }
    );
  }

  const body = await req.json();
  console.log("Request body:", body);

  // Validação estrita de campos
  const allowedFieldsLoggedIn = ["comentario", "parentId"];
  const allowedFieldsNotLoggedIn = ["comentario", "parentId", "nome"];
  const receivedFields = Object.keys(body);
  const { userId } = await auth();

  if (userId) {
    const invalidFields = receivedFields.filter(
      (field) => !allowedFieldsLoggedIn.includes(field)
    );
    if (invalidFields.length > 0) {
      return NextResponse.json(
        {
          error: `Campos inválidos para usuários logados: ${invalidFields.join(
            ", "
          )}`,
        },
        { status: 400 }
      );
    }
  } else {
    const invalidFields = receivedFields.filter(
      (field) => !allowedFieldsNotLoggedIn.includes(field)
    );
    if (invalidFields.length > 0) {
      return NextResponse.json(
        {
          error: `Campos inválidos para usuários não logados: ${invalidFields.join(
            ", "
          )}`,
        },
        { status: 400 }
      );
    }
  }

  const { comentario, parentId, nome } = body;

  if (!comentario || typeof comentario !== "string") {
    console.log("Validation failed: comentario is invalid or missing");
    return NextResponse.json(
      { error: "Comment is required and must be a string" },
      { status: 400 }
    );
  }

  // Processar o comentário com remark-html
  const processedContent = await remark()
    .use(html)
    .process(comentario);
  const htmlComentario = processedContent.toString();

  // Rate Limiting
  const userAgent = req.headers.get("user-agent") || null;
  const rateLimitIdentifier = deriveRateLimitIdentifier({
    ip: req.ip,
    userId,
    userAgent,
  });
  const rateLimitKeyBase = `rate_limit:${rateLimitIdentifier}:${postId}`;
  const rateLimitKeyComments = `${rateLimitKeyBase}:comments`;
  const rateLimitKeyReplies = `${rateLimitKeyBase}:replies`;
  const multi = redis.multi();
  if (!parentId) {
    multi.incr(rateLimitKeyComments);
    multi.expire(rateLimitKeyComments, 24 * 60 * 60);
  } else {
    multi.incr(rateLimitKeyReplies);
    multi.expire(rateLimitKeyReplies, 24 * 60 * 60);
  }
  const results = await multi.exec<[number, string][]>(); // Tipo correto para o resultado
  const count = Number(results[0][1]); // Conversão explícita de string para number

  if (count > 25) {
    return NextResponse.json(
      {
        error: `Too many ${
          parentId ? "replies" : "comments"
        }. Limit is 25 per day per IP.`,
      },
      { status: 429 }
    );
  }

  const user = await currentUser();

  try {
    let ipValue = "Unknown";
    try {
      const ipResponse = await axios.get("https://api.ipify.org?format=json", {
        timeout: 1000,
      });
      ipValue = ipResponse.data.ip;
    } catch (ipError) {
      console.warn(
        "Failed to fetch IP, using 'Unknown':",
        (ipError as any).message
      );
    }

    const db = await getMongoDb();

    if (userId && user) {
      const authCommentsCollection = db.collection("auth-comments");
      const role =
        user.publicMetadata?.role === "admin"
          ? "admin"
          : user.publicMetadata?.role === "moderator"
          ? "moderator"
          : null;

      if (role === "admin" && !user.firstName) {
        console.log("Validation failed: Admin must have a firstName");
        return NextResponse.json(
          { error: "Crie um firstName, ou tente mais tarde" },
          { status: 400 }
        );
      }

      const newComment: AuthCommentInsert = {
        _id: new ObjectId(),
        postId,
        firstName: user.firstName || null,
        role,
        userId,
        imageURL: user.imageUrl,
        hasImage: user.hasImage,
        comentario: htmlComentario, // Salvar como HTML
        ip: ipValue,
        createdAt: new Date().toISOString().split("T")[0],
        parentId: parentId || null,
      };

      if (!parentId) {
        await authCommentsCollection.insertOne(newComment);
        console.log("Comment inserted into auth-comments:", newComment);
        return NextResponse.json(
          { message: "Comment added successfully", comment: newComment },
          { status: 201 }
        );
      } else {
        const replyId = new ObjectId().toString();
        const replyData: AuthComment = {
          ...newComment,
          _id: replyId,
        };
        const replyString = JSON.stringify(replyData);
        console.log("Saving reply to Redis:", replyString); // Log para confirmar o formato
        await redis.zadd(`${postId}:${parentId}:replies`, {
          score: Date.now(),
          member: replyString,
        });
        console.log("Reply added to Redis:", replyData);
        return NextResponse.json(
          { message: "Reply added successfully", reply: replyData },
          { status: 201 }
        );
      }
    } else {
      const commentsCollection = db.collection("comments");
      const userProvidedName =
        typeof nome === "string" && nome.trim() ? nome : undefined;
      const newComment: CommentInsert = {
        _id: new ObjectId(),
        postId,
        nome: userProvidedName || "Anonymous",
        comentario: htmlComentario, // Salvar como HTML
        ip: ipValue,
        createdAt: new Date().toISOString().split("T")[0],
        parentId: parentId || null,
      };

      if (!parentId) {
        await commentsCollection.insertOne(newComment);
        console.log("Comment inserted into comments:", newComment);
        return NextResponse.json(
          { message: "Comment added successfully", comment: newComment },
          { status: 201 }
        );
      } else {
        const replyId = new ObjectId().toString();
        const replyData: Comment = {
          ...newComment,
          _id: replyId,
        };
        const replyString = JSON.stringify(replyData);
        console.log("Saving reply to Redis:", replyString); // Log para confirmar o formato
        await redis.zadd(`${postId}:${parentId}:replies`, {
          score: Date.now(),
          member: replyString,
        });
        console.log("Reply added to Redis:", replyData);
        return NextResponse.json(
          { message: "Reply added successfully", reply: replyData },
          { status: 201 }
        );
      }
    }
  } catch (error) {
    console.error("Error adding comment or reply:", {
      message: (error as Error).message,
      stack: (error as Error).stack,
    });
    return NextResponse.json(
      { error: "Internal server error: " + (error as Error).message },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: commentId } = await params;
  const { userId, sessionClaims } = await auth();
  const { isAdmin } = await resolveAdminStatus({ sessionClaims, userId });

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  console.log("Admin check:", {
    userId,
    sessionClaimsRole: sessionClaims?.metadata?.role,
    isAdmin,
  });

  try {
    const db = await getMongoDb();
    const authCommentsCollection = db.collection("auth-comments");
    const commentsCollection = db.collection("comments");

    const body = await req.json();
    console.log("DELETE request body:", body); // Log para depurar
    const { postId, isReply, parentId } = body;

    if (!commentId || typeof commentId !== "string") {
      return NextResponse.json(
        { error: "Comment ID is required and must be a string" },
        { status: 400 }
      );
    }

    if (!postId || typeof postId !== "string") {
      return NextResponse.json(
        { error: "Post ID is required and must be a string" },
        { status: 400 }
      );
    }

    if (isReply && (!parentId || typeof parentId !== "string")) {
      return NextResponse.json(
        { error: "Parent ID is required for replies and must be a string" },
        { status: 400 }
      );
    }

    let comment;
    let collection;

    if (isReply) {
      // Buscar a resposta no Redis
      const replyKey = `${postId}:${parentId}:replies`;
      const replies = await redis.zrange(replyKey, 0, -1);
      console.log("Replies fetched from Redis:", replies); // Log para depurar o formato dos dados

      // Processar as respostas, lidando com diferentes tipos de dados
      const parsedReplies = replies
        .map((r: unknown) => {
          if (r === null || r === undefined) {
            console.error("Reply is null or undefined, skipping:", r);
            return null;
          }

          try {
            if (typeof r === "string") {
              return JSON.parse(r) as Comment | AuthComment;
            } else if (typeof r === "object") {
              return r as Comment | AuthComment; // Já é um objeto, não precisa de parse
            } else {
              console.error(
                "Reply is neither a string nor an object, skipping:",
                r
              );
              return null;
            }
          } catch (parseError) {
            console.error("Invalid JSON in Redis reply:", {
              reply: r,
              error: (parseError as Error).message,
            });
            return null;
          }
        })
        .filter((reply): reply is Comment | AuthComment => reply !== null);

      const reply = parsedReplies.find((r) => r._id.toString() === commentId);

      if (!reply) {
        return NextResponse.json({ error: "Reply not found" }, { status: 404 });
      }

      comment = reply;
      const isAuthor = "userId" in comment && comment.userId === userId;
      if (!isAdmin && !isAuthor) {
        return NextResponse.json({ error: "Not Authorized" }, { status: 403 });
      }

      // Remover a resposta do Redis
      // Precisamos serializar o reply de volta para string se necessário
      const replyToRemove =
        typeof replies[replies.indexOf(reply)] === "string"
          ? JSON.stringify(reply)
          : reply;
      await redis.zrem(replyKey, replyToRemove);
    } else {
      // Buscar o comentário no MongoDB
      comment = await authCommentsCollection.findOne({
        _id: new ObjectId(commentId),
      });
      collection = authCommentsCollection;

      if (!comment) {
        comment = await commentsCollection.findOne({
          _id: new ObjectId(commentId),
        });
        collection = commentsCollection;
      }

      if (!comment) {
        return NextResponse.json({ error: "Comment not found" }, { status: 404 });
      }

      if (comment.postId !== postId) {
        return NextResponse.json(
          { error: "Comment does not belong to the specified post" },
          { status: 403 }
        );
      }

      const isAuthor = "userId" in comment && comment.userId === userId;
      console.log("Permission check:", {
        isAdmin,
        isAuthor,
        commentUserId: comment.userId,
      });
      if (!isAdmin && !isAuthor) {
        return NextResponse.json({ error: "Not Authorized" }, { status: 403 });
      }

      // Excluir o comentário do MongoDB e suas respostas do Redis
      await collection.deleteOne({ _id: new ObjectId(commentId) });
      const replyKey = `${postId}:${commentId}:replies`;
      await redis.del(replyKey);
    }

    return NextResponse.json(
      { message: "Comment deleted successfully", commentId },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error deleting comment:", {
      error: (error as Error).message,
      stack: (error as Error).stack,
    });
    return NextResponse.json(
      { error: "Internal server error: " + (error as Error).message },
      { status: 500 }
    );
  }
}
