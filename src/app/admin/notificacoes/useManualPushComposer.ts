"use client";
import { useMemo, useState } from "react";
export type PushContentOption = {
    id: string;
    type: "post" | "note";
    title: string;
    description: string;
    href: string;
};
export function useManualPushComposer({ content }: {
    content: PushContentOption[];
}) {
    const [selectedValue, setSelectedValue] = useState(content[0] ? `${content[0].type}:${content[0].id}` : "");
    const selected = useMemo(() => content.find((item) => `${item.type}:${item.id}` === selectedValue), [content, selectedValue]);
    const [title, setTitle] = useState(content[0] ? `Vale a leitura: ${content[0].title}` : "");
    const [message, setMessage] = useState(content[0]?.description ?? "");
    const [confirming, setConfirming] = useState(false);
    const [sending, setSending] = useState(false);
    const [requestId, setRequestId] = useState<string | null>(null);
    const [result, setResult] = useState("");
    const [error, setError] = useState("");
    function select(value: string) {
        const item = content.find((candidate) => `${candidate.type}:${candidate.id}` === value);
        setSelectedValue(value);
        setTitle(item ? `Vale a leitura: ${item.title}` : "");
        setMessage(item?.description ?? "");
        setConfirming(false);
        setRequestId(null);
        setResult("");
        setError("");
    }
    function review() {
        if (!selected || !title.trim() || !message.trim())
            return;
        setRequestId(crypto.randomUUID());
        setConfirming(true);
        setResult("");
        setError("");
    }
    async function send() {
        if (!selected || !requestId)
            return;
        setSending(true);
        setError("");
        try {
            const response = await fetch("/api/admin/push/send", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contentType: selected.type,
                    contentId: selected.id,
                    title: title.trim(),
                    message: message.trim(),
                    requestId,
                }),
            });
            const data = await response.json().catch(() => null) as {
                sent?: number;
                failed?: number;
                error?: string;
            } | null;
            if (!response.ok)
                throw new Error(data?.error || "Não foi possível enviar a notificação.");
            setResult(`Disparo concluído: ${data?.sent ?? 0} dispositivo(s) avisado(s)${data?.failed ? ` e ${data.failed} falha(s)` : ""}.`);
            setConfirming(false);
            setRequestId(null);
        }
        catch (cause) {
            setError(cause instanceof Error ? cause.message : "Não foi possível enviar a notificação.");
        }
        finally {
            setSending(false);
        }
    }
    const posts = content.filter((item) => item.type === "post");
    const notes = content.filter((item) => item.type === "note");
    function changeTitle(value: string) {
        setTitle(value);
        setConfirming(false);
    }
    function changeMessage(value: string) {
        setMessage(value);
        setConfirming(false);
    }
    return {
        changeTitle,
        changeMessage,
        selectedValue,
        setSelectedValue,
        selected,
        title,
        setTitle,
        message,
        setMessage,
        confirming,
        setConfirming,
        sending,
        setSending,
        requestId,
        setRequestId,
        result,
        setResult,
        error,
        setError,
        select,
        review,
        send,
        posts,
        notes
    };
}
