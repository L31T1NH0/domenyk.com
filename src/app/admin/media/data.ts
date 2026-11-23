import "server-only";

import { listMedia, serializeMediaItem } from "@/lib/blob";
export async function loadAdminMediaPage() {
    const media = await listMedia();
    const serializedMedia = media.map(serializeMediaItem);
    return {
        media,
        serializedMedia,
        initialMedia: serializedMedia
    };
}
