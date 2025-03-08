import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { getMongoDb } from "../../../../lib/mongo"; // Usando as funções do seu mongo.ts
import { Redis } from "@upstash/redis"; // Cliente Redis Upstash
import axios from "axios";
import { ObjectId } from "mongodb";

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
  role: "admin" | null;
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
    const allComments = [...nonAuthComments, ...authComments].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

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
            // Verifique e converta para string se necessário
            let replyString: string;
            if (typeof reply === "string") {
              replyString = reply;
            } else if (reply !== null && typeof reply === "object") {
              console.warn(
                "Reply is not a string, attempting to stringify:",
                reply
              );
              replyString = JSON.stringify(reply);
            } else {
              console.error(
                "Reply is neither string nor object, skipping:",
                reply
              );
              return null;
            }
            try {
              return JSON.parse(replyString) as Comment | AuthComment;
            } catch (parseError) {
              console.error("Invalid JSON in Redis reply:", {
                reply: replyString,
                error: (parseError as Error).message,
              });
              return null;
            }
          })
          .filter((reply): reply is Comment | AuthComment => reply !== null)
          .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

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

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const paramsData = await params;
  const postId = paramsData.id;

  console.log("Received POST request for postId:", postId); // Log para depuração

  if (!postId || typeof postId !== "string") {
    console.log("Validation failed: postId is invalid or missing");
    return NextResponse.json(
      { error: "Post ID is required and must be a string" },
      { status: 400 }
    );
  }

  const { comentario, parentId, nome } = await req.json();
  console.log("Request body:", { comentario, parentId, nome }); // Log do corpo da requisição

  if (!comentario || typeof comentario !== "string") {
    console.log("Validation failed: comentario is invalid or missing");
    return NextResponse.json(
      { error: "Comment is required and must be a string" },
      { status: 400 }
    );
  }

  const { userId, sessionClaims } = await auth();
  const user = await currentUser();

  try {
    let ip = "Unknown";
    try {
      const ipResponse = await axios.get("https://api.ipify.org?format=json", {
        timeout: 1000,
      });
      ip = ipResponse.data.ip;
    } catch (ipError) {
      console.warn(
        "Failed to fetch IP, using 'Unknown':",
        (ipError as any).message
      );
    }

    const db = await getMongoDb();

    if (userId && user) {
      const authCommentsCollection = db.collection("auth-comments");
      const role = sessionClaims?.metadata?.role === "admin" ? "admin" : null;

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
        comentario,
        ip,
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
        const replyString = JSON.stringify(replyData); // Garanta que seja uma string JSON válida
        console.log("Saving reply to Redis:", replyString);
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
      // Use o nome fornecido pelo frontend, sem fallback para "Anonymous" se o nome estiver presente
      const userProvidedName =
        typeof nome === "string" && nome.trim() ? nome : undefined;
      const newComment: CommentInsert = {
        _id: new ObjectId(),
        postId,
        nome: userProvidedName || "Anonymous", // Usa "Anonymous" apenas se nenhum nome for fornecido
        comentario,
        ip,
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
        const replyString = JSON.stringify(replyData); // Garanta que seja uma string JSON válida
        console.log("Saving reply to Redis:", replyString);
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
  const { id: commentId } = await params; // commentId vem da URL
  const { userId, sessionClaims } = await auth();
  const user = await currentUser();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Depuração do status de administrador
  const isAdmin =
    user?.unsafeMetadata?.role === "admin" ||
    sessionClaims?.metadata?.role === "admin";
  console.log("Admin check:", {
    userId,
    unsafeMetadataRole: user?.unsafeMetadata?.role,
    sessionClaimsRole: sessionClaims?.metadata?.role,
    isAdmin,
  });

  try {
    const db = await getMongoDb();
    const authCommentsCollection = db.collection("auth-comments");
    const commentsCollection = db.collection("comments");

    const { postId, isReply } = await req.json();

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

    // Busca o comentário nas coleções auth-comments ou comments
    let comment = await authCommentsCollection.findOne({
      _id: new ObjectId(commentId),
    });
    let collection = authCommentsCollection;

    if (!comment) {
      comment = await commentsCollection.findOne({
        _id: new ObjectId(commentId),
      });
      collection = commentsCollection;
    }

    if (!comment) {
      return NextResponse.json({ error: "Comment not found" }, { status: 404 });
    }

    // Verifica se o postId do comentário corresponde ao postId da requisição
    if (comment.postId !== postId) {
      return NextResponse.json(
        { error: "Comment does not belong to the specified post" },
        { status: 403 }
      );
    }

    // Verifica permissões: usuário é admin ou autor do comentário
    const isAuthor = "userId" in comment && comment.userId === userId;
    console.log("Permission check:", {
      isAdmin,
      isAuthor,
      commentUserId: comment.userId,
    });
    if (!isAdmin && !isAuthor) {
      return NextResponse.json({ error: "Not Authorized" }, { status: 403 });
    }

    if (isReply) {
      // Remove a resposta do Redis
      const parentComment = await collection.findOne({
        "replies._id": commentId,
      });
      if (parentComment) {
        const replyKey = `${postId}:${parentComment._id}:replies`;
        await redis.zrem(replyKey, JSON.stringify(comment));
      }
    } else {
      // Remove o comentário principal e suas respostas do Redis
      await collection.deleteOne({ _id: new ObjectId(commentId) });
      const replyKey = `${postId}:${commentId}:replies`;
      await redis.del(replyKey); // Remove todas as respostas associadas
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
