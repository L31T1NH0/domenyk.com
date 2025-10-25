export type ParagraphComment = {
  _id: string;
  postId: string;
  paragraphId: string;
  userId: string;
  authorName: string;
  authorImageUrl: string | null;
  content: string;
  createdAt: string;
  updatedAt: string;
};
