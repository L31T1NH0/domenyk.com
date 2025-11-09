import React, { useEffect, useMemo } from "react";
import { XMarkIcon } from "@heroicons/react/24/outline";

import CommentItem from "./CommentItem";
import ReplyForm from "./ReplyForm";
import { STANDARD_COMMENT_MAX_LENGTH } from "./lengthUtils";
import {
  CommentDraft,
  CommentEntity,
  CommentLookup,
  SubmissionStatus,
} from "./types";
import { extractDisplayName } from "./utils";

type ThreadPanelProps = {
  rootCommentId: string;
  lookup: CommentLookup;
  replyCounts: Map<string, number>;
  commentById: Map<string, CommentEntity>;
  onClose: () => void;
  onReplyRequest: (commentId: string) => void;
  onReplyCancel: (commentId: string) => void;
  onReplySubmit: (commentId: string, draft: CommentDraft) => void;
  onReplyDraftChange: (commentId: string, draft: CommentDraft) => void;
  getReplyDraft: (commentId: string) => CommentDraft;
  getReplyStatus: (commentId: string) => SubmissionStatus;
  getReplyError: (commentId: string) => string | null;
  isReplying: (commentId: string) => boolean;
  canDelete: (comment: CommentEntity) => boolean;
  onDelete: (comment: CommentEntity) => void;
  requiresName: boolean;
  coAuthorUserId?: string;
};

const ThreadPanel: React.FC<ThreadPanelProps> = ({
  rootCommentId,
  lookup,
  replyCounts,
  commentById,
  onClose,
  onReplyRequest,
  onReplyCancel,
  onReplySubmit,
  onReplyDraftChange,
  getReplyDraft,
  getReplyStatus,
  getReplyError,
  isReplying,
  canDelete,
  onDelete,
  requiresName,
  coAuthorUserId,
}) => {
  const rootComment = commentById.get(rootCommentId);

  const threadComments = useMemo(() => {
    if (!rootComment) return [];

    const ordered: CommentEntity[] = [rootComment];

    const visit = (comment: CommentEntity) => {
      const children = [...(lookup.get(comment._id) ?? [])].sort((a, b) => {
        const aTime = new Date(a.createdAt).getTime();
        const bTime = new Date(b.createdAt).getTime();
        if (Number.isNaN(aTime) || Number.isNaN(bTime)) return 0;
        return aTime - bTime;
      });

      children.forEach((child) => {
        ordered.push(child);
        visit(child);
      });
    };

    visit(rootComment);
    return ordered;
  }, [lookup, rootComment]);

  useEffect(() => {
    if (!rootComment) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose, rootComment]);

  if (!rootComment) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-end md:items-stretch md:justify-start">
      <div
        className="absolute inset-0 bg-black/60"
        aria-hidden="true"
        onClick={onClose}
      />

      <aside
        className="card-surface relative z-10 w-full max-w-full rounded-t-3xl shadow-lg dark:bg-zinc-950/95 md:ml-auto md:h-full md:w-[420px] md:max-w-[420px] md:rounded-none md:border-l md:border-t-0"
        role="dialog"
        aria-modal="true"
        aria-labelledby="comment-thread-panel-title"
      >
        <header className="flex items-center justify-between gap-4 border-b border-zinc-200/70 px-4 py-3 dark:border-zinc-800/70">
          <div>
            <h2
              id="comment-thread-panel-title"
              className="text-sm font-semibold text-zinc-800 dark:text-zinc-100"
            >
              Conversa completa
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Veja e responda toda a thread.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 dark:text-zinc-400 dark:hover:bg-zinc-900"
            aria-label="Fechar thread"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </header>

        <div className="max-h-[80vh] overflow-y-auto px-4 py-4 md:h-full md:max-h-none md:px-5">
          <div className="space-y-4">
            {threadComments.map((comment) => {
              const parentLabel = comment.parentId
                ? (() => {
                    const parent = comment.parentId
                      ? commentById.get(comment.parentId) ?? null
                      : null;
                    const parentName = parent
                      ? extractDisplayName(parent)
                      : "comentário";
                    return `↪︎ @${parentName}`;
                  })()
                : null;

              return (
                <CommentItem
                  key={comment._id}
                  comment={comment}
                  replyCount={replyCounts.get(comment._id) ?? 0}
                  onReplyRequest={() => onReplyRequest(comment._id)}
                  onReplyCancel={() => onReplyCancel(comment._id)}
                  onReplySubmit={(draft) => onReplySubmit(comment._id, draft)}
                  onReplyDraftChange={(draft) =>
                    onReplyDraftChange(comment._id, draft)
                  }
                  replyDraft={getReplyDraft(comment._id)}
                  replyStatus={getReplyStatus(comment._id)}
                  replyError={getReplyError(comment._id)}
                  isReplying={isReplying(comment._id)}
                  canDelete={canDelete(comment)}
                  onDelete={() => onDelete(comment)}
                  requiresName={requiresName}
                  coAuthorUserId={coAuthorUserId}
                  showThreadButton={false}
                  replyContextLabel={parentLabel}
                />
              );
            })}
          </div>

          <div className="mt-6">
            <ReplyForm
              commentId={rootCommentId}
              draft={getReplyDraft(rootCommentId)}
              onDraftChange={onReplyDraftChange}
              onSubmit={onReplySubmit}
              onCancel={() => onReplyCancel(rootCommentId)}
              requiresName={requiresName}
              maxLength={STANDARD_COMMENT_MAX_LENGTH}
              status={getReplyStatus(rootCommentId)}
              errorMessage={getReplyError(rootCommentId)}
            />
          </div>
        </div>
      </aside>
    </div>
  );
};

export default ThreadPanel;
