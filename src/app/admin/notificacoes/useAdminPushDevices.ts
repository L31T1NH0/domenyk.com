"use client";
import { type AdminPushTopic } from "@/lib/notification-events";
import { useRouter } from "next/navigation";
import { useState } from "react";
export type AdminPushDevice = {
    id: string;
    label: string;
    updatedAt: string;
    lastSuccessAt?: string;
    topics: AdminPushTopic[];
};
export function useAdminPushDevices({ devices }: {
    devices: AdminPushDevice[];
}) {
    const router = useRouter();
    const [busy, setBusy] = useState<string | null>(null);
    const [message, setMessage] = useState("");
    async function revoke(body: {
        id: string;
    } | {
        all: true;
    }, key: string) {
        setBusy(key);
        setMessage("");
        try {
            const response = await fetch("/api/admin/push/devices", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
            const data = await response.json().catch(() => null) as {
                error?: string;
            } | null;
            if (!response.ok)
                throw new Error(data?.error || "Não foi possível revogar o dispositivo.");
            setMessage(key === "all" ? "Alertas privados revogados em todos os dispositivos." : "Alertas privados revogados neste dispositivo.");
            window.dispatchEvent(new Event("push:preferences-changed"));
            router.refresh();
        }
        catch (error) {
            setMessage(error instanceof Error ? error.message : "Não foi possível revogar o dispositivo.");
        }
        finally {
            setBusy(null);
        }
    }
    return {
        devices,
        router,
        busy,
        setBusy,
        message,
        setMessage,
        revoke
    };
}
