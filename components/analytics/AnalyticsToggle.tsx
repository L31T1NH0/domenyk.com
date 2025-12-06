"use client";

import { useState } from "react";

export function AnalyticsToggle({ initialEnabled }: { initialEnabled: boolean }) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const updateToggle = async (nextEnabled: boolean) => {
    const previous = enabled;
    setEnabled(nextEnabled);
    setIsSaving(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch("/api/admin/analytics/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: nextEnabled }),
      });

      if (!response.ok) {
        throw new Error(`Failed to update: ${response.status}`);
      }

      const data = (await response.json()) as { enabled?: boolean };
      setEnabled(Boolean(data.enabled));
      setMessage(data.enabled ? "Coleta ligada" : "Coleta desligada");
    } catch (err) {
      console.error("Failed to toggle analytics", err);
      setEnabled(previous);
      setError("Não foi possível salvar a configuração agora.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-zinc-50">Coleta de analytics</p>
          <p className="text-xs text-zinc-400">Liga ou desliga o rastreamento de eventos do site.</p>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="h-4 w-4 accent-emerald-500"
            checked={enabled}
            disabled={isSaving}
            onChange={(event) => updateToggle(event.target.checked)}
          />
          <span className="text-zinc-200">{enabled ? "Ligado" : "Desligado"}</span>
        </label>
      </div>
      <div className="text-xs text-zinc-400">
        {isSaving && <span className="text-amber-300">Salvando...</span>}
        {!isSaving && message && <span className="text-emerald-300">{message}</span>}
        {!isSaving && error && <span className="text-red-400">{error}</span>}
      </div>
    </div>
  );
}
