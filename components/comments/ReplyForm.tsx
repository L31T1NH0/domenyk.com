import React from "react";

import { useCommentLength } from "./lengthUtils";

import { CommentDraft, SubmissionStatus } from "./types";

type ReplyFormProps = {
  commentId: string;
  draft: CommentDraft;
  onDraftChange: (commentId: string, draft: CommentDraft) => void;
  onSubmit: (commentId: string, draft: CommentDraft) => void;
  onCancel: () => void;
  requiresName: boolean;
  maxLength: number;
  status: SubmissionStatus;
  errorMessage?: string | null;
};

const ReplyForm: React.FC<ReplyFormProps> = ({
  commentId,
  draft,
  onDraftChange,
  onSubmit,
  onCancel,
  requiresName,
  maxLength,
  status,
  errorMessage,
}) => {
  const isSending = status === "sending";
  const lengthState = useCommentLength(draft.comentario, maxLength);

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(commentId, draft);
      }}
      className="mt-4 space-y-3 text-sm"
    >
      {requiresName && (
        <input
          type="text"
          placeholder="Seu nome"
          value={draft.nome}
          onChange={(event) =>
            onDraftChange(commentId, {
              ...draft,
              nome: event.target.value,
            })
          }
          className="form-input"
          disabled={isSending}
        />
      )}
      <textarea
        placeholder="Sua resposta"
        value={draft.comentario}
        onChange={(event) =>
          onDraftChange(commentId, {
            ...draft,
            comentario: event.target.value,
          })
        }
        className="form-textarea h-20 sm:h-24"
        disabled={isSending}
      />
      <div className="flex flex-col gap-2 text-xs text-zinc-500 dark:text-zinc-400 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          {errorMessage && (
            <span className="text-xs font-medium text-red-400">{errorMessage}</span>
          )}
          <span
            className={
              lengthState.isOverLimit
                ? "font-medium text-red-500 dark:text-red-400"
                : undefined
            }
          >
            {lengthState.message}
          </span>
        </div>
        <div className="flex gap-3 text-sm">
          <button
            type="button"
            onClick={onCancel}
            className="btn-ghost"
            disabled={isSending}
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="btn-primary"
            disabled={isSending || lengthState.isOverLimit}
          >
            {isSending ? "Enviando..." : "Responder"}
          </button>
        </div>
      </div>
    </form>
  );
};

export default ReplyForm;








