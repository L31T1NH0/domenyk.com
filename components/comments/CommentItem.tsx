import React, { useState, useEffect } from "react";
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
  coAuthorUserId?: string;
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
  coAuthorUserId,
}) => {
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  useEffect(() => {
    if (!showDeleteModal) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowDeleteModal(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [showDeleteModal]);
  const displayName = extractDisplayName(comment);
  const avatarUrl = isAuthComment(comment) && comment.hasImage
    ? comment.imageURL
    : generateIdenticon(displayName, comment.ip);

  const handleSubmit = () => {
    onReplySubmit(replyDraft);
  };

  return (
    <article
      className={`rounded-lg border p-3 shadow-sm transition-all bg-white dark:bg-zinc-900/70 ${
        comment.optimistic
          ? "border-purple-500/60 shadow-purple-300/30"
          : "border-zinc-200 dark:border-zinc-700"
      }`}
    >
      <div className="flex items-start gap-3">
        <img
          src={avatarUrl}
          alt={`${displayName} avatar`}
          className="h-8 w-8 rounded-full max-sm:w-6 object-cover icon"
        />
        <div className="flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="font-semibold text-zinc-800 dark:text-white flex items-center gap-2">
              {displayName}
              {isAuthComment(comment) && (
                <CheckBadgeIcon
                  className={`h-4 w-4 transition-transform transform duration-150 ease-in-out hover:scale-110 ${
                    comment.role === "admin"
                      ? "text-yellow-500 hover:text-yellow-600"
                      : comment.role === "moderator"
                      ? "text-red-500 hover:text-red-600"
                      : "text-blue-500 hover:text-blue-600"
                  }`}
                />
              )}
            </span>
            <span className="text-xs text-zinc-500">
              {formatDate(comment.createdAt)}
            </span>
            {isAuthComment(comment) && comment.role === "admin" && (
              <span className="rounded-full border border-yellow-500/40 px-3 py-1 text-[10px] uppercase tracking-wide text-yellow-300">
                Autor
              </span>
            )}
            {isAuthComment(comment) && comment.role === "moderator" && (
              <span className="rounded-full border border-red-500/40 px-3 py-1 text-[10px] uppercase tracking-wide text-red-300">
                Colaborador
              </span>
            )}
            {isAuthComment(comment) && coAuthorUserId && comment.userId === coAuthorUserId && (
              <span className="rounded-full border uppercase border-blue-500/40 px-2 py-0.5 text-[10px] tracking-wide text-blue-300">
                co-autor
              </span>
            )}
            {comment.optimistic && (
              <span className="rounded-full border border-purple-500/60 px-3 py-1 text-[10px] uppercase tracking-wide text-purple-300">
                Enviando...
              </span>
            )}
          </div>

          <div
            className="prose prose-zinc dark:prose-invert max-w-none text-sm leading-relaxed text-zinc-700 dark:text-zinc-100"
            dangerouslySetInnerHTML={{
              __html: sanitizeCommentHtml(comment.comentario),
            }}
          />

          <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400">
            <button
              type="button"
              onClick={onReplyRequest}
              className="inline-flex items-center gap-1 rounded-full border border-zinc-300 bg-white px-3 py-1 text-sm font-medium text-zinc-700 transition-colors hover:border-purple-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700"
            >
              Responder
            </button>
            {canDelete && (
              <>
                <button
                  type="button"
                  onClick={() => setShowDeleteModal(true)}
                  className="flex items-center gap-2 text-xs font-medium text-red-500 transition-colors hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 rounded-full"
                >
                  <TrashIcon className="h-3.5 w-3.5" /> Remover
                </button>

                {showDeleteModal && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center">
                    <div
                      className="fixed inset-0 bg-black/70"
                      aria-hidden="true"
                      onClick={() => setShowDeleteModal(false)}
                    />

                    <div
                      role="dialog"
                      aria-modal="true"
                      aria-labelledby={`delete-modal-${comment._id}`}
                      className="z-50 mx-4 max-w-md w-full rounded-2xl border border-zinc-200 bg-white p-4 shadow-lg dark:border-zinc-800/90 dark:bg-zinc-950"
                    >
                      <h3 id={`delete-modal-${comment._id}`} className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">Confirmar remoção</h3>
                      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">Tem certeza que deseja remover este comentário? Esta ação não pode ser desfeita.</p>
                      <div className="mt-3 flex justify-end gap-3">
                        <button
                          type="button"
                          onClick={() => setShowDeleteModal(false)}
                          className="rounded-full border border-zinc-300 px-4 py-2 text-sm text-zinc-700 dark:border-zinc-700 dark:text-zinc-200"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setShowDeleteModal(false);
                            onDelete();
                          }}
                          className="rounded-full bg-red-600 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                        >
                          Remover
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </>
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

          {children && <div className="space-y-3 sm:space-y-4 border-l border-zinc-200 dark:border-zinc-700 pl-3 sm:pl-4">{children}</div>}
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













