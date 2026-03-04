"use client";

import { useState, useTransition } from "react";

export default function PinToggle({
  postId,
  pinnedOrder,
}: {
  postId: string;
  pinnedOrder?: number | null;
}) {
  const [pinned, setPinned] = useState(pinnedOrder != null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const toggle = () => {
    startTransition(async () => {
      setError(null);
      try {
        const res = await fetch("/admin/api/pin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ postId, pin: !pinned }),
        });
        if (!res.ok) throw new Error(await res.text());
        setPinned((p) => !p);
      } catch (e) {
        setError((e as Error).message);
      }
    });
  };

  return (
    <div className="flex items-center gap-2 justify-end">
      <button
        onClick={toggle}
        disabled={isPending}
        className={`px-2 py-1 rounded text-xs border transition-colors ${
          pinned
            ? "bg-zinc-100 text-zinc-900 border-zinc-200"
            : "bg-zinc-800 text-zinc-200 border-zinc-700"
        } disabled:opacity-60`}
        title={pinned ? "Desafixar post" : "Fixar post na home"}
      >
        {pinned ? "Fixado" : "Fixar"}
      </button>
      {error && <span className="text-red-500 text-xs">{error}</span>}
    </div>
  );
}
