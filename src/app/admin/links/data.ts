import "server-only";

import { parseLinkPageSettings } from "@/lib/link-page";
import { getLinkContents, getLinkPage, getLinks, requestLinksAction } from "@/lib/links-api";
export async function loadAdminLinksPage() {
    const result = await Promise.all([
        getLinks(true), requestLinksAction<unknown>("/v1/admin/links/settings"), getLinkPage(),
        requestLinksAction<{
            items: unknown[];
            latest?: unknown;
        }>("/v1/admin/links/content?limit=50"),
    ]).then(async ([links, rawSettings, pageData, catalog]) => {
        if (!Array.isArray(catalog.items) || catalog.items.length > 50)
            throw new Error("Catálogo inválido");
        return { links, settings: rawSettings === null ? null : parseLinkPageSettings(rawSettings), pageData, catalog: await getLinkContents(catalog.items), latest: catalog.latest ? (await getLinkContents([catalog.latest]))[0] : null };
    }).catch(() => null);
    return {
        result
    };
}
