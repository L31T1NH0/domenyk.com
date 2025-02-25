// lib/posts.ts

import clientPromise from "./mongo"; // Importa a conexão com o MongoDB
import { remark } from "remark";
import html from "remark-html";

export type PostData = {
  postId: string; // Renomeado para consistência com o MongoDB
  date: string;
  title: string;
};

export type PostsData = PostData[];

// PostContent type is already defined above

// Função para buscar todos os posts do MongoDB
async function getPostsFromMongoDB(): Promise<PostsData> {
  const client = await clientPromise;
  const db = client.db("blog");
  const postsCollection = db.collection("posts");

  const posts = await postsCollection
    .find({}, { projection: { postId: 1, date: 1, title: 1, _id: 0 } }) // Busca apenas os campos necessários
    .sort({ date: -1 }) // Ordena por data (mais recentes primeiro)
    .toArray();

  return posts.map((post) => ({
    postId: post.postId,
    date: post.date,
    title: post.title,
  }));
}

// Função para buscar um post específico do MongoDB
async function getPostFromMongoDB(postId: string): Promise<PostContent | null> {
  const client = await clientPromise;
  const db = client.db("blog");
  const postsCollection = db.collection("posts");

  const post = await postsCollection.findOne({ postId });
  if (!post) return null;

  let htmlContent = post.htmlContent;
  // Processa o htmlContent se ainda estiver como Markdown ou com quebras de linha
  if (
    typeof htmlContent === "string" &&
    (htmlContent.includes("\n") ||
      htmlContent.includes("![") ||
      htmlContent.includes("["))
  ) {
    const processedContent = await remark().use(html).process(htmlContent);
    htmlContent = processedContent.toString();
  }

  return {
    postId: post.postId,
    date: post.date,
    title: post.title,
    htmlContent,
  };
}

// Função para buscar todos os IDs dos posts (postId)
export async function getAllPostsId(): Promise<{ params: { id: string } }[]> {
  const postsData = await getPostsFromMongoDB();
  return postsData.map(({ postId }) => ({ params: { id: postId } }));
}

// Função para buscar os dados de um post específico
export async function getPostData(id: string): Promise<PostContent> {
  const post = await getPostFromMongoDB(id);
  if (!post) {
    throw new Error("Post not found");
  }
  return post;
}

// Função para buscar todos os dados dos posts, ordenados por data
export async function getSortedPostsData(): Promise<PostsData> {
  return getPostsFromMongoDB();
}

// Exportando os tipos necessários
export type PostPath = {
  params: {
    id: string;
  };
};

export type PostsPath = PostPath[];

export type PostContent = PostData & {
  htmlContent: string;
};
