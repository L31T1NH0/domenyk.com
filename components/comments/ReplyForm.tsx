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
      className="mt-3 space-y-3 rounded-2xl border border-zinc-800/80 bg-zinc-950/70 p-2.5 sm:p-3.5 text-sm"
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
          className="w-full rounded-xl border border-zinc-800/70 bg-zinc-900/70 px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-500/40"
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
        className="h-20 sm:h-24 w-full resize-none rounded-xl border border-zinc-800/70 bg-zinc-900/70 px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-500/40"
        disabled={isSending}
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        {errorMessage && (
          <span className="text-xs font-medium text-red-400">{errorMessage}</span>
        )}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-zinc-700/80 px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:border-zinc-500 hover:text-zinc-100"
            disabled={isSending}
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="rounded-xl bg-purple-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-purple-500 disabled:cursor-not-allowed disabled:bg-purple-800/60"
            disabled={isSending}
          >
            {isSending ? "Enviando………" : "Responder"}
          </button>
        </div>
      </div>
    </form>
  );
};

export default ReplyForm;





