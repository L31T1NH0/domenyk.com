import React, { useState, useEffect } from "react";
import { CheckBadgeIcon, TrashIcon } from "@heroicons/react/24/solid";

import CommentAvatar from "../CommentAvatar";
import ReplyForm from "./ReplyForm";
import { STANDARD_COMMENT_MAX_LENGTH } from "./lengthUtils";
import {
  CommentDraft,
  CommentEntity,
  SubmissionStatus,
  isAuthComment,
} from "./types";
import {
  extractDisplayName,
  sanitizeCommentHtml,
  formatDate,
} from "./utils";
import { cn } from "@lib/cn";

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
  depth?: number;
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
  depth = 0,
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

  const handleSubmit = () => {
    onReplySubmit(replyDraft);
  };

  const badges: Array<{ key: string; label: string }> = [];
  if (isAuthComment(comment)) {
    if (comment.role === "admin") {
      badges.push({ key: "admin", label: "Autor" });
    } else if (comment.role === "moderator") {
      badges.push({ key: "moderator", label: "Colaborador" });
    }
    if (coAuthorUserId && comment.userId === coAuthorUserId) {
      badges.push({ key: "co-author", label: "Co-autor" });
    }
  }
  if (comment.optimistic) {
    badges.push({ key: "pending", label: "Enviando" });
  }

  const metadataText = formatDate(comment.createdAt);

  return (
    <article
      className={cn(
        "comment-card group relative",
        depth > 0 ? "mt-4" : undefined,
        comment.optimistic && "border-[rgba(255,75,139,0.45)]"
      )}
    >
      {canDelete && (
        <>
          <button
            type="button"
            onClick={() => setShowDeleteModal(true)}
            className="motion-scale absolute right-4 top-4 inline-flex size-9 items-center justify-center rounded-full border border-[rgba(255,255,255,0.12)] bg-[rgba(10,10,10,0.85)] text-[var(--color-muted)] opacity-0 transition group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
            aria-label="Remover comentário"
          >
            <TrashIcon className="size-4" />
          </button>
          {showDeleteModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-10 backdrop-blur-sm">
              <div className="w-full max-w-md rounded-3xl border border-[var(--color-border)] bg-[rgba(12,12,12,0.96)] p-6 shadow-[0_30px_60px_rgba(0,0,0,0.55)]">
                <h3 className="text-sm uppercase tracking-[0.28em] text-white">Confirmar remoção</h3>
                <p className="mt-3 text-sm text-[var(--color-muted)]">
                  Tem certeza que deseja remover este comentário? Esta ação não pode ser desfeita.
                </p>
                <div className="mt-6 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowDeleteModal(false)}
                    className="motion-scale inline-flex items-center justify-center rounded-full border border-[rgba(255,255,255,0.12)] px-5 py-2 text-xs uppercase tracking-[0.2em] text-[var(--color-muted)] transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowDeleteModal(false);
                      onDelete();
                    }}
                    className="motion-scale inline-flex items-center justify-center rounded-full bg-[var(--color-accent)] px-5 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-black transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[rgba(12,12,12,0.96)]"
                  >
                    Remover
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      <div className="flex items-start gap-4">
        <CommentAvatar
          imageUrl={isAuthComment(comment) && comment.hasImage ? comment.imageURL : null}
          name={displayName}
          ipHash={comment.ip}
          size={44}
          className="h-11 w-11"
        />
        <div className="flex-1 min-w-0 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                {displayName}
                {isAuthComment(comment) && (
                  <CheckBadgeIcon className="size-4 text-[var(--color-accent)]" />
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2 text-[0.62rem] uppercase tracking-[0.28em] text-[var(--color-muted)]">
                <span>{metadataText}</span>
                {badges.map((badge) => (
                  <span
                    key={badge.key}
                    className="rounded-full border border-[rgba(255,255,255,0.14)] px-3 py-1 text-[0.58rem] uppercase tracking-[0.3em] text-[var(--color-muted)]"
                  >
                    {badge.label}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div
            className="comment-body"
            dangerouslySetInnerHTML={{
              __html: sanitizeCommentHtml(comment.comentario),
            }}
          />

          <div className="flex flex-wrap items-center gap-3 text-[0.68rem] uppercase tracking-[0.28em] text-[var(--color-muted)]">
            <button
              type="button"
              onClick={onReplyRequest}
              className="motion-scale inline-flex items-center gap-2 rounded-full border border-[rgba(255,255,255,0.12)] bg-[rgba(22,22,22,0.6)] px-4 py-1.5 text-[0.68rem] uppercase tracking-[0.28em] text-[var(--color-muted)] transition hover:text-[var(--color-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
            >
              Responder
            </button>
          </div>

          {isReplying && (
            <ReplyForm
              commentId={comment._id}
              draft={replyDraft}
              onDraftChange={(_, nextDraft) => onReplyDraftChange(nextDraft)}
              onSubmit={(_, draft) => handleSubmitWrapper(handleSubmit, draft)}
              onCancel={onReplyCancel}
              requiresName={requiresName}
              maxLength={STANDARD_COMMENT_MAX_LENGTH}
              status={replyStatus}
              errorMessage={replyError}
            />
          )}

          {children && <div className="space-y-6">{children}</div>}
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
