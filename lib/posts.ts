// lib/posts.js

import axios from "axios";
import matter from "gray-matter";
import { remark } from "remark";
import html from "remark-html";

const username = "L31T1NH0";
const repository = "markdown";
const path = "posts";
const branch = "main"; // ou outra branch onde estão os arquivos

export type PostData = {
  id: string;
  date: string;
  title: string;
};

export type PostsData = PostData[];

// Função para buscar conteúdo de um arquivo
async function fetchFileContent(filePath: string): Promise<string> {
  const url = `https://raw.githubusercontent.com/${username}/${repository}/${branch}/${filePath}`;
  const response = await axios.get(url);
  return response.data;
}

// Função para buscar todos os dados dos posts
export async function getSortedPostsData(): Promise<PostsData> {
  const url = `https://api.github.com/repos/${username}/${repository}/contents/${path}?ref=${branch}`;
  const response = await axios.get(url);
  const files = response.data;

  const allPostsData = await Promise.all(
    files.map(async (file: { path: string; name: string }) => {
      const id = file.name.replace(/\.md$/, "");
      const fileContents = await fetchFileContent(file.path);
      const { data } = matter(fileContents);

      return {
        id,
        ...data,
      };
    })
  );

  return allPostsData.sort((a, b) => (a.date < b.date ? 1 : -1));
}

// Função para buscar todos os IDs dos posts
export async function getAllPostsId(): Promise<{ params: { id: string } }[]> {
  const postsData = await getSortedPostsData();
  return postsData.map(({ id }) => ({ params: { id } }));
}

// Função para buscar os dados de um post específico
export async function getPostData(
  id: string
): Promise<PostData & { htmlContent: string }> {
  const fileName = `${id}.md`;
  const fileContents = await fetchFileContent(`${path}/${fileName}`);
  const { data, content } = matter(fileContents);

  const processedContent = await remark().use(html).process(content);
  const htmlContent = processedContent.toString();

  return {
    id,
    date: data.date,
    title: data.title,
    htmlContent,
  };
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
