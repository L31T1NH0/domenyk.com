import "server-only";

import { getActivityDashboard } from "@/lib/db/activity";
import { getPosts } from "@/lib/db/posts";
export async function loadAdminDashboard() {
    const [{ total }, activity] = await Promise.all([getPosts({ includeUnpublished: true }), getActivityDashboard(14)]);
    return {
        total,
        activity
    };
}
