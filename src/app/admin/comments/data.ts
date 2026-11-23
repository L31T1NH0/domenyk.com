import "server-only";

import { getCommentParentSummaries, getRecentComments, serializeComment } from "@/lib/db/comments";
export async function loadAdminCommentsPage() {
    const comments = await getRecentComments(50);
    const parents = await getCommentParentSummaries(comments.map((comment) => comment.postId));
    const serializedComments = comments.map((comment) => ({
        ...serializeComment(comment, true),
        parent: parents.get(comment.postId.toString())!,
    }));
    return {
        comments: serializedComments,
        parents,
        serializedComments
    };
}
