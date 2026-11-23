import "server-only";

import { getNoteMetricsMap } from "@/lib/db/note-metrics";
import { getNotes, serializeNote } from "@/lib/db/notes";
export async function loadAdminNotesPage() {
    const { notes } = await getNotes({ limit: 100 });
    const metrics = await getNoteMetricsMap(notes.map((note) => note._id));
    const serializedNotes = notes.map((note) => ({
        ...serializeNote(note),
        metrics: metrics.get(note._id.toString()) ?? { directViews: 0, homeImpressions: 0, notesImpressions: 0 },
    }));
    return {
        notes: serializedNotes,
        metrics,
        serializedNotes
    };
}
