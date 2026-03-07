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
    <div className="border border-white/8 rounded-lg px-4 py-3 flex items-center justify-between gap-4">
      <div>
        <p className="text-sm font-medium text-[#f1f1f1]">Coleta de analytics</p>
        <p className="text-xs text-[#A8A095]">Liga ou desliga o rastreamento de eventos do site.</p>
        <div className="mt-1 text-xs">
          {isSaving && <span className="text-[#A8A095]">Salvando...</span>}
          {!isSaving && message && <span className="text-[#E00070]">{message}</span>}
          {!isSaving && error && <span className="text-red-400">{error}</span>}
        </div>
      </div>
      <button
        type="button"
        disabled={isSaving}
        onClick={() => updateToggle(!enabled)}
        className={`shrink-0 rounded-md border px-3 py-1.5 text-xs font-medium transition-all ${
          enabled
            ? "border-[#E00070]/40 bg-[#E00070]/10 text-[#E00070]"
            : "border-white/10 text-[#A8A095] hover:border-white/20 hover:text-[#f1f1f1]"
        }`}
      >
        {enabled ? "Ligado" : "Desligado"}
      </button>
    </div>
  );
}
