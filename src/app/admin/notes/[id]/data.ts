import "server-only"

import { notFound } from "next/navigation";
import { getNote, serializeNote } from "@/lib/db/notes";

import { getNoteMetrics } from "@/lib/db/note-metrics";

export async function loadAdminNotePage({ params }: {
    params: Promise<{
        id: string;
    }>;
}) {
    const { id } = await params;
    const [note, metrics] = await Promise.all([getNote(id), getNoteMetrics(id)]);
    if (!note)
        notFound();
    const title = note.title || note.seoTitle || "Nota sem título";
    return {
        id,
        note: serializeNote(note),
        metrics: { directViews: metrics.directViews, homeImpressions: metrics.homeImpressions, notesImpressions: metrics.notesImpressions },
        title
    };
}
