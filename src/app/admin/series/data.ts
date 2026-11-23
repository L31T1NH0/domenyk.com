import "server-only"

import { getSeries } from "@/lib/db/series";

export async function loadAdminSeriesPage() {
    const series = await getSeries();
    return {
        series
    };
}
