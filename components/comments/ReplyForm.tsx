import React from "react";

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

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(commentId, draft);
      }}
      className="mt-3 space-y-2 rounded-xl border border-zinc-200 bg-white p-3 shadow-sm text-sm dark:border-zinc-700 dark:bg-zinc-900/70"
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
          className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm text-zinc-800 shadow-inner outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200 dark:border-zinc-700 dark:text-zinc-100 dark:focus:border-zinc-400 dark:focus:ring-zinc-700"
          disabled={isSending}
        />
      )}
      <textarea
        maxLength={maxLength}
        placeholder="Sua resposta"
        value={draft.comentario}
        onChange={(event) =>
          onDraftChange(commentId, {
            ...draft,
            comentario: event.target.value,
          })
        }
        className="h-20 sm:h-24 w-full resize-none rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm text-zinc-800 shadow-inner outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200 dark:border-zinc-700 dark:text-zinc-100 dark:focus:border-zinc-400 dark:focus:ring-zinc-700"
        disabled={isSending}
      />
      <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
        {errorMessage && (
          <span className="text-xs font-medium text-red-400">{errorMessage}</span>
        )}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full border border-zinc-300 px-4 py-1 text-xs font-medium text-zinc-700 transition hover:border-zinc-400 hover:text-zinc-900 dark:border-zinc-700 dark:text-zinc-200"
            disabled={isSending}
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="inline-flex items-center gap-1 rounded-full border border-zinc-300 bg-white px-3 py-1 text-xs font-medium text-zinc-700 transition-colors hover:border-purple-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700"
            disabled={isSending}
          >
            {isSending ? "Enviando..." : "Responder"}
          </button>
        </div>
      </div>
    </form>
  );
};

export default ReplyForm;








