import React from "react";
import { CheckBadgeIcon, TrashIcon } from "@heroicons/react/24/solid";

import ReplyForm from "./ReplyForm";
import {
  CommentDraft,
  CommentEntity,
  SubmissionStatus,
  isAuthComment,
} from "./types";
import {
  extractDisplayName,
  generateIdenticon,
  sanitizeCommentHtml,
  formatDate,
} from "./utils";

type CommentItemProps = {
  comment: CommentEntity;
  onReplyRequest: () => void;
  onReplyCancel: () => void;
  onReplySubmit: (draft: CommentDraft) => void;
  onReplyDraftChange: (draft: CommentDraft) => void;
  replyDraft: CommentDraft;
  replyStatus: SubmissionStatus;
  replyError?: string | null;
  isReplying: boolean;
  canDelete: boolean;
  onDelete: () => void;
  requiresName: boolean;
  children?: React.ReactNode;
};

const CommentItem: React.FC<CommentItemProps> = ({
  comment,
  onReplyRequest,
  onReplyCancel,
  onReplySubmit,
  onReplyDraftChange,
  replyDraft,
  replyStatus,
  replyError,
  isReplying,
  canDelete,
  onDelete,
  requiresName,
  children,
}) => {
  const displayName = extractDisplayName(comment);
  const avatarUrl = isAuthComment(comment) && comment.hasImage
    ? comment.imageURL
    : generateIdenticon(displayName, comment.ip);

  const handleSubmit = () => {
    onReplySubmit(replyDraft);
  };

  return (
    <article
      className={`rounded-2xl border bg-zinc-950/70 p-4 transition-all ${
        comment.optimistic
          ? "border-purple-500/60 shadow-lg shadow-purple-800/30"
          : "border-zinc-800/80"
      }`}
    >
      <div className="flex items-start gap-3">
        <img
          src={avatarUrl}
          alt={`${displayName} avatar`}
          className="h-8 w-8 rounded-full max-sm:w-6 object-cover icon"
        />
        <div className="flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-semibold text-zinc-100 flex items-center gap-1">
              {displayName}
              {isAuthComment(comment) && (
                <CheckBadgeIcon
                  className={`h-4 w-4 ${
                    comment.role === "admin"
                      ? "text-yellow-400"
                      : "text-blue-400"
                  }`}
                />
              )}
            </span>
            <span className="text-xs text-zinc-500">
              {formatDate(comment.createdAt)}
            </span>
            {isAuthComment(comment) && comment.role === "admin" && (
              <span className="rounded-full border border-yellow-500/40 px-2 py-0.5 text-[10px] uppercase tracking-wide text-yellow-300">
                Autor
              </span>
            )}
            {comment.optimistic && (
              <span className="rounded-full border border-purple-500/60 px-2 py-0.5 text-[10px] uppercase tracking-wide text-purple-300">
                Enviando…
              </span>
            )}
          </div>

          <div
            className="prose prose-invert max-w-none text-sm leading-relaxed text-zinc-200"
            dangerouslySetInnerHTML={{
              __html: sanitizeCommentHtml(comment.comentario),
            }}
          />

          <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400">
            <button
              type="button"
              onClick={onReplyRequest}
              className="rounded-full border border-zinc-700/60 px-3 py-1 font-medium text-zinc-200 transition hover:border-purple-500 hover:text-white"
            >
              Responder
            </button>
            {canDelete && (
              <button
                type="button"
                onClick={onDelete}
                className="flex items-center gap-1 rounded-full border border-red-500/40 px-3 py-1 font-medium text-red-300 transition hover:border-red-500 hover:text-red-200"
              >
                <TrashIcon className="h-3.5 w-3.5" /> Remover
              </button>
            )}
          </div>

          {isReplying && (
            <ReplyForm
              commentId={comment._id}
              draft={replyDraft}
              onDraftChange={(_, nextDraft) => onReplyDraftChange(nextDraft)}
              onSubmit={(_, draft) => handleSubmitWrapper(handleSubmit, draft)}
              onCancel={onReplyCancel}
              requiresName={requiresName}
              maxLength={120}
              status={replyStatus}
              errorMessage={replyError}
            />
          )}

          {children && <div className="space-y-4 border-l border-zinc-800/70 pl-4">{children}</div>}
        </div>
      </div>
    </article>
  );
};

const handleSubmitWrapper = (
  submit: () => void,
  draft: CommentDraft
) => {
  if (!draft.comentario.trim()) {
    return;
  }
  submit();
};

export default CommentItem;
