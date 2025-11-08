import React from "react";

import CommentItem from "./CommentItem";
import {
  CommentDraft,
  CommentEntity,
  CommentLookup,
  SubmissionStatus,
} from "./types";

type CommentThreadProps = {
  lookup: CommentLookup;
  replyCounts: Map<string, number>;
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
  onOpenThread: (commentId: string) => void;
  coAuthorUserId?: string;
};

const CommentThread: React.FC<CommentThreadProps> = ({
  lookup,
  replyCounts,
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
  onOpenThread,
  coAuthorUserId,
}) => {
  const topLevelComments = lookup.get(null) ?? [];

  if (topLevelComments.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      {topLevelComments.map((comment) => (
        <CommentItem
          key={comment._id}
          comment={comment}
          replyCount={replyCounts.get(comment._id) ?? 0}
          onOpenThread={() => onOpenThread(comment._id)}
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
        />
      ))}
    </div>
  );
};

export default CommentThread;
