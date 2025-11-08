import DOMPurify from "dompurify";
import type { Config as DOMPurifyConfig } from "dompurify";
import { minidenticon } from "minidenticons";

import { CommentEntity, CommentLookup, PublicComment, isAuthComment } from "./types";

const ALLOWED_TAGS = [
  "a",
  "b",
  "blockquote",
  "br",
  "code",
  "em",
  "i",
  "li",
  "ol",
  "p",
  "pre",
  "span",
  "strong",
  "ul",
];

const ALLOWED_ATTR = ["href", "title", "target", "rel", "class"];

const SANITIZE_CONFIG: DOMPurifyConfig = {
  ALLOWED_TAGS,
  ALLOWED_ATTR,
  RETURN_TRUSTED_TYPE: false,
  FORBID_TAGS: ["script", "style", "iframe", "object", "embed"],
};

export const sanitizeCommentHtml = (html: string): string => {
  if (!html) {
    return "";
  }

  if (typeof window === "undefined") {
    return html;
  }

  return DOMPurify.sanitize(html, SANITIZE_CONFIG);
};

export const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) {
    return dateStr;
  }
  return date.toLocaleDateString("pt-BR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
};

export const generateIdenticon = (name: string, seed?: string): string => {
  const value = `${name}${seed || ""}`;
  const svg = minidenticon(value, 100, 50);
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
};

type ServerComment = {
  _id: string | { $oid: string } | { toString(): string };
  postId: string;
  comentario: string;
  comentarioOriginal?: string;
  createdAt: string;
  parentId: string | null;
  nome?: string;
  firstName?: string | null;
  role?: "admin" | "moderator" | null;
  userId?: string;
  imageURL?: string;
  hasImage?: boolean;
  replies?: ServerComment[];
};

const normalizeId = (
  rawId: ServerComment["_id"]
): string => {
  if (typeof rawId === "string") {
    return rawId;
  }

  if (rawId && typeof rawId === "object") {
    if ("$oid" in rawId && typeof rawId.$oid === "string") {
      return rawId.$oid;
    }

    if (typeof rawId.toString === "function") {
      return rawId.toString();
    }
  }

  return String(rawId ?? "");
};

export const normalizeServerComment = (
  comment: ServerComment
): CommentEntity => {
  const base = {
    _id: normalizeId(comment._id),
    postId: comment.postId,
    comentario: sanitizeCommentHtml(comment.comentario),
    createdAt: comment.createdAt,
    parentId: comment.parentId ?? null,
    optimistic: false,
    tempId: undefined,
    errorMessage: undefined,
  };

  if (comment.userId) {
    return {
      ...base,
      firstName: comment.firstName ?? null,
      role: comment.role ?? null,
      userId: comment.userId,
      imageURL: comment.imageURL ?? "",
      hasImage: Boolean(comment.hasImage),
    };
  }

  const publicComment: PublicComment = {
    ...base,
    nome: comment.nome,
  };

  return publicComment;
};

export const flattenServerComments = (
  comments: ServerComment[]
): CommentEntity[] => {
  const result: CommentEntity[] = [];

  const visit = (comment: ServerComment) => {
    const { replies, ...rest } = comment;
    result.push(normalizeServerComment(rest as ServerComment));
    if (Array.isArray(replies)) {
      replies.forEach(visit);
    }
  };

  comments.forEach(visit);
  return result;
};

export const buildCommentLookup = (
  comments: CommentEntity[]
): CommentLookup => {
  const lookup: CommentLookup = new Map();

  comments.forEach((comment) => {
    const key = comment.parentId ?? null;
    const bucket = lookup.get(key) ?? [];
    bucket.push(comment);
    lookup.set(key, bucket);
  });

  lookup.forEach((bucket) => {
    bucket.sort((a, b) => {
      const aDate = new Date(a.createdAt).getTime();
      const bDate = new Date(b.createdAt).getTime();
      if (Number.isNaN(aDate) || Number.isNaN(bDate)) {
        return 0;
      }
      return bDate - aDate;
    });
  });

  return lookup;
};

export const extractDisplayName = (comment: CommentEntity): string => {
  if (isAuthComment(comment)) {
    return comment.firstName || "Usuário";
  }

  return comment.nome || "Anonymous";
};

export const countThreadReplies = (lookup: CommentLookup): Map<string, number> => {
  const counts = new Map<string, number>();

  const visit = (comment: CommentEntity): number => {
    const children = lookup.get(comment._id) ?? [];
    let total = 0;
    children.forEach((child) => {
      total += 1 + visit(child);
    });
    counts.set(comment._id, total);
    return total;
  };

  lookup.forEach((bucket) => {
    bucket.forEach((comment) => {
      if (!counts.has(comment._id)) {
        visit(comment);
      }
    });
  });

  return counts;
};
