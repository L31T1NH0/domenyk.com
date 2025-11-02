"use client";

import { useState, useTransition } from "react";

export default function VisibilityToggle({ postId, hidden: initialHidden }: { postId: string; hidden?: boolean }) {
  const [hidden, setHidden] = useState(!!initialHidden);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const toggle = () => {
    startTransition(async () => {
      setError(null);
      try {
        const res = await fetch("/admin/api/visibility", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ postId, hidden: !hidden }),
        });
        if (!res.ok) {
          const t = await res.text();
          throw new Error(t);
        }
        setHidden((h) => !h);
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
        className={`px-2 py-1 rounded text-xs border ${hidden ? 'bg-zinc-800 text-zinc-200 border-zinc-700' : 'bg-zinc-100 text-zinc-900 border-zinc-200'} disabled:opacity-60`}
        title={hidden ? 'Tornar visível' : 'Ocultar post'}
      >
        {hidden ? 'Oculto' : 'Visível'}
      </button>
      {error && <span className="text-red-500 text-xs">{error}</span>}
    </div>
  );
}
