"use client";
import type { LinkContent } from "@/lib/link-page";
import type { SiteLink } from "@/lib/links";
import { useEffect, useState } from "react";
type Stats = {
    days: number;
    items: {
        kind: string;
        id: string;
        clicks: number;
    }[];
    daily: {
        day: string;
        clicks: number;
    }[];
};
export function useLinkStats({ content, links }: {
    content: LinkContent[];
    links: SiteLink[];
}) {
    const [days, setDays] = useState("7");
    const [stats, setStats] = useState<Stats | null>(null);
    const [error, setError] = useState("");
    useEffect(() => {
        const controller = new AbortController();
        fetch(`/api/admin/links/stats?days=${days}`, { signal: controller.signal }).then(async (response) => {
            const data = await response.json();
            if (!response.ok)
                throw new Error(data.error);
            return data as Stats;
        }).then(data => { setStats(data); setError(""); }).catch(error => { if (!controller.signal.aborted)
            setError(error instanceof Error ? error.message : "Não foi possível carregar os cliques."); });
        return () => controller.abort();
    }, [days]);
    const totalClicks = stats?.items.reduce((sum, item) => sum + item.clicks, 0) ?? 0;
    const ranking = [...(stats?.items ?? [])].sort((a, b) => b.clicks - a.clicks).map(item => ({
        ...item,
        source: content.find(entry => entry.kind === item.kind && entry.id === item.id),
        link: item.kind === "link" ? links.find(entry => entry.id === item.id) : null,
    }));
    function changeDays(value: string) {
        setDays(value);
        setStats(null);
    }
    return {
        totalClicks,
        ranking,
        changeDays,
        days,
        setDays,
        stats,
        setStats,
        error,
        setError
    };
}
