"use client";
import { useState } from "react";
export function useAdminNotificationSettings({ initialPushSiteVisits, initialStoreSiteVisits, webhookConfigured, }: {
    initialPushSiteVisits: boolean;
    initialStoreSiteVisits: boolean;
    webhookConfigured: boolean;
}) {
    const [pushSiteVisits, setPushSiteVisits] = useState(initialPushSiteVisits);
    const [storeSiteVisits, setStoreSiteVisits] = useState(initialStoreSiteVisits);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState("");
    async function save(nextPush: boolean, nextStore: boolean) {
        const previousPush = pushSiteVisits;
        const previousStore = storeSiteVisits;
        setPushSiteVisits(nextPush);
        setStoreSiteVisits(nextStore);
        setSaving(true);
        setMessage("");
        try {
            const response = await fetch("/api/admin/notification-settings", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    pushSiteVisits: nextPush,
                    storeSiteVisits: nextStore,
                }),
            });
            const data = await response.json().catch(() => null) as {
                error?: string;
                pushSiteVisits?: boolean;
                storeSiteVisits?: boolean;
            } | null;
            if (!response.ok)
                throw new Error(data?.error || "Não foi possível salvar as configurações.");
            setPushSiteVisits(data?.pushSiteVisits === true);
            setStoreSiteVisits(data?.storeSiteVisits === true);
            setMessage("Configuração salva.");
        }
        catch (error) {
            setPushSiteVisits(previousPush);
            setStoreSiteVisits(previousStore);
            setMessage(error instanceof Error ? error.message : "Não foi possível salvar as configurações.");
        }
        finally {
            setSaving(false);
        }
    }
    const visitStatus = storeSiteVisits
        ? pushSiteVisits
            ? "Histórico e Web Push ativos."
            : "Histórico ativo; Web Push desligado."
        : pushSiteVisits
            ? "Somente Web Push ativo; nenhuma visita é salva na central."
            : "Monitor de visitas desligado.";
    const deduplicationStatus = storeSiteVisits || pushSiteVisits
        ? " A mesma pessoa na mesma página é ignorada por 1 hora."
        : "";
    return {
        webhookConfigured,
        pushSiteVisits,
        setPushSiteVisits,
        storeSiteVisits,
        setStoreSiteVisits,
        saving,
        setSaving,
        message,
        setMessage,
        save,
        visitStatus,
        deduplicationStatus
    };
}
