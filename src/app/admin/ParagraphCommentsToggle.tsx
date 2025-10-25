"use client";

import { useState, useTransition } from "react";

export default function ParagraphCommentsToggle({
  postId,
  enabled: initialEnabled,
  onToggle,
}: {
  postId: string;
  enabled?: boolean;
  onToggle?: (next: boolean) => void;
}) {
  const [enabled, setEnabled] = useState(initialEnabled !== false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const toggle = () => {
    startTransition(async () => {
      setError(null);
      try {
        const next = !enabled;
        const res = await fetch("/admin/api/paragraph-comments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ postId, enabled: next }),
        });
        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || "Falha ao atualizar comentários por parágrafo");
        }
        setEnabled(next);
        onToggle?.(next);
      } catch (e) {
        setError((e as Error).message);
      }
    });
  };

  return (
    <div className="flex items-center justify-end gap-2">
      <button
        onClick={toggle}
        disabled={isPending}
        className={`px-2 py-1 rounded text-xs border ${
          enabled
            ? "bg-emerald-500/10 text-emerald-300 border-emerald-400/40"
            : "bg-zinc-900 text-zinc-200 border-zinc-700"
        } disabled:opacity-60`}
        title={enabled ? "Desativar comentários por parágrafo" : "Ativar comentários por parágrafo"}
      >
        {enabled ? "Ativos" : "Inativos"}
      </button>
      {error && <span className="text-red-500 text-xs">{error}</span>}
    </div>
  );
}
