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
      className="comment-form mt-4 flex flex-col gap-4 border border-[rgba(255,255,255,0.12)] bg-[rgba(16,16,16,0.65)] p-5"
    >
      <div className="flex flex-col gap-3 text-left">
        {requiresName && (
          <div className="flex flex-col gap-1">
            <label htmlFor={`reply-name-${commentId}`} className="text-[0.6rem] uppercase tracking-[0.24em] text-[var(--color-muted)]">
              Nome
            </label>
            <input
              id={`reply-name-${commentId}`}
              type="text"
              placeholder="Seu nome"
              value={draft.nome}
              onChange={(event) =>
                onDraftChange(commentId, {
                  ...draft,
                  nome: event.target.value,
                })
              }
              className="w-full rounded-xl border border-[rgba(255,255,255,0.12)] bg-transparent px-3 py-2 text-sm text-[var(--color-text)] placeholder:text-[var(--color-muted)] transition focus:border-[var(--color-accent)] focus:outline-none"
              disabled={isSending}
            />
          </div>
        )}
        <div className="flex flex-col gap-1">
          <label htmlFor={`reply-message-${commentId}`} className="text-[0.6rem] uppercase tracking-[0.24em] text-[var(--color-muted)]">
            Resposta
          </label>
          <textarea
            id={`reply-message-${commentId}`}
            placeholder="Sua resposta"
            value={draft.comentario}
            onChange={(event) =>
              onDraftChange(commentId, {
                ...draft,
                comentario: event.target.value,
              })
            }
            className="min-h-[110px] w-full resize-none rounded-xl border border-[rgba(255,255,255,0.12)] bg-transparent px-3 py-2 text-sm text-[var(--color-text)] placeholder:text-[var(--color-muted)] transition focus:border-[var(--color-accent)] focus:outline-none"
            disabled={isSending}
          />
        </div>
      </div>

      <div className="flex flex-col gap-3 text-[0.62rem] uppercase tracking-[0.24em] text-[var(--color-muted)] sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2">
          {errorMessage && (
            <span className="text-[var(--color-accent)]">{errorMessage}</span>
          )}
          <span className={lengthState.isOverLimit ? "text-[var(--color-accent)]" : undefined}>{lengthState.message}</span>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="motion-scale inline-flex items-center justify-center rounded-full border border-[rgba(255,255,255,0.12)] px-4 py-1.5 text-[0.62rem] uppercase tracking-[0.24em] text-[var(--color-muted)] transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
            disabled={isSending}
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="comment-button motion-scale px-5 py-1.5 text-[0.62rem] disabled:cursor-not-allowed disabled:opacity-60"
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
