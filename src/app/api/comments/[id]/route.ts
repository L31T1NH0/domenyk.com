import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { getMongoDb } from "../../../../lib/mongo";
import { Redis } from "@upstash/redis";
import { ObjectId } from "mongodb";
import { randomUUID } from "crypto";
import { resolveAdminStatus } from "../../../../lib/admin";
import { deriveRateLimitIdentifier } from "./rate-limit";
import {
  renderMarkdownToSafeHtml,
  sanitizeHtmlFragment,
} from "../../../../lib/comments/sanitization";

type NextRequestWithOptionalIp = NextRequest & { ip?: string | null };

function getRequestIp(req: NextRequest): string | null {
  return (req as NextRequestWithOptionalIp).ip ?? null;
}

// Configuração do Redis Upstash
const redis = Redis.fromEnv();

// Tipo para documentos que serão inseridos no MongoDB
type CommentInsert = {
  _id: ObjectId;
  postId: string;
  nome?: string;
  comentario: string;
  comentarioOriginal?: string;
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
  comentarioOriginal?: string;
  createdAt: string;
  parentId: string | null;
};

// Tipo para documentos retornados (após leitura do MongoDB ou Redis)
type Comment = {
  _id: string | ObjectId;
  postId: string;
  nome?: string;
  comentario: string;
  comentarioOriginal?: string;
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
  comentarioOriginal?: string;
  createdAt: string;
  parentId: string | null;
  replies?: (Comment | AuthComment)[];
};

type CommentLike =
  | (Comment & { ip?: string | null })
  | (AuthComment & { ip?: string | null })
  | (CommentInsert & { ip?: string | null })
  | (AuthCommentInsert & { ip?: string | null });

async function sanitizeForResponse<T extends CommentLike>(
  comment: T
): Promise<Omit<T, "ip" | "comentarioOriginal"> & { comentario: string }> {
  const sanitizedHtml = await sanitizeHtmlFragment(comment.comentario ?? "");
  const { comentarioOriginal: _original, ip: _ip, ...rest } = comment as T & {
    comentarioOriginal?: string;
    ip?: string | null;
  };

  return {
    ...rest,
    comentario: sanitizedHtml,
  };
}

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

    type TreeNode = (Comment | AuthComment) & {
      _id: string;
      parentId: string | null;
      replies?: TreeNode[];
    };

    const toTreeNode = (
      comment: Comment | AuthComment,
      fallbackParentId: string | null = null
    ): TreeNode => {
      const rawId = comment._id;
      const normalizedId =
        typeof rawId === "string"
          ? rawId
          : rawId instanceof ObjectId
          ? rawId.toString()
          : randomUUID();

      const rawParent =
        comment.parentId !== undefined && comment.parentId !== null
          ? comment.parentId
          : fallbackParentId;

      const normalizedParent =
        rawParent === null || rawParent === undefined
          ? null
          : typeof rawParent === "string"
          ? rawParent
          : rawParent instanceof ObjectId
          ? rawParent.toString()
          : String(rawParent);

      return {
        ...comment,
        _id: normalizedId,
        parentId: normalizedParent,
        replies: [],
      };
    };

    const [nonAuthComments, authComments] = await Promise.all([
      commentsCollection.find({ postId }).toArray(),
      authCommentsCollection.find({ postId }).toArray(),
    ]);

    const mongoNodes: TreeNode[] = await Promise.all(
      [...nonAuthComments, ...authComments].map(async (commentDoc) => {
        const sanitized = (await sanitizeForResponse(
          commentDoc as CommentLike
        )) as Comment | AuthComment;
        return toTreeNode(sanitized);
      })
    );

    const legacyNodes: TreeNode[] = [];

    const parseLegacyReplies = async (
      replies: unknown[],
      fallbackParentId: string | null
    ): Promise<TreeNode[]> => {
      const parsedNodes: TreeNode[] = [];

      for (const reply of replies) {
        if (reply === null || reply === undefined) {
          console.error("Reply is null or undefined, skipping:", reply);
          continue;
        }

        let parsedReply: Comment | AuthComment | null = null;

        if (typeof reply === "string") {
          try {
            parsedReply = JSON.parse(reply) as Comment | AuthComment;
          } catch (parseError) {
            console.error("Invalid JSON in Redis reply:", {
              reply,
              error: (parseError as Error).message,
            });
            continue;
          }
        } else if (typeof reply === "object") {
          parsedReply = reply as Comment | AuthComment;
        } else {
          console.error(
            "Reply is neither a string nor an object, skipping:",
            reply
          );
          continue;
        }

        const sanitizedReply = (await sanitizeForResponse(
          parsedReply as CommentLike
        )) as Comment | AuthComment;
        const treeNode = toTreeNode(sanitizedReply, fallbackParentId);
        legacyNodes.push(treeNode);
        parsedNodes.push(treeNode);

        const nestedReplies = Array.isArray((parsedReply as any)?.replies)
          ? ((parsedReply as any).replies as unknown[])
          : [];

        if (nestedReplies.length > 0) {
          const nestedNodes = await parseLegacyReplies(
            nestedReplies,
            treeNode._id
          );
          parsedNodes.push(...nestedNodes);
        }
      }
      return parsedNodes;
    };

    const processedRedisParents = new Set<string>();
    const redisQueue: TreeNode[] = [...mongoNodes];

    while (redisQueue.length > 0) {
      const node = redisQueue.shift();

      if (!node || processedRedisParents.has(node._id)) {
        continue;
      }

      processedRedisParents.add(node._id);

      const redisReplies = await redis.zrange(
        `${postId}:${node._id}:replies`,
        0,
        -1
      );

      if (Array.isArray(redisReplies) && redisReplies.length > 0) {
        const parsed = await parseLegacyReplies(redisReplies, node._id);
        if (parsed.length > 0) {
          redisQueue.push(...parsed);
        }
      }
    }

    const allNodes = [...mongoNodes, ...legacyNodes];
    const nodeMap = new Map<string, TreeNode>();

    for (const node of allNodes) {
      node.replies = [];
      nodeMap.set(node._id, node);
    }

    const roots: TreeNode[] = [];
    const rootIds = new Set<string>();

    const orderedNodes = [...allNodes].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    for (const node of orderedNodes) {
      const currentNode = nodeMap.get(node._id);

      if (!currentNode) {
        continue;
      }

      if (currentNode.parentId && nodeMap.has(currentNode.parentId)) {
        const parentNode = nodeMap.get(currentNode.parentId);
        if (parentNode) {
          parentNode.replies = parentNode.replies ?? [];
          parentNode.replies.push(currentNode);
        }
      } else if (!rootIds.has(currentNode._id)) {
        roots.push(currentNode);
        rootIds.add(currentNode._id);
      }
    }

    const sortRepliesRecursively = (nodes: TreeNode[]) => {
      for (const node of nodes) {
        if (node.replies && node.replies.length > 0) {
          node.replies.sort(
            (a, b) =>
              new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          );
          sortRepliesRecursively(node.replies);
        }
      }
    };

    sortRepliesRecursively(roots);
    roots.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    const pruneEmptyReplies = (node: TreeNode) => {
      if (!node.replies || node.replies.length === 0) {
        delete node.replies;
        return;
      }

      node.replies.forEach(pruneEmptyReplies);
    };

    roots.forEach(pruneEmptyReplies);

    return NextResponse.json(roots, { status: 200 });
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

  const htmlComentario = await renderMarkdownToSafeHtml(comentario);

  // Rate Limiting
  const userAgent = req.headers.get("user-agent") || null;
  const rateLimitIdentifier = deriveRateLimitIdentifier({
    ip: getRequestIp(req),
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
        }. Limit is 25 per day per requester.`,
      },
      { status: 429 }
    );
  }

  const user = await currentUser();

  try {
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
        comentarioOriginal: comentario,
        createdAt: new Date().toISOString().split("T")[0],
        parentId: parentId || null,
      };

      const { insertedId } = await authCommentsCollection.insertOne(newComment);
      const insertedComment: AuthCommentInsert = {
        ...newComment,
        _id: insertedId,
      };

      console.log(
        `${parentId ? "Reply" : "Comment"} inserted into auth-comments:`,
        insertedComment
      );

      const sanitizedComment = await sanitizeForResponse(insertedComment);

      return NextResponse.json(
        {
          message: parentId
            ? "Reply added successfully"
            : "Comment added successfully",
          ...(parentId
            ? { reply: sanitizedComment }
            : { comment: sanitizedComment }),
        },
        { status: 201 }
      );
    } else {
      const commentsCollection = db.collection("comments");
      const userProvidedName =
        typeof nome === "string" && nome.trim() ? nome : undefined;
      const newComment: CommentInsert = {
        _id: new ObjectId(),
        postId,
        nome: userProvidedName || "Anonymous",
        comentario: htmlComentario, // Salvar como HTML
        comentarioOriginal: comentario,
        createdAt: new Date().toISOString().split("T")[0],
        parentId: parentId || null,
      };

      const { insertedId } = await commentsCollection.insertOne(newComment);
      const insertedComment: CommentInsert = {
        ...newComment,
        _id: insertedId,
      };

      console.log(
        `${parentId ? "Reply" : "Comment"} inserted into comments:`,
        insertedComment
      );

      const sanitizedComment = await sanitizeForResponse(insertedComment);

      return NextResponse.json(
        {
          message: parentId
            ? "Reply added successfully"
            : "Comment added successfully",
          ...(parentId
            ? { reply: sanitizedComment }
            : { comment: sanitizedComment }),
        },
        { status: 201 }
      );
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

    if (!ObjectId.isValid(commentId)) {
      return NextResponse.json(
        { error: "Invalid comment ID" },
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

    if (isReply) {
      const replyFilter = {
        _id: new ObjectId(commentId),
        postId,
        parentId,
      };

      let replyCollection = authCommentsCollection;
      let replyDoc = await replyCollection.findOne(replyFilter);

      if (!replyDoc) {
        replyCollection = commentsCollection;
        replyDoc = await replyCollection.findOne(replyFilter);
      }

      if (replyDoc) {
        const isAuthor = "userId" in replyDoc && replyDoc.userId === userId;
        if (!isAdmin && !isAuthor) {
          return NextResponse.json({ error: "Not Authorized" }, { status: 403 });
        }

        await replyCollection.deleteOne(replyFilter);

        return NextResponse.json(
          { message: "Comment deleted successfully", commentId },
          { status: 200 }
        );
      }

      const replyKey = `${postId}:${parentId}:replies`;
      const replies = await redis.zrange(replyKey, 0, -1);
      console.log("Replies fetched from Redis:", replies); // Log para depurar o formato dos dados

      let fallbackReply: (Comment | AuthComment) | null = null;
      let replyToRemove: string | null = null;

      for (const entry of replies) {
        if (entry === null || entry === undefined) {
          console.error("Reply is null or undefined, skipping:", entry);
          continue;
        }

        let parsed: Comment | AuthComment | null = null;
        let rawValue: string | null = null;

        if (typeof entry === "string") {
          rawValue = entry;
          try {
            parsed = JSON.parse(entry) as Comment | AuthComment;
          } catch (parseError) {
            console.error("Invalid JSON in Redis reply:", {
              reply: entry,
              error: (parseError as Error).message,
            });
            continue;
          }
        } else if (typeof entry === "object") {
          parsed = entry as Comment | AuthComment;
          try {
            rawValue = JSON.stringify(entry);
          } catch (stringifyError) {
            console.error("Unable to stringify Redis reply:", {
              reply: entry,
              error: (stringifyError as Error).message,
            });
          }
        } else {
          console.error(
            "Reply is neither a string nor an object, skipping:",
            entry
          );
          continue;
        }

        if (!parsed) {
          continue;
        }

        const parsedId =
          typeof parsed._id === "string"
            ? parsed._id
            : parsed._id && typeof parsed._id === "object" && "toString" in parsed._id
            ? (parsed._id as { toString: () => string }).toString()
            : null;

        if (parsedId === commentId) {
          fallbackReply = parsed;
          replyToRemove = rawValue ?? JSON.stringify(parsed);
          break;
        }
      }

      if (!fallbackReply || !replyToRemove) {
        return NextResponse.json({ error: "Reply not found" }, { status: 404 });
      }

      const isAuthor = "userId" in fallbackReply && fallbackReply.userId === userId;
      if (!isAdmin && !isAuthor) {
        return NextResponse.json({ error: "Not Authorized" }, { status: 403 });
      }

      await redis.zrem(replyKey, replyToRemove);

      return NextResponse.json(
        { message: "Comment deleted successfully", commentId },
        { status: 200 }
      );
    }

    let comment;
    let collection;

    // Buscar o comentário no MongoDB
    const commentFilter = {
      _id: new ObjectId(commentId),
      postId,
    };

    comment = await authCommentsCollection.findOne(commentFilter);
    collection = authCommentsCollection;

    if (!comment) {
      comment = await commentsCollection.findOne(commentFilter);
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
    await collection.deleteOne(commentFilter);
    const replyKey = `${postId}:${commentId}:replies`;
    await redis.del(replyKey);

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
