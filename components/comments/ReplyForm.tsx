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
          className="w-full rounded-md border border-zinc-300/70 bg-white/80 px-3 py-2 text-sm text-zinc-800 outline-none transition focus:border-purple-400 focus:ring-2 focus:ring-purple-400/30 dark:border-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-100 dark:focus:border-purple-300"
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
        className="h-20 sm:h-24 w-full resize-none rounded-md border border-zinc-300/70 bg-white/80 px-3 py-2 text-sm text-zinc-800 outline-none transition focus:border-purple-400 focus:ring-2 focus:ring-purple-400/30 dark:border-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-100 dark:focus:border-purple-300 whitespace-pre-wrap break-words"
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
            className="px-2 py-1 text-sm font-medium text-zinc-500 transition-colors hover:text-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 dark:text-zinc-300 dark:hover:text-zinc-100"
            disabled={isSending}
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="inline-flex items-center gap-1 rounded-md bg-purple-600 px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-purple-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:cursor-not-allowed disabled:opacity-60 dark:focus-visible:ring-offset-zinc-950"
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








