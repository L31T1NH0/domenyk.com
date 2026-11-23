import "server-only";

import { getWritingEntries } from "@/lib/db/writing-progress";
export async function loadWritingPage() {
    const entries = await getWritingEntries();
    return {
        entries,
        initialEntries: entries
    };
}
