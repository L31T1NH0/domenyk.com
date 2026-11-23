import "server-only"

export async function loadNewPostPage({ searchParams }: {
    searchParams: Promise<{
        series?: string | string[];
    }>;
}) {
    const value = (await searchParams).series;
    const initialSeriesPublicId = (Array.isArray(value) ? value[0] : value)?.slice(0, 80) ?? "";
    return {
        value,
        initialSeriesPublicId: initialSeriesPublicId
    };
}
