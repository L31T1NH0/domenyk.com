import "server-only";

import { getAdminUserId } from "@/lib/auth";
import { getNotes } from "@/lib/db/notes";
import { getSiteVisitNotificationSettings } from "@/lib/db/notification-settings";
import { getPosts } from "@/lib/db/posts";
import { adminPushTopicsFor, listAdminPushDevices, listPushCampaigns, pushSubscriptionCounts } from "@/lib/db/push-subscriptions";
import { descriptionFromMarkdown, noteDisplayTitle } from "@/lib/seo";
import { type AdminPushDevice } from "./useAdminPushDevices";
import { type PushContentOption } from "./useManualPushComposer";
function deviceLabel(userAgent?: string) {
    if (!userAgent)
        return "Dispositivo não identificado";
    const browser = /Edg\//.test(userAgent) ? "Edge"
        : /Firefox\//.test(userAgent) ? "Firefox"
            : /CriOS\//.test(userAgent) ? "Chrome"
                : /Chrome\//.test(userAgent) ? "Chrome/Brave"
                    : /Safari\//.test(userAgent) ? "Safari"
                        : "Navegador";
    const system = /Android/.test(userAgent) ? "Android"
        : /iPhone/.test(userAgent) ? "iPhone"
            : /iPad/.test(userAgent) ? "iPad"
                : /Windows/.test(userAgent) ? "Windows"
                    : /Mac OS X/.test(userAgent) ? "macOS"
                        : /Linux/.test(userAgent) ? "Linux"
                            : "sistema desconhecido";
    return `${browser} · ${system}`;
}
export async function loadAdminPushPage() {
    const adminId = getAdminUserId();
    const [{ posts }, { notes }, counts, campaigns, storedDevices, visitSettings] = await Promise.all([
        getPosts({ limit: 200 }),
        getNotes({ limit: 200 }),
        pushSubscriptionCounts(),
        listPushCampaigns(),
        adminId ? listAdminPushDevices(adminId) : Promise.resolve([]),
        getSiteVisitNotificationSettings(),
    ]);
    const devices: AdminPushDevice[] = storedDevices.map((device) => ({
        id: device._id.toString(),
        label: deviceLabel(device.userAgent),
        updatedAt: device.updatedAt.toISOString(),
        topics: adminPushTopicsFor(device),
        ...(device.lastSuccessAt ? { lastSuccessAt: device.lastSuccessAt.toISOString() } : {}),
    }));
    const content: PushContentOption[] = [
        ...posts.map((post) => ({
            id: post._id.toString(),
            type: "post" as const,
            title: post.title,
            description: post.excerpt?.trim() || `Leia “${post.title}” no domenyk.com.`,
            href: `/posts/${post.slug}`,
        })),
        ...notes.map((note) => ({
            id: note._id.toString(),
            type: "note" as const,
            title: noteDisplayTitle(note),
            description: note.seoDescription?.trim() || descriptionFromMarkdown(note.content, 180),
            href: `/notes/${note._id.toString()}`,
        })),
    ];
    return {
        adminId,
        posts,
        notes,
        counts,
        campaigns,
        storedDevices,
        visitSettings,
        devices: devices,
        content: content,
        initialPushSiteVisits: visitSettings.pushEnabled,
        initialStoreSiteVisits: visitSettings.storeInHistory,
        webhookConfigured: Boolean(process.env.CLERK_WEBHOOK_SIGNING_SECRET?.trim())
    };
}
