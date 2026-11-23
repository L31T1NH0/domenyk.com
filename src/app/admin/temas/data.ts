import "server-only"

import { getThemes } from "@/lib/db/themes";

export async function loadAdminThemesPage() {
    const themes = await getThemes();
    return {
        themes
    };
}
