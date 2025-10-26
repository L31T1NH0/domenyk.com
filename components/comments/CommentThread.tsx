import React from "react";

import CommentItem from "./CommentItem";
import {
  CommentDraft,
  CommentEntity,
  CommentLookup,
  SubmissionStatus,
} from "./types";

type CommentThreadProps = {
  parentId: string | null;
  lookup: CommentLookup;
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

const CommentThread: React.FC<CommentThreadProps> = ({
  parentId,
  lookup,
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
  const siblings = lookup.get(parentId ?? null) ?? [];

  if (siblings.length === 0) {
    return null;
  }

  return (
    <div className={parentId ? "space-y-3" : "space-y-4"}>
      {siblings.map((comment) => (
        <CommentItem
          key={comment._id}
          comment={comment}
          onReplyRequest={() => onReplyRequest(comment._id)}
          onReplyCancel={() => onReplyCancel(comment._id)}
          onReplySubmit={(draft) => onReplySubmit(comment._id, draft)}
          onReplyDraftChange={(draft) => onReplyDraftChange(comment._id, draft)}
          replyDraft={getReplyDraft(comment._id)}
          replyStatus={getReplyStatus(comment._id)}
          replyError={getReplyError(comment._id)}
          isReplying={isReplying(comment._id)}
          canDelete={canDelete(comment)}
          onDelete={() => onDelete(comment)}
          requiresName={requiresName}
          coAuthorUserId={coAuthorUserId}
        >
          <CommentThread
            parentId={comment._id}
            lookup={lookup}
            onReplyRequest={onReplyRequest}
            onReplyCancel={onReplyCancel}
            onReplySubmit={onReplySubmit}
            onReplyDraftChange={onReplyDraftChange}
            getReplyDraft={getReplyDraft}
            getReplyStatus={getReplyStatus}
            getReplyError={getReplyError}
            isReplying={isReplying}
            canDelete={canDelete}
            onDelete={onDelete}
            requiresName={requiresName}
            coAuthorUserId={coAuthorUserId}
          />
        </CommentItem>
      ))}
    </div>
  );
};

export default CommentThread;

