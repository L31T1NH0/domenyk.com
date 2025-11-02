export type SubmissionStatus = "idle" | "typing" | "sending" | "success" | "error";

export type BaseComment = {
  _id: string;
  postId: string;
  comentario: string;
  createdAt: string;
  parentId: string | null;
  optimistic?: boolean;
  tempId?: string;
  errorMessage?: string;
};

export type PublicComment = BaseComment & {
  nome?: string;
};

export type AuthComment = BaseComment & {
  firstName: string | null;
  role: "admin" | "moderator" | null;
  userId: string;
  imageURL: string;
  hasImage: boolean;
};

export type CommentEntity = PublicComment | AuthComment;

export type CommentDraft = {
  nome: string;
  comentario: string;
};

export type CommentLookup = Map<string | null, CommentEntity[]>;

export const isAuthComment = (comment: CommentEntity): comment is AuthComment =>
  "userId" in comment;
